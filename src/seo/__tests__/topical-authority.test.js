import { describe, expect, it } from "vitest";
import { resolveSite, buildLocalPlaceSchema } from "../index.js";
import { buildSiteLinkCandidates } from "../v2/site-graph.js";
import { buildInternalLinkPlan } from "../v2/internal-links.js";

describe("Topical Authority graph", () => {
  it("creates a local Place entity tied to the canonical organization", () => {
    const site = resolveSite();
    const place = buildLocalPlaceSchema(site);

    expect(place["@type"]).toBe("Place");
    expect(place["@id"]).toContain("/locations/shushtar#place");
    expect(place.containedInPlace["@id"]).toBe(`${site.url}/#organization`);
  });

  it("contains only canonical public destinations", () => {
    const site = resolveSite();
    const candidates = buildSiteLinkCandidates(site);

    expect(candidates.some((item) => item.url === `${site.url}/locations/shushtar`)).toBe(true);
    expect(candidates.some((item) => /\/student\/|\/admin\/|\/dashboard\/|\/api\//.test(item.url))).toBe(false);
  });

  it("prioritizes local topical links for a location page", () => {
    const site = resolveSite();
    const candidates = buildSiteLinkCandidates(site);
    const links = buildInternalLinkPlan({
      currentUrl: `${site.url}/locations/shushtar`,
      currentTopics: ["shushtar", "music-education"],
      currentType: "Place",
      candidates
    });

    expect(links.length).toBeGreaterThan(0);
    expect(links.some((item) => item.url === `${site.url}/courses`)).toBe(true);
  });
});
