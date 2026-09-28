import { describe, expect, it } from "vitest";
import { getSchemaTypeDefinition, isKnownSchemaType, schemaRegistryStatistics, validateSchemaTypes } from "./registry.js";

describe("Schema Registry", () => {
  it("recognizes all core types used by the SEO engine", () => {
    for (const type of ["Organization", "LocalBusiness", "WebSite", "WebPage", "Course", "Person", "Article", "FAQPage", "ImageGallery"]) {
      expect(isKnownSchemaType(type)).toBe(true);
      expect(getSchemaTypeDefinition(type)).toBeTruthy();
    }
  });

  it("rejects unknown schema types", () => {
    const result = validateSchemaTypes([
      { "@id": "https://fatehmusic.ir/#x", "@type": "NotARealSchemaType" }
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("Unknown Schema.org type");
  });

  it("exposes immutable registry statistics", () => {
    const stats = schemaRegistryStatistics();
    expect(stats.typeCount).toBeGreaterThan(20);
    expect(stats.categories).toContain("Education");
  });
});
