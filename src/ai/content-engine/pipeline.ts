// Orchestrates one full topic-discovery run: generate -> dedup -> score
// -> persist. This is the function the admin "تولید موضوعات جدید" button
// and (optionally, later) a cron trigger call. Kept as a single plain
// async function -- matching the existing single-function-call simplicity
// of generateDailyPost() in ai-post-generator.ts, not a job-queue system.

import { generateCandidates } from "./candidates";
import { dedupWithinBatch, filterAgainstExisting } from "./dedup";
import { scoreCandidates } from "./scoring";
import {
  createRun, finishRun, getCoverageByCourse, getExistingTitleIndex,
  getRecentlyUsedCourses, insertScoredCandidates
} from "./db";
import { NullKeywordProvider, type KeywordProvider } from "./providers/keyword-provider";
import type { DiscoveryRunSummary } from "./types";

export interface RunDiscoveryOptions {
  keywordProvider?: KeywordProvider;
}

export async function runTopicDiscovery(db: D1Database, options: RunDiscoveryOptions = {}): Promise<DiscoveryRunSummary> {
  const keywordProvider = options.keywordProvider ?? new NullKeywordProvider();
  const runId = await createRun(db);

  try {
    const generated = dedupWithinBatch(generateCandidates());

    const [existingIndex, coverageByCourse, recentlyUsedCourses] = await Promise.all([
      getExistingTitleIndex(db),
      getCoverageByCourse(db),
      getRecentlyUsedCourses(db)
    ]);

    const afterDedup = filterAgainstExisting(generated, existingIndex);

    // A single neutral keyword signal is looked up once (not per-title)
    // since NullKeywordProvider always returns the same "unavailable"
    // result and a real provider would be rate-limited -- see ADR-011
    // for how to make this per-title once a real provider is wired in.
    const keywordSignal = await keywordProvider.lookup("موسیقی");

    const scored = scoreCandidates(afterDedup, { coverageByCourse, recentlyUsedCourses, keywordSignal });
    const approvedCount = scored.filter((c) => c.scoreTotal >= 55).length;

    await insertScoredCandidates(db, scored, runId);
    await finishRun(db, runId, {
      status: "success",
      generated: generated.length,
      afterDedup: afterDedup.length,
      approved: approvedCount
    });

    return {
      runId,
      candidatesGenerated: generated.length,
      candidatesAfterDedup: afterDedup.length,
      candidatesApproved: approvedCount,
      status: "success"
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await finishRun(db, runId, { status: "failed", generated: 0, afterDedup: 0, approved: 0, error: message });
    return { runId, candidatesGenerated: 0, candidatesAfterDedup: 0, candidatesApproved: 0, status: "failed", errorMessage: message };
  }
}
