import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("SEO dashboard architecture", () => {
  it("keeps the admin request path on the lightweight read model", () => {
    const path = resolve(process.cwd(), "src/pages/admin/content-strategy.astro");
    const source = readFileSync(path, "utf8");

    expect(source).toContain("getSeoDashboardIntelligence");
    expect(source).not.toContain("buildSEOIntelligence");
    expect(source).not.toContain("getRecentSearchConsoleRows");
    expect(source).not.toContain("buildAhrefsKeywordSignalMap");
  });
});
