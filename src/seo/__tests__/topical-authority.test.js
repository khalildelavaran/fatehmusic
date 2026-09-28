import { describe, expect, it } from "vitest";
import { resolveSite, buildLocalPlaceSchema } from "../index.js";
import { buildSiteLinkCandidates } from "../v2/site-graph.js";
import { buildInternalLinkPlan } from "../v2/internal-links.js";

describe("Topical Authority graph", () => {
  it("creates a canonical LocalBusiness entity tied to the organization", () => {
    const site = resolveSite();
    const place = buildLocalPlaceSchema(site);

    expect(place["@type"]).toBe("LocalBusiness");
    expect(place["@id"]).toContain("/locations/shushtar#localbusiness");
    expect(place.parentOrganization["@id"]).toBe(`${site.url}/#organization`);
    expect(place.address["@type"]).toBe("PostalAddress");
    expect(place.geo["@type"]).toBe("GeoCoordinates");
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
      currentType: "LocalBusiness",
      candidates
    });

    expect(links.length).toBeGreaterThan(0);
    expect(links.some((item) => item.url === `${site.url}/courses`)).toBe(true);
  });
});
