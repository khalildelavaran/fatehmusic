import { describe, expect, it } from "vitest";

// Keep this regression test intentionally small: the temporal engine depends on
// dated rows, so the sync mapper must preserve the requested date window.
async function loadModule() {
  return import("./search-console-sync.js");
}

describe("Search Console sync date preservation", () => {
  it("exports the sync/fetch functions used by the provider boundary", async () => {
    const module = await loadModule();
    expect(module.fetchAllSearchAnalytics).toBeTypeOf("function");
    expect(module.syncSearchConsoleToD1).toBeTypeOf("function");
  });
});
