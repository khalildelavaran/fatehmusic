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
      "SELECT title, normalized_key, instrument_key, related_course_slug, audience, level, modifier_type FROM content_topics WHERE status != 'rejected' OR updated_at >= datetime('now', '-30 days')"
    ).all<{
      title: string;
      normalized_key: string;
      instrument_key: string | null;
      related_course_slug: string | null;
      audience: string;
      level: string;
      modifier_type: ContentTopicRow["modifier_type"];
    }>(),
    db.prepare(
      "SELECT title, related_course_slug FROM blog_posts WHERE title IS NOT NULL AND title != ''"
    ).all<{ title: string; related_course_slug: string | null }>()
  ]);

  const normalizedKeys = new Set<string>(topics.results.map((r) => r.normalized_key));
  const canonicalKeys = new Set<string>(
    topics.results.map((row) => canonicalAssetKey({
      title: row.title,
      instrumentKey: row.instrument_key,
      relatedCourseSlug: row.related_course_slug,
      audience: row.audience as "" | "کودک" | "نوجوان" | "بزرگسال",
      level: row.level as "" | "مبتدی" | "متوسط" | "پیشرفته",
      modifierType: row.modifier_type
    }))
  );
  const titles = [
    ...topics.results.map((r) => r.title),
    ...posts.results.map((r) => r.title)
  ];

  // Legacy blog_posts rows do not have modifier_type. For the one angle where
  // title semantics are stable and intentionally generated from a seed family,
  // reserve the course when an existing post is explicitly local to Shushtar.
  // This avoids suppressing unrelated course articles.
  const localShushtarCourseSlugs = new Set<string>();
  for (const post of posts.results) {
    if (
      post.related_course_slug &&
      /شوشتر/u.test(post.title)
    ) {
      localShushtarCourseSlugs.add(post.related_course_slug);
    }
  }
  // blog_posts has no normalized_key/canonical metadata, so derive the exact
  // normalized title key from every retained post. Drafts matter here too:
  // a human-edited draft must reserve its title just like an AI-generated draft.
  for (const post of posts.results) normalizedKeys.add(toDedupKey(post.title));
  return { normalizedKeys, canonicalKeys, titles, localShushtarCourseSlugs };
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
    db.prepare(
      "SELECT DISTINCT t.related_course_slug AS slug FROM content_topics t " +
      "JOIN blog_posts p ON p.id = t.used_by_post_id " +
      "WHERE t.status = 'used' AND t.used_at >= ? AND p.status = 'published'"
    ).bind(cutoff).all<{ slug: string | null }>(),
    db.prepare("SELECT DISTINCT related_course_slug AS slug FROM blog_posts WHERE status = 'published' AND published_at IS NOT NULL AND published_at >= ?")
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

