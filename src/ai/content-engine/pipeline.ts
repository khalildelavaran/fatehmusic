// Topic discovery: generate -> dedup -> search-demand enrich -> score -> persist.
import { generateCandidates } from "./candidates";
import { dedupWithinBatch, filterAgainstExisting } from "./dedup";
import { scoreCandidates } from "./scoring";
import {
  createRun, finishRun, getCoverageByCourse, getExistingTitleIndex,
  getRecentlyUsedCourses, insertScoredCandidates
} from "./db";
import { D1SearchConsoleKeywordProvider } from "./providers/gsc-keyword";
import type { DiscoveryRunSummary } from "./types";
import type { KeywordProvider } from "./providers/keyword-provider";

export interface RunDiscoveryOptions {
  keywordProvider?: KeywordProvider;
}

export async function runTopicDiscovery(db: D1Database, options: RunDiscoveryOptions = {}): Promise<DiscoveryRunSummary> {
  const keywordProvider = options.keywordProvider ?? new D1SearchConsoleKeywordProvider({ db });
  const runId = await createRun(db);

  try {
    const generated = dedupWithinBatch(generateCandidates());
    const [existingIndex, coverageByCourse, recentlyUsedCourses] = await Promise.all([
      getExistingTitleIndex(db),
      getCoverageByCourse(db),
      getRecentlyUsedCourses(db)
    ]);
    const afterDedup = filterAgainstExisting(generated, existingIndex);

    const signalEntries = await Promise.all(
      afterDedup.map(async (candidate) => [
        candidate.normalizedKey,
        await keywordProvider.lookup(candidate.title)
      ] as const)
    );

    const scored = scoreCandidates(afterDedup, {
      coverageByCourse,
      recentlyUsedCourses,
      keywordSignals: new Map(signalEntries)
    });

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
    await finishRun(db, runId, {
      status: "failed",
      generated: 0,
      afterDedup: 0,
      approved: 0,
      error: message
    });
    return {
      runId,
      candidatesGenerated: 0,
      candidatesAfterDedup: 0,
      candidatesApproved: 0,
      status: "failed",
      errorMessage: message
    };
  }
}
