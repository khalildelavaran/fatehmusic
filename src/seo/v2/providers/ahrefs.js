const AHREFS_BASE = "https://api.ahrefs.com/v3";
const DEFAULT_COUNTRY = "IR";
const DEFAULT_TARGET = "https://fatehmusic.ir";

import { normalizeSemanticText } from "../../helpers/text.js";
const KEYWORD_BATCH_SIZE = 25;

function normalizeTarget(value) {
  return String(value || DEFAULT_TARGET).replace(/\/$/, "");
}

function normalizeCountry(value) {
  return String(value || DEFAULT_COUNTRY).trim().toUpperCase();
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Convert an Ahrefs organic-keyword snapshot into the normalized map consumed
 * by the SEO decision engine.
 */
export function buildAhrefsKeywordSignalMap(rows = []) {
  const map = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const keyword = String(row?.keyword || "").trim();
    const key = normalizeSemanticText(keyword);
    if (!key) continue;

    const signal = {
      available: true,
      estimatedVolume: row.volume_monthly == null
        ? (row.volume == null ? undefined : Number(row.volume))
        : Number(row.volume_monthly),
      difficulty: row.keyword_difficulty == null
        ? (row.difficulty == null ? undefined : Number(row.difficulty))
        : Number(row.keyword_difficulty),
      trafficPotential: row.traffic_potential == null ? undefined : Number(row.traffic_potential),
      cpc: row.cpc == null ? undefined : Number(row.cpc),
      source: "ahrefs"
    };

    const existing = map.get(key);
    const existingVolume = Number(existing?.estimatedVolume) || 0;
    const incomingVolume = Number(signal.estimatedVolume) || 0;
    if (!existing || incomingVolume > existingVolume) {
      map.set(key, signal);
    }
  }
  return map;
}

/** @param {Record<string, any>} [env] */
export function getAhrefsConfig(env = {}) {
  return {
    apiKey: env.AHREFS_API_KEY || "",
    country: normalizeCountry(env.AHREFS_COUNTRY),
    target: normalizeTarget(env.AHREFS_TARGET_URL),
    enabled: Boolean(env.AHREFS_API_KEY)
  };
}

