// Topic discovery: generate -> dedup -> search-demand enrich -> score -> persist.
import { generateCandidates } from "./candidates";
import { dedupWithinBatch, filterAgainstExisting } from "./dedup";
import { scoreCandidates } from "./scoring";
import {
  createRun, finishRun, getCoverageByCourse, getExistingTitleIndex,
  getRecentlyUsedCourses, insertScoredCandidates
} from "./db";
import { D1SearchConsoleKeywordProvider } from "./providers/gsc-keyword";
import { HybridKeywordProvider } from "./providers/hybrid-keyword";
import type { DiscoveryRunSummary } from "./types";
import type { KeywordProvider } from "./providers/keyword-provider";

export interface RunDiscoveryOptions {
  keywordProvider?: KeywordProvider;
  env?: Record<string, unknown>;
}

export async function runTopicDiscovery(db: D1Database, options: RunDiscoveryOptions = {}): Promise<DiscoveryRunSummary> {
  const keywordProvider = options.keywordProvider ?? (options.env?.AHREFS_API_KEY ? new HybridKeywordProvider(db, options.env) : new D1SearchConsoleKeywordProvider({ db }));
  const runId = await createRun(db);
  let generated: ReturnType<typeof dedupWithinBatch> = [];
  let afterDedup: typeof generated = [];

  try {
    generated = dedupWithinBatch(generateCandidates());
    const [existingIndex, coverageByCourse, recentlyUsedCourses] = await Promise.all([
      getExistingTitleIndex(db),
      getCoverageByCourse(db),
      getRecentlyUsedCourses(db)
    ]);
    afterDedup = filterAgainstExisting(generated, existingIndex);

    let keywordSignals = new Map<string, Awaited<ReturnType<KeywordProvider["lookup"]>>>();
    const titles = afterDedup.map((candidate) => candidate.title);
    const batchProvider = keywordProvider as KeywordProvider & {
      lookupMany?: (items: string[]) => Promise<Awaited<ReturnType<KeywordProvider["lookup"]>>[]>;
    };

    try {
      if (typeof batchProvider.lookupMany === "function") {
        const results = await batchProvider.lookupMany(titles);
        afterDedup.forEach((candidate, index) => keywordSignals.set(
          candidate.normalizedKey,
          results[index] || { available: false, source: "none" }
        ));
      } else {
        const signalEntries = await Promise.all(
          afterDedup.map(async (candidate) => [
            candidate.normalizedKey,
            await keywordProvider.lookup(candidate.title)
          ] as const)
        );
        keywordSignals = new Map(signalEntries);
      }
    } catch (error) {
      // Search-demand intelligence is enrichment. A provider outage must not
      // prevent the deterministic topic queue from refreshing.
      console.warn("[topic-discovery] keyword provider unavailable; scoring without demand:", error);
      keywordSignals = new Map(
        afterDedup.map((candidate) => [
          candidate.normalizedKey,
          { available: false, source: "unavailable" }
        ])
      );
    }

    const scored = scoreCandidates(afterDedup, {
      coverageByCourse,
      recentlyUsedCourses,
      keywordSignals
    });

    await insertScoredCandidates(db, scored, runId);
    // Report only rows actually approved by the persistence step. A scored
    // candidate may already exist as candidate/approved/used and therefore be
    // intentionally left untouched by the conditional UPSERT.
    const approvedCount = scored.filter((candidate) => candidate.scoreTotal >= 55).length;
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
      generated: generated.length,
      afterDedup: afterDedup.length,
      approved: 0,
      error: message
    });
    return {
      runId,
      candidatesGenerated: generated.length,
      candidatesAfterDedup: afterDedup.length,
      candidatesApproved: 0,
      status: "failed",
      errorMessage: message
    };
  }
}
