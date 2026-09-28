/**
 * Compile explicit knowledge-graph relationships into JSON-LD properties.
 * Existing builder values win; graph edges only fill missing relationships.
 */

const EDGE_PROPERTY_MAP = Object.freeze({
  publisher: { owner: "publisher" },
  provider: { owner: "provider" },
  worksFor: { owner: "worksFor" },
  location: { owner: "location" },
  about: { owner: "about" },
  teaches: { owner: "teaches" }
});

function asReference(id) {
  return id ? { "@id": id } : null;
}

function appendReference(existing, id) {
  const ref = asReference(id);
  if (!ref) return existing;

  if (!existing) return ref;
  const values = Array.isArray(existing) ? existing : [existing];
  if (values.some((item) => item?.["@id"] === id)) return existing;
  return [...values, ref];
}

export function compileKnowledgeGraphEdges(schemaNodes = [], knowledgeGraph = null) {
  const nodes = Array.isArray(schemaNodes) ? schemaNodes.map((node) => ({ ...node })) : [];
  const byId = new Map(nodes.map((node) => [node?.["@id"], node]).filter(([id]) => id));

  for (const edge of knowledgeGraph?.edges || []) {
    const mapping = EDGE_PROPERTY_MAP[edge?.relation];
    if (!mapping || !edge?.from || !edge?.to) continue;

    const owner = byId.get(edge.from);
    if (!owner || !byId.has(edge.to)) continue;

    const property = mapping.owner;
    owner[property] = appendReference(owner[property], edge.to);
  }

  return Object.freeze(nodes);
}