/** @param {Record<string, any>} [env] @param {typeof fetch} [fetchImpl] */
export function createAhrefsClient(env = {}, fetchImpl = fetch) {
  const config = getAhrefsConfig(env);

  async function get(path, params = {}) {
    if (!config.enabled) throw new Error("AHREFS_NOT_CONFIGURED");
    const url = new URL(AHREFS_BASE + path);
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }

    const response = await fetchImpl(url, {
      headers: {
        Authorization: "Bearer " + config.apiKey,
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error("AHREFS_HTTP_" + response.status + ":" + body.slice(0, 300));
    }

    return response.json();
  }

  return {
    config,
    async keywordOverview(keywords, country = config.country) {
      const list = [...new Set((keywords || []).map((value) => String(value || "").trim()).filter(Boolean))];
      if (!list.length) return [];
      const data = await get("/keywords-explorer/overview", {
        select: "keyword,volume,volume_monthly,difficulty,traffic_potential,cpc,global_volume,intents,serp_features",
        keywords: list.join(","),
        country: normalizeCountry(country),
        limit: list.length,
        output: "json"
      });
      return Array.isArray(data?.keywords) ? data.keywords : [];
    },

    async organicCompetitors({ date = today(), dateCompared = "", limit = 25 } = {}) {
      const data = await get("/site-explorer/organic-competitors", {
        select: "competitor_domain,competitor_url,domain_rating,group_mode,keywords_common,keywords_competitor,keywords_target,share,traffic,traffic_diff,traffic_prev",
        order_by: "keywords_common:desc",
        limit,
        date,
        date_compared: dateCompared,
        country: config.country,
        mode: "subdomains",
        target: config.target,
        protocol: "https",
        volume_mode: "monthly",
        traffic_mode: "adaptive",
        output: "json"
      });
      return Array.isArray(data?.competitors) ? data.competitors : [];
    },

    async refdomains({ limit = 100 } = {}) {
      const data = await get("/site-explorer/refdomains", {
        select: "domain,domain_rating,dofollow_links,links_to_target,new_links,lost_links,traffic_domain,is_spam,first_seen,last_seen",
        order_by: "domain_rating:desc",
        limit,
        mode: "subdomains",
        target: config.target,
        protocol: "https",
        history: "all_time",
        output: "json"
      });
      return Array.isArray(data?.refdomains) ? data.refdomains : [];
    },

    async refdomainsHistory({ dateFrom, dateTo = "" } = {}) {
      if (!dateFrom) throw new Error("AHREFS_REFDOMAIN_HISTORY_DATE_REQUIRED");
      const data = await get("/site-explorer/refdomains-history", {
        target: config.target,
        protocol: "https",
        mode: "subdomains",
        date_from: dateFrom,
        date_to: dateTo || dateFrom,
        history_grouping: "monthly",
        output: "json"
      });
      return Array.isArray(data?.refdomains) ? data.refdomains : [];
    },

    async metrics({ date = today() } = {}) {
      const data = await get("/site-explorer/metrics", {
        select: "org_keywords,org_keywords_1_3,org_traffic,org_cost",
        date,
        mode: "subdomains",
        target: config.target,
        protocol: "https",
        country: config.country,
        volume_mode: "monthly",
        traffic_mode: "adaptive",
        output: "json"
      });
      return data?.metrics || {};
    },

    async organicKeywords({ date = today(), limit = 100 } = {}) {
      const data = await get("/site-explorer/organic-keywords", {
        select: "keyword,best_position,best_position_url,keyword_difficulty,volume,sum_traffic,is_local,is_informational,is_commercial,is_transactional,is_navigational",
        order_by: "volume:desc",
        limit,
        date,
        country: config.country,
        mode: "subdomains",
        target: config.target,
        protocol: "https",
        volume_mode: "monthly",
        traffic_mode: "adaptive",
        output: "json"
      });
      return Array.isArray(data?.keywords) ? data.keywords : [];
    }
  };
}

async function chunked(values, size, worker) {
  const out = [];
  for (let offset = 0; offset < values.length; offset += size) {
    out.push(...await worker(values.slice(offset, offset + size)));
  }
  return out;
}

/** @param {{db:D1Database,env?:Record<string, any>,keywords?:string[]}} [options] */
export async function syncAhrefsKeywordSignals({ db, env = {}, keywords = [] } = {}) {
  const config = getAhrefsConfig(env);
  if (!db) throw new Error("AHREFS_D1_REQUIRED");
  if (!config.enabled) return { status: "not_configured", requested: 0, stored: 0 };

  const uniqueKeywords = [...new Set(keywords.map((value) => String(value || "").trim()).filter(Boolean))];
  const client = createAhrefsClient(env);
  const rows = await chunked(uniqueKeywords, KEYWORD_BATCH_SIZE, (batch) => client.keywordOverview(batch));

  if (!rows.length) return { status: "success", requested: uniqueKeywords.length, stored: 0 };

  const statements = rows.map((row) => db.prepare(
    "INSERT INTO seo_keyword_signals (source, keyword, country, volume, volume_monthly, difficulty, traffic_potential, cpc, intents, serp_features, fetched_at) " +
    "VALUES ('ahrefs', ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now')) " +
    "ON CONFLICT(source, keyword, country) DO UPDATE SET volume=excluded.volume, volume_monthly=excluded.volume_monthly, difficulty=excluded.difficulty, traffic_potential=excluded.traffic_potential, cpc=excluded.cpc, intents=excluded.intents, serp_features=excluded.serp_features, fetched_at=excluded.fetched_at"
  ).bind(
    row.keyword || "",
    config.country,
    row.volume == null ? null : Number(row.volume),
    row.volume_monthly == null ? null : Number(row.volume_monthly),
    row.difficulty == null ? null : Number(row.difficulty),
    row.traffic_potential == null ? null : Number(row.traffic_potential),
    row.cpc == null ? null : Number(row.cpc),
    JSON.stringify(row.intents || {}),
    JSON.stringify(row.serp_features || [])
  ));

  for (let offset = 0; offset < statements.length; offset += 50) {
    await db.batch(statements.slice(offset, offset + 50));
  }

  return { status: "success", requested: uniqueKeywords.length, stored: rows.length };
}

/** @param {D1Database} db @param {{country?:string,keywords?:string[],maxAgeDays?:number}} [options] */
export async function getCachedAhrefsKeywordSignals(db, {
  country = DEFAULT_COUNTRY,
  keywords = [],
  maxAgeDays = 14
} = {}) {
  if (!db) return new Map();
  const normalizedCountry = normalizeCountry(country);
  const out = new Map();
  const unique = [...new Set(keywords.map((value) => String(value || "").trim()).filter(Boolean))];

  for (let offset = 0; offset < unique.length; offset += 50) {
    const chunk = unique.slice(offset, offset + 50);
    if (!chunk.length) continue;
    const placeholders = chunk.map(() => "?").join(",");
    const result = await db.prepare(
      "SELECT keyword, volume, volume_monthly, difficulty, traffic_potential, cpc, intents, serp_features " +
      "FROM seo_keyword_signals WHERE source='ahrefs' AND country=? AND keyword IN (" + placeholders + ") AND fetched_at >= datetime('now', ?)"
    ).bind(normalizedCountry, ...chunk, "-" + Math.max(1, Number(maxAgeDays) || 14) + " days").all();

    for (const row of result.results || []) {
      out.set(String(row.keyword), {
        available: true,
        estimatedVolume: row.volume_monthly == null ? (row.volume == null ? undefined : Number(row.volume)) : Number(row.volume_monthly),
        difficulty: row.difficulty == null ? undefined : Number(row.difficulty),
        trafficPotential: row.traffic_potential == null ? undefined : Number(row.traffic_potential),
        cpc: row.cpc == null ? undefined : Number(row.cpc),
        source: "ahrefs"
      });
    }
  }

  return out;
}

/** @param {{db:D1Database,env?:Record<string, any>,date?:string}} [options] */
export async function syncAhrefsMarketIntelligence({ db, env = {}, date = today() } = {}) {
  const config = getAhrefsConfig(env);
  if (!db) throw new Error("AHREFS_D1_REQUIRED");
  if (!config.enabled) return { status: "not_configured", snapshots: [] };

  const client = createAhrefsClient(env);
  const tasks = [
    ["metrics", () => client.metrics({ date })],
    ["organic-competitors", () => client.organicCompetitors({ date })],
    ["refdomains", () => client.refdomains()],
    ["refdomains-history", () => client.refdomainsHistory({
      dateFrom: new Date(new Date(date).getTime() - 31 * 86_400_000).toISOString().slice(0, 10),
      dateTo: date
    })],
    ["organic-keywords", () => client.organicKeywords({ date, limit: 100 })]
  ];

  const results = await Promise.all(tasks.map(async ([type, run]) => {
    try {
      return { type, payload: await run() };
    } catch (error) {
      return {
        type,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }));

  const successful = results.filter((item) => !("error" in item));
  const failed = results.filter((item) => "error" in item);

  for (const item of successful) {
    await db.prepare(
      "INSERT INTO seo_market_snapshots (source, snapshot_type, target, country, snapshot_date, payload, fetched_at) " +
      "VALUES ('ahrefs', ?, ?, ?, ?, ?, datetime('now')) " +
      "ON CONFLICT(source, snapshot_type, target, country, snapshot_date) DO UPDATE SET payload=excluded.payload, fetched_at=excluded.fetched_at"
    ).bind(item.type, config.target, config.country, date, JSON.stringify(item.payload)).run();
  }

  const competitorPayload = successful.find((item) => item.type === "organic-competitors")?.payload;
  const refdomainPayload = successful.find((item) => item.type === "refdomains")?.payload;
  const keywordPayload = successful.find((item) => item.type === "organic-keywords")?.payload;

  return {
    status: failed.length ? (successful.length ? "partial" : "failed") : "success",
    snapshots: successful.map((item) => item.type),
    failed: failed.map((item) => ({ type: item.type, error: item.error })),
    competitors: Array.isArray(competitorPayload) ? competitorPayload.length : 0,
    refdomains: Array.isArray(refdomainPayload) ? refdomainPayload.length : 0,
    organicKeywords: Array.isArray(keywordPayload) ? keywordPayload.length : 0
  };
}

/** @param {D1Database} db @param {{target?:string,country?:string,snapshotType:string}} options */
export async function getLatestAhrefsMarketSnapshot(db, {
  target = DEFAULT_TARGET,
  country = DEFAULT_COUNTRY,
  snapshotType
} = {}) {
  if (!db) return null;
  const row = await db.prepare(
    "SELECT snapshot_type AS snapshotType, snapshot_date AS snapshotDate, payload, fetched_at AS fetchedAt " +
    "FROM seo_market_snapshots WHERE source='ahrefs' AND snapshot_type=? AND target=? AND country=? ORDER BY snapshot_date DESC LIMIT 1"
  ).bind(snapshotType, normalizeTarget(target), normalizeCountry(country)).first();

  if (!row) return null;

  let payload = null;
  try { payload = JSON.parse(row.payload); } catch {}
  return {
    snapshotType: row.snapshotType,
    snapshotDate: row.snapshotDate,
    fetchedAt: row.fetchedAt,
    payload
  };
}

/** @param {Record<string, any>} [env] */
export function isAhrefsConfigured(env = {}) {
  return Boolean(env.AHREFS_API_KEY);
}


/** @param {Record<string, any>} [env] @param {{date?:string}} [options] */
export async function runScheduledAhrefsMarketIntelligence(env = {}, options = {}) {
  if (!env?.AHREFS_API_KEY || !env?.DB) return { status: "not_configured" };

  const result = await syncAhrefsMarketIntelligence({
    db: env.DB,
    env,
    date: options.date || today()
  });

  return result;
}
