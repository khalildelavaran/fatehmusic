// D1 access layer for the Content Intelligence Engine. Every query lives
// here so pipeline.ts / the admin API routes never write raw SQL inline
// (matching the "business data only through a data-access layer" spirit
// of AGENTS.md's Repository Rules, adapted to this project's real,
// currently-used src/server/*.ts pattern rather than the aspirational
// repositories/ folder that doesn't exist yet).

import type { ContentTopicRow, ScoredCandidate, TopicStatus } from "./types";
import type { ExistingTitleIndex } from "./dedup";
import { toDedupKey } from "./normalize";
import { canonicalAssetKey } from "./canonical-identity";

export async function getExistingTitleIndex(db: D1Database): Promise<ExistingTitleIndex> {
  const [topics, posts] = await Promise.all([
    db.prepare(
      "SELECT title, normalized_key, instrument_key, related_course_slug, audience, level, modifier_type FROM content_topics WHERE status != 'rejected'"
    ).all<{
      title: string;
      normalized_key: string;
      instrument_key: string | null;
      related_course_slug: string | null;
      audience: string;
      level: string;
      modifier_type: ContentTopicRow["modifier_type"];
    }>(),
    db.prepare("SELECT title FROM blog_posts").all<{ title: string }>()
  ]);

  const normalizedKeys = new Set<string>(topics.results.map((r) => r.normalized_key));
  const canonicalKeys = new Set<string>(
    topics.results.map((row) => canonicalAssetKey({
      title: row.title,
      normalizedKey: row.normalized_key,
      instrumentKey: row.instrument_key,
      relatedCourseSlug: row.related_course_slug,
      audience: row.audience as "" | "کودک" | "نوجوان" | "بزرگسال",
      level: row.level as "" | "مبتدی" | "متوسط" | "پیشرفته",
      modifierType: row.modifier_type,
      intent: "informational",
      source: "stored"
    }))
  );
  const titles = [
    ...topics.results.map((r) => r.title),
    ...posts.results.map((r) => r.title)
  ];
  // blog_posts has no normalized_key/canonical metadata, so derive only the
  // exact normalized title key from published or draft posts.
  for (const post of posts.results) normalizedKeys.add(toDedupKey(post.title));
  return { normalizedKeys, canonicalKeys, titles };
}

export async function getCoverageByCourse(db: D1Database): Promise<Map<string, number>> {
  const coverage = new Map<string, number>();
  const bump = (slug: string | null, by: number) => {
    const key = slug ?? "__general__";
    coverage.set(key, (coverage.get(key) ?? 0) + by);
  };
  // Coverage is real published content only. Candidate/approved topic rows are
  // opportunities, not content coverage; counting them here suppresses valid
  // gaps before an article actually exists.
  const posts = await db.prepare(
    "SELECT related_course_slug AS slug, COUNT(*) AS n FROM blog_posts WHERE status = 'published' GROUP BY related_course_slug"
  ).all<{ slug: string | null; n: number }>();
  for (const row of posts.results) bump(row.slug, row.n);
  return coverage;
}

export async function getRecentlyUsedCourses(db: D1Database, withinDays = 21): Promise<Set<string>> {
  const cutoff = new Date(Date.now() - withinDays * 86_400_000).toISOString();
  const [topics, posts] = await Promise.all([
    db.prepare("SELECT DISTINCT related_course_slug AS slug FROM content_topics WHERE status = 'used' AND used_at >= ?")
      .bind(cutoff).all<{ slug: string | null }>(),
    db.prepare("SELECT DISTINCT related_course_slug AS slug FROM blog_posts WHERE status = 'published' AND created_at >= ?")
      .bind(cutoff).all<{ slug: string | null }>()
  ]);
  const out = new Set<string>();
  for (const row of [...topics.results, ...posts.results]) if (row.slug) out.add(row.slug);
  return out;
}

export async function createRun(db: D1Database): Promise<number> {
  const result = await db.prepare("INSERT INTO content_topic_runs (status) VALUES ('running')").run();
  return Number(result.meta.last_row_id);
}

export async function finishRun(
  db: D1Database,
  runId: number,
  summary: { status: "success" | "failed"; generated: number; afterDedup: number; approved: number; error?: string }
): Promise<void> {
  await db
    .prepare(
      `UPDATE content_topic_runs
       SET finished_at = datetime('now'), status = ?, candidates_generated = ?, candidates_after_dedup = ?, candidates_approved = ?, error_message = ?
       WHERE id = ?`
    )
    .bind(summary.status, summary.generated, summary.afterDedup, summary.approved, summary.error ?? null, runId)
    .run();
}

