import { describe, expect, it } from "vitest";
import { getSeoDashboardIntelligence } from "./dashboard-intelligence.js";

function makeDb({ existingExactArticle = false } = {}) {
  const topic = {
    id: 1,
    title: "آموزش گیتار در شوشتر",
    normalized_key: "آموزش گیتار در شوشتر",
    instrument_key: "guitar",
    related_course_slug: "guitar-course",
    related_course_title: "دوره آموزش گیتار",
    category: "ساز",
    audience: "بزرگسال",
    level: "مبتدی",
    modifier_type: "local_shushtar",
    intent: "informational",
    score_total: 82,
    score_breakdown: null,
    reasoning: "موضوع مرتبط با دوره و بازار محلی",
    status: "approved",
    source: "topic-engine",
    created_at: "2026-09-20T00:00:00.000Z",
    updated_at: "2026-09-20T00:00:00.000Z"
  };

  const queryRows = [
    {
      query: "آموزش گیتار در شوشتر",
      clicks: 10,
      impressions: 100,
      position: 6
    }
  ];

  const pageRows = [
    {
      page: "https://fatehmusic.ir/courses/guitar-course",
      clicks: 10,
      impressions: 100,
      position: 6
    }
  ];

  const ownershipRows = [
    {
      query: "آموزش گیتار در شوشتر",
      page: "https://fatehmusic.ir/courses/guitar-course",
      impressions: 100
    }
  ];

  const keywords = [
    {
      keyword: "آموزش گیتار در شوشتر",
      volume: 150,
      keyword_difficulty: 20,
      best_position: 6
    },
    {
      keyword: "کلاس گیتار شوشتر",
      volume: 90,
      keyword_difficulty: 30,
      best_position: 12
    }
  ];

  const db = {
    prepare(sql) {
      const statement = {
        bind() {
          return statement;
        },
        async all() {
          if (sql.includes("FROM content_topics")) {
            if (existingExactArticle && sql.includes("p.title = content_topics.title")) return { results: [] };
            return { results: [topic] };
          }
          if (sql.includes("SELECT query, SUM(clicks)")) return { results: queryRows };
          if (sql.includes("SELECT page, SUM(clicks)")) return { results: pageRows };
          if (sql.includes("SELECT query, page, SUM(impressions)")) return { results: ownershipRows };
          return { results: [] };
        },
        async first() {
          if (sql.includes("SUM(CASE WHEN status='approved'")) {
            return { approvedCount: 3, candidateCount: 2, activeCount: 5 };
          }
          if (sql.includes("COUNT(*) AS signalCount")) return { signalCount: 4 };
          if (sql.includes("COUNT(DISTINCT query)")) return { queryCount: 1 };
          if (sql.includes("FROM gsc_sync_runs")) {
            return {
              siteUrl: "https://fatehmusic.ir",
              status: "success",
              rowsReceived: 4,
              rowsStored: 4,
              truncated: 0,
              startedAt: "2026-09-29T00:00:00.000Z",
              finishedAt: "2026-09-29T00:02:00.000Z",
              snapshotSyncedAt: "2026-09-29T00:02:00.000Z"
            };
          }
          if (sql.includes("snapshot_type='metrics'")) {
            return { snapshotDate: "2026-09-29", fetchedAt: "2026-09-29T00:00:00.000Z", payload: '{"org_keywords":12}' };
          }
          if (sql.includes("snapshot_type='organic-competitors'")) {
            return { snapshotDate: "2026-09-29", fetchedAt: "2026-09-29T00:00:00.000Z", payload: '[]' };
          }
          if (sql.includes("snapshot_type='refdomains-history'")) {
            return { snapshotDate: "2026-09-29", fetchedAt: "2026-09-29T00:00:00.000Z", payload: '[]' };
          }
          if (sql.includes("snapshot_type='organic-keywords'")) {
            return {
              snapshotDate: "2026-09-29",
              fetchedAt: "2026-09-29T00:00:00.000Z",
              payload: JSON.stringify(keywords)
            };
          }
          return null;
        }
      };
      return statement;
    }
  };

  return db;
}

describe("SEO dashboard read model", () => {
  it("suppresses a topic when a published article already has the exact title", async () => {
    const result = await getSeoDashboardIntelligence({
      db: makeDb({ existingExactArticle: true }),
      siteUrl: "https://fatehmusic.ir",
      courses: [{ slug: "guitar-course", title: "دوره آموزش گیتار", active: true }],
      topicLimit: 60,
      gscQueryLimit: 100,
      gscPageLimit: 100,
      gscOwnershipLimit: 120,
      marketLimit: 1
    });

    expect(result.opportunities).toHaveLength(0);
  });

  it("reads persisted decisions and bounded signals without invoking the full engine", async () => {
    const result = await getSeoDashboardIntelligence({
      db: makeDb(),
      siteUrl: "https://fatehmusic.ir",
      courses: [{ slug: "guitar-course", title: "دوره آموزش گیتار", active: true }],
      topicLimit: 60,
      gscQueryLimit: 100,
      gscPageLimit: 100,
      gscOwnershipLimit: 120,
      marketLimit: 1
    });

    expect(result.mode).toBe("READ_MODEL");
    expect(result.opportunities).toHaveLength(1);
    expect(result.opportunities[0].action).toBe("LINK");
    expect(result.opportunities[0].searchOwnership?.available).toBe(true);
    expect(result.summary.approvedTopicCount).toBe(3);
    expect(result.summary.candidateTopicCount).toBe(2);
    expect(result.gsc.signalRowCount).toBe(4);
    expect(result.gsc.queryOwnershipTotalCount).toBe(1);
    expect(result.ahrefsOrganicKeywords.totalCount).toBe(2);
    expect(result.ahrefsOrganicKeywords.payload).toHaveLength(1);
  });
});
