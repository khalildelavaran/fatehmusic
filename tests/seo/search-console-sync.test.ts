import { describe, expect, it } from "vitest";
import { conflictTargetForTable } from "../../src/seo/v2/providers/search-console-sync.js";

describe("Search Console snapshot upsert keys", () => {
  it("uses snapshot_label for staging rows", () => {
    expect(conflictTargetForTable("gsc_search_signals_staging"))
      .toContain("snapshot_label");
  });

  it("keeps live GSC uniqueness independent of snapshot label", () => {
    expect(conflictTargetForTable("gsc_search_signals_v2"))
      .not.toContain("snapshot_label");
  });
});
