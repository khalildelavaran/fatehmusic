/**
 * Canonical Schema.org type registry for the Fateh SEO engine.
 * Builders should only emit types registered here.
 */

export const SCHEMA_REGISTRY_VERSION = "5.1";

const DEFINITIONS = Object.freeze(Object.fromEntries(Object.entries({
  Thing: { parent: null, category: "Core" },
  Intangible: { parent: "Thing", category: "Core" },
  StructuredValue: { parent: "Intangible", category: "Core" },
  PropertyValue: { parent: "StructuredValue", category: "Core" },
  Organization: { parent: "Thing", category: "Organization" },
  EducationalOrganization: { parent: "Organization", category: "Education" },
  LocalBusiness: { parent: "Organization", category: "Location" },
  MusicSchool: { parent: "LocalBusiness", category: "Education" },
  Person: { parent: "Thing", category: "Person" },
  WebSite: { parent: "CreativeWork", category: "Navigation" },
  WebPage: { parent: "CreativeWork", category: "Navigation" },
  CollectionPage: { parent: "WebPage", category: "Navigation" },
  AboutPage: { parent: "WebPage", category: "Navigation" },
  ContactPage: { parent: "WebPage", category: "Navigation" },
  ProfilePage: { parent: "WebPage", category: "Navigation" },
  Article: { parent: "CreativeWork", category: "CreativeWork" },
  CreativeWork: { parent: "Thing", category: "CreativeWork" },
  Course: { parent: "CreativeWork", category: "Education" },
  CourseInstance: { parent: "Event", category: "Education" },
  Event: { parent: "Thing", category: "Events" },
  FAQPage: { parent: "WebPage", category: "SEO" },
  Question: { parent: "CreativeWork", category: "SEO" },
  Answer: { parent: "CreativeWork", category: "SEO" },
  BreadcrumbList: { parent: "ItemList", category: "Navigation" },
  ItemList: { parent: "Intangible", category: "Navigation" },
  ListItem: { parent: "Thing", category: "Navigation" },
  ImageGallery: { parent: "WebPage", category: "Media" },
  ImageObject: { parent: "CreativeWork", category: "Media" },
  VideoObject: { parent: "CreativeWork", category: "Media" },
  Offer: { parent: "Intangible", category: "Commerce" },
  Audience: { parent: "Intangible", category: "Education" },
  AdministrativeArea: { parent: "Place", category: "Location" },
  Place: { parent: "Thing", category: "Location" },
  PostalAddress: { parent: "ContactPoint", category: "Location" },
  ContactPoint: { parent: "StructuredValue", category: "Location" },
  Country: { parent: "AdministrativeArea", category: "Location" },
  City: { parent: "AdministrativeArea", category: "Location" },
  GeoCoordinates: { parent: "StructuredValue", category: "Location" },
  OpeningHoursSpecification: { parent: "StructuredValue", category: "Location" }
}).map(([type, definition]) => [type, Object.freeze({
  ...definition,
  type,
  version: SCHEMA_REGISTRY_VERSION,
  namespace: "https://schema.org"
})])));

export const SCHEMA_REGISTRY = DEFINITIONS;

export function isKnownSchemaType(type) {
  return typeof type === "string" && Boolean(DEFINITIONS[type]);
}

export function getSchemaTypeDefinition(type) {
  return isKnownSchemaType(type) ? DEFINITIONS[type] : null;
}

const REQUIRED_SCHEMA_FIELDS = Object.freeze({
  Organization: ["name", "url"],
  EducationalOrganization: ["name", "url"],
  LocalBusiness: ["name", "url"],
  MusicSchool: ["name", "url"],
  WebSite: ["name", "url", "publisher"],
  WebPage: ["name", "url"],
  Course: ["name", "description"],
  Person: ["name"],
  Article: ["headline", "author", "publisher"],
  ItemList: ["name", "itemListElement"],
  FAQPage: ["mainEntity"]
});

function hasSchemaValue(value) {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return typeof value === "object";
}

export function validateSchemaContracts(nodes = []) {
  const errors = [];

  for (const node of Array.isArray(nodes) ? nodes : []) {
    const types = Array.isArray(node?.["@type"]) ? node["@type"] : [node?.["@type"]];
    const applicableTypes = types.filter((type) => REQUIRED_SCHEMA_FIELDS[type]);

    for (const type of applicableTypes) {
      for (const field of REQUIRED_SCHEMA_FIELDS[type]) {
        if (!hasSchemaValue(node?.[field])) {
          errors.push(`Missing required schema field: ${type}.${field}`);
        }
      }
    }
  }

  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze(errors)
  });
}

export function validateSchemaTypes(nodes = []) {
  const errors = [];

  for (const node of Array.isArray(nodes) ? nodes : []) {
    const types = Array.isArray(node?.["@type"]) ? node["@type"] : [node?.["@type"]];
    for (const type of types.filter(Boolean)) {
      if (!isKnownSchemaType(type)) {
        errors.push("Unknown Schema.org type: " + type);
      }
    }
  }

  return Object.freeze({
    valid: errors.length === 0,
    errors
  });
}

export function schemaRegistryStatistics() {
  return Object.freeze({
    version: SCHEMA_REGISTRY_VERSION,
    typeCount: Object.keys(DEFINITIONS).length,
    categories: Object.freeze([...new Set(Object.values(DEFINITIONS).map((item) => item.category))].sort())
  });
}