export async function insertScoredCandidates(
  db: D1Database,
  candidates: ScoredCandidate[],
  runId: number,
  limit = 20
): Promise<{ inserted: number; newlyApproved: number }> {
  if (candidates.length === 0) return { inserted: 0, newlyApproved: 0 };
  const autoApproveThreshold = 55;
  // Keep the default discovery write footprint safe for Workers Free. The
  // scored queue is intentionally larger than the persisted queue, so future
  // runs can reconsider the rest as search signals change.
  const persistLimit = Math.max(1, Math.min(Number(limit) || 20, 40));
  const persistableCandidates = candidates.slice(0, persistLimit);

  // Snapshot existing states before the UPSERT so run history can distinguish
  // newly-approved topics from topics that were already approved/used.
  const existingStatuses = new Map<string, string>();
  const uniqueKeys = [...new Set(persistableCandidates.map((candidate) => candidate.normalizedKey))];
  for (let offset = 0; offset < uniqueKeys.length; offset += 50) {
    const chunk = uniqueKeys.slice(offset, offset + 50);
    const placeholders = chunk.map(() => "?").join(",");
    const rows = await db.prepare(
      "SELECT normalized_key, status FROM content_topics WHERE normalized_key IN (" + placeholders + ")"
    ).bind(...chunk).all<{ normalized_key: string; status: string }>();
    for (const row of rows.results || []) {
      existingStatuses.set(row.normalized_key, row.status);
    }
  }

  // One conditional UPSERT per candidate. Existing approved/used topics keep
  // their lifecycle state; rejected/candidate topics may be refreshed.
  const statements = persistableCandidates.map((c) => {
    const status = c.scoreTotal >= autoApproveThreshold ? "approved" : "candidate";
    return db.prepare(
      "INSERT INTO content_topics " +
      "(title, normalized_key, instrument_key, related_course_slug, related_course_title, category, " +
      "audience, level, modifier_type, intent, score_total, score_breakdown, reasoning, status, source, run_id) " +
      "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) " +
      "ON CONFLICT(normalized_key) DO UPDATE SET " +
      "title=excluded.title, instrument_key=excluded.instrument_key, related_course_slug=excluded.related_course_slug, " +
      "related_course_title=excluded.related_course_title, category=excluded.category, audience=excluded.audience, " +
      "level=excluded.level, modifier_type=excluded.modifier_type, intent=excluded.intent, score_total=excluded.score_total, " +
      "score_breakdown=excluded.score_breakdown, reasoning=excluded.reasoning, " +
      "status=CASE WHEN content_topics.status IN ('approved', 'generating', 'drafted', 'used') THEN content_topics.status ELSE excluded.status END, " +
      "source=excluded.source, run_id=excluded.run_id, updated_at=datetime('now'), " +
      "used_by_post_id=CASE WHEN content_topics.status='used' THEN content_topics.used_by_post_id ELSE NULL END, " +
      "used_at=CASE WHEN content_topics.status='used' THEN content_topics.used_at ELSE NULL END"
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
    );
  });

  const results = await db.batch(statements);
  const inserted = results.reduce((sum, result) =>
    sum + (Number(result.meta?.changes || 0) > 0 ? 1 : 0), 0
  );

  const newlyApproved = persistableCandidates.reduce((sum, candidate) => {
    const previousStatus = existingStatuses.get(candidate.normalizedKey);
    const isNewApproval = candidate.scoreTotal >= autoApproveThreshold &&
      previousStatus !== "approved" &&
      previousStatus !== "generating" &&
      previousStatus !== "drafted" &&
      previousStatus !== "used";
    return sum + (isNewApproval ? 1 : 0);
  }, 0);

  return { inserted, newlyApproved };
}
export async function getRunApprovedCount(db: D1Database, runId: number): Promise<number> {
  const row = await db.prepare(
    "SELECT COUNT(*) AS count FROM content_topics WHERE run_id = ? AND status = 'approved'"
  ).bind(runId).first<{ count: number }>();
  return Number(row?.count || 0);
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

/**
 * Atomically claim ONE specific topic (chosen by an admin from the UI) for AI
 * generation. Only approved/candidate topics can be claimed; anything already
 * generating, drafted, used or rejected returns null.
 */
export async function claimTopicById(db: D1Database, id: number): Promise<ContentTopicRow | null> {
  await resetStaleGeneratingTopics(db);
  const row = await db
    .prepare("SELECT * FROM content_topics WHERE id = ? AND status IN ('approved','candidate')")
    .bind(id)
    .first<ContentTopicRow>();
  if (!row) return null;

  const claimed = await db
    .prepare("UPDATE content_topics SET status='generating', updated_at=datetime('now') WHERE id=? AND status IN ('approved','candidate')")
    .bind(id)
    .run();
  if (Number(claimed.meta?.changes || 0) !== 1) return null;
  return { ...row, status: "generating", updated_at: new Date().toISOString() };
}

export async function releaseGeneratingTopic(db: D1Database, id: number): Promise<void> {
  await db
    .prepare("UPDATE content_topics SET status='approved', updated_at=datetime('now') WHERE id=? AND status='generating'")
    .bind(id)
    .run();
}

export async function markTopicDrafted(db: D1Database, id: number, postId: number): Promise<void> {
  await db
    .prepare("UPDATE content_topics SET status='drafted', used_at=NULL, used_by_post_id=?, updated_at=datetime('now') WHERE id=? AND status='generating'")
    .bind(postId, id)
    .run();
}

export async function markTopicPublished(db: D1Database, postId: number): Promise<number> {
  const result = await db
    .prepare("UPDATE content_topics SET status='used', used_at=datetime('now'), updated_at=datetime('now') WHERE used_by_post_id=? AND status='drafted'")
    .bind(postId)
    .run();
  return Number(result.meta?.changes || 0);
}

export async function markTopicDraftPost(db: D1Database, postId: number): Promise<number> {
  const result = await db
    .prepare("UPDATE content_topics SET status='drafted', used_at=NULL, updated_at=datetime('now') WHERE used_by_post_id=? AND status='used'")
    .bind(postId)
    .run();
  return Number(result.meta?.changes || 0);
}

export async function releaseTopicForDeletedPost(db: D1Database, postId: number): Promise<number> {
  const result = await db
    .prepare("UPDATE content_topics SET status='approved', used_by_post_id=NULL, used_at=NULL, updated_at=datetime('now') WHERE used_by_post_id=? AND status IN ('drafted', 'used')")
    .bind(postId)
    .run();
  return Number(result.meta?.changes || 0);
}

export async function markTopicUsed(db: D1Database, postId: number): Promise<number> {
  return markTopicPublished(db, postId);
}

export async function releaseDraftedTopic(db: D1Database, postId: number): Promise<number> {
  return releaseTopicForDeletedPost(db, postId);
}

