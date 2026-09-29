import { describe, expect, it } from "vitest";
import { SCHEMA_REGISTRY_VERSION, getSchemaTypeDefinition, isKnownSchemaType, schemaRegistryStatistics, validateSchemaTypes, validateSchemaContracts } from "./registry.js";

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


  it("rejects incomplete core entity contracts", () => {
    const result = validateSchemaContracts([
      { "@id": "https://fatehmusic.ir/#course", "@type": "Course", name: "دوره" },
      { "@id": "https://fatehmusic.ir/#person", "@type": "Person" }
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Missing required schema field: Course.description");
    expect(result.errors).toContain("Missing required schema field: Person.name");
  });

  it("accepts the core fields emitted by the production builders", () => {
    const result = validateSchemaContracts([
      { "@id": "https://fatehmusic.ir/#org", "@type": "Organization", name: "فاتح", url: "https://fatehmusic.ir" },
      { "@id": "https://fatehmusic.ir/#course", "@type": "Course", name: "گیتار", description: "شرح دوره" },
      { "@id": "https://fatehmusic.ir/#article", "@type": "Article", headline: "راهنما", author: { "@id": "https://fatehmusic.ir/#person" }, publisher: { "@id": "https://fatehmusic.ir/#org" } }
    ]);
    expect(result.valid).toBe(true);
  });

  it("exposes immutable registry statistics", () => {
    const stats = schemaRegistryStatistics();
    expect(stats.version).toBe(SCHEMA_REGISTRY_VERSION);
    expect(stats.typeCount).toBeGreaterThan(20);
    expect(stats.categories).toContain("Education");
    expect(getSchemaTypeDefinition("Course").namespace).toBe("https://schema.org");
  });
});