export async function insertScoredCandidates(db: D1Database, candidates: ScoredCandidate[], runId: number): Promise<number> {
  if (candidates.length === 0) return 0;
  const autoApproveThreshold = 55;
  // A rejected topic may legitimately be reconsidered on a later run.
  // Because normalized_key is unique, revive rejected rows before the insert;
  // INSERT OR IGNORE alone would silently keep the old rejected row forever.
  const targetStatus = (c: ScoredCandidate) => c.scoreTotal >= autoApproveThreshold ? "approved" : "candidate";
  const statements = [];
  for (const c of candidates) {
    const status = targetStatus(c);
    statements.push(
      db.prepare(
        `UPDATE content_topics
         SET title=?, instrument_key=?, related_course_slug=?, related_course_title=?, category=?,
             audience=?, level=?, modifier_type=?, intent=?, score_total=?, score_breakdown=?,
             reasoning=?, status=?, source=?, run_id=?, updated_at=datetime('now'), used_by_post_id=NULL, used_at=NULL
         WHERE normalized_key=? AND status='rejected'`
      ).bind(
        c.title,
        c.instrumentKey,
        c.relatedCourseSlug,
        c.relatedCourseTitle,
        c.category,
        c.audience,
        c.level,
        c.modifierType,
        c.intent,
        c.scoreTotal,
        JSON.stringify(c.scoreBreakdown),
        c.reasoning,
        status,
        c.source,
        runId,
        c.normalizedKey
      )
    );
    statements.push(
      db.prepare(
        `INSERT OR IGNORE INTO content_topics
         (title, normalized_key, instrument_key, related_course_slug, related_course_title, category,
          audience, level, modifier_type, intent, score_total, score_breakdown, reasoning, status, source, run_id)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      ).bind(
        c.title,
        c.normalizedKey,
        c.instrumentKey,
        c.relatedCourseSlug,
        c.relatedCourseTitle,
        c.category,
        c.audience,
        c.level,
        c.modifierType,
        c.intent,
        c.scoreTotal,
        JSON.stringify(c.scoreBreakdown),
        c.reasoning,
        status,
        c.source,
        runId
      )
    );
  }
  const results = await db.batch(statements);
  let changed = 0;
  for (let index = 0; index < results.length; index += 2) {
    // Count each candidate exactly once when either the rejected row was
    // revived or a new row was inserted.
    const revived = Number(results[index]?.meta?.changes || 0) > 0;
    const inserted = Number(results[index + 1]?.meta?.changes || 0) > 0;
    if (revived || inserted) changed += 1;
  }
  return changed;
}

export interface TopicListFilters {
  status?: TopicStatus;
  limit?: number;
}

export async function listTopics(db: D1Database, filters: TopicListFilters = {}): Promise<ContentTopicRow[]> {
  const limit = filters.limit ?? 200;
  if (filters.status) {
    const result = await db
      .prepare("SELECT * FROM content_topics WHERE status = ? ORDER BY score_total DESC, created_at DESC LIMIT ?")
      .bind(filters.status, limit)
      .all<ContentTopicRow>();
    return result.results;
  }
  const result = await db
    .prepare("SELECT * FROM content_topics ORDER BY score_total DESC, created_at DESC LIMIT ?")
    .bind(limit)
    .all<ContentTopicRow>();
  return result.results;
}

export async function updateTopicStatus(db: D1Database, id: number, status: TopicStatus): Promise<void> {
  await db.prepare("UPDATE content_topics SET status = ?, updated_at = datetime('now') WHERE id = ?").bind(status, id).run();
}

export async function deleteTopic(db: D1Database, id: number): Promise<void> {
  await db.prepare("DELETE FROM content_topics WHERE id = ?").bind(id).run();
}

export async function getNextApprovedTopic(db: D1Database): Promise<ContentTopicRow | null> {
  const row = await db
    .prepare("SELECT * FROM content_topics WHERE status = 'approved' ORDER BY score_total DESC, created_at ASC LIMIT 1")
    .first<ContentTopicRow>();
  return row ?? null;
}

/**
 * Atomically claim one approved topic before an AI generation run.
 * Two concurrent workers may read the same candidate, but only one can
 * transition it from approved -> generating.
 */
export async function resetStaleGeneratingTopics(db: D1Database, maxAgeHours = 6): Promise<number> {
  const hours = Math.max(1, Number(maxAgeHours) || 6);
  const result = await db.prepare(
    "UPDATE content_topics SET status='approved', updated_at=datetime('now') WHERE status='generating' AND used_by_post_id IS NULL AND updated_at < datetime('now', ?)"
  ).bind(`-${hours} hours`).run();
  return Number(result.meta?.changes || 0);
}

export async function claimNextApprovedTopic(db: D1Database, attempts = 3): Promise<ContentTopicRow | null> {
  await resetStaleGeneratingTopics(db);

  for (let attempt = 0; attempt < Math.max(1, attempts); attempt += 1) {
    const candidate = await getNextApprovedTopic(db);
    if (!candidate) return null;

    const claimed = await db
      .prepare("UPDATE content_topics SET status='generating', updated_at=datetime('now') WHERE id=? AND status='approved'")
      .bind(candidate.id)
      .run();

    if (Number(claimed.meta?.changes || 0) === 1) {
      return { ...candidate, status: "generating", updated_at: new Date().toISOString() };
    }
  }
  return null;
}

export async function releaseGeneratingTopic(db: D1Database, id: number): Promise<void> {
  await db
    .prepare("UPDATE content_topics SET status='approved', updated_at=datetime('now') WHERE id=? AND status='generating'")
    .bind(id)
    .run();
}

export async function markTopicUsed(db: D1Database, id: number, postId: number): Promise<void> {
  await db
    .prepare("UPDATE content_topics SET status = 'used', used_at = datetime('now'), used_by_post_id = ?, updated_at = datetime('now') WHERE id = ?")
    .bind(postId, id)
    .run();
}
