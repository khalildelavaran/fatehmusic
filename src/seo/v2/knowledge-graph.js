/**
 * Explicit semantic knowledge graph for SEO intelligence.
 * JSON-LD is a publication format; this graph is the reasoning model.
 */

import { articleEntityId, courseEntityId, instructorEntityId } from "../geo/entity.js";

function absoluteUrl(path, siteUrl) {
  return String(path || "").startsWith("http")
    ? String(path)
    : String(siteUrl || "").replace(/\/$/, "") +
      (String(path || "").startsWith("/") ? "" : "/") +
      String(path || "").replace(/^\//, "");
}

function freezeArray(value = []) {
  return Object.freeze(Array.isArray(value) ? value : []);
}

export function buildKnowledgeGraph({
  siteUrl = "",
  courses = [],
  instructors = [],
  posts = []
} = {}) {
  const base = String(siteUrl || "").replace(/\/$/, "");
  const nodes = [];
  const edges = [];
  const nodeIds = new Set();
  const edgeKeys = new Set();

  const addNode = (node) => {
    if (!node?.id || nodeIds.has(node.id)) return;
    nodeIds.add(node.id);
    nodes.push(Object.freeze({
      ...node,
      topics: freezeArray(node.topics),
      properties: Object.freeze(node.properties || {})
    }));
  };

  const addEdge = (from, relation, to, confidence = 1) => {
    if (!from || !to || !nodeIds.has(from) || !nodeIds.has(to)) return;
    const key = from + "|" + relation + "|" + to;
    if (edgeKeys.has(key)) return;
    edgeKeys.add(key);
    edges.push(Object.freeze({
      from,
      relation,
      to,
      confidence: Math.max(0, Math.min(1, Number(confidence) || 0))
    }));
  };

  const organizationId = base + "/#organization";
  const websiteId = base + "/#website";
  const locationId = base + "/locations/shushtar#localbusiness";

  addNode({ id: organizationId, type: "Organization", name: "آموزشگاه موسیقی فاتح", url: base, topics: ["music-education", "shushtar"] });
  addNode({ id: websiteId, type: "WebSite", name: "آموزشگاه موسیقی فاتح", url: base });
  addNode({ id: locationId, type: "LocalBusiness", name: "آموزشگاه موسیقی فاتح شوشتر", url: absoluteUrl("/locations/shushtar", base), topics: ["shushtar"] });
  addEdge(websiteId, "publisher", organizationId);
  addEdge(organizationId, "location", locationId);

  for (const instructor of instructors || []) {
    if (!instructor?.slug || !instructor?.name) continue;
    const instructorId = instructorEntityId(absoluteUrl("/instructors/" + instructor.slug, base));
    addNode({
      id: instructorId,
      type: "Person",
      name: instructor.name,
      url: absoluteUrl("/instructors/" + instructor.slug, base),
      topics: instructor.professional?.roles || []
    });
    addEdge(instructorId, "worksFor", organizationId);
  }

  for (const course of courses || []) {
    if (!course?.slug || !course?.title) continue;
    const courseId = courseEntityId(absoluteUrl("/courses/" + course.slug, base));
    addNode({
      id: courseId,
      type: "Course",
      name: course.title,
      url: absoluteUrl("/courses/" + course.slug, base),
      topics: [course.instrument, course.category].filter(Boolean)
    });
    addEdge(courseId, "provider", organizationId);

    const instructorIds = Array.isArray(course.instructors)
      ? course.instructors
      : course.instructor ? [course.instructor] : [];

    for (const instructor of instructors || []) {
      if (!instructorIds.includes(instructor?.id)) continue;
      const instructorId = instructorEntityId(absoluteUrl("/instructors/" + instructor.slug, base));
      addEdge(instructorId, "teaches", courseId);
    }
  }

  for (const post of posts || []) {
    if (!post?.slug || !post?.title) continue;
    const postUrl = absoluteUrl("/blog/" + encodeURIComponent(post.slug), base);
    const articleId = articleEntityId(postUrl);
    addNode({
      id: articleId,
      type: "Article",
      name: post.title,
      url: postUrl,
      topics: [post.topic, post.related_course_slug].filter(Boolean)
    });
    addEdge(articleId, "publisher", organizationId);
    if (post.related_course_slug) {
      addEdge(articleId, "about", courseEntityId(absoluteUrl("/courses/" + post.related_course_slug, base)), 0.95);
    }
  }

  const inbound = new Map(nodes.map((node) => [node.id, 0]));
  const outbound = new Map(nodes.map((node) => [node.id, 0]));
  for (const edge of edges) {
    outbound.set(edge.from, (outbound.get(edge.from) || 0) + 1);
    inbound.set(edge.to, (inbound.get(edge.to) || 0) + 1);
  }

  return Object.freeze({
    version: "1.0",
    nodes: freezeArray(nodes),
    edges: freezeArray(edges),
    statistics: Object.freeze({
      nodeCount: nodes.length,
      edgeCount: edges.length,
      orphanNodeCount: nodes.filter((node) =>
        node.id !== organizationId &&
        node.id !== websiteId &&
        (inbound.get(node.id) || 0) + (outbound.get(node.id) || 0) === 0
      ).length,
      connectedNodeCount: nodes.filter((node) =>
        (inbound.get(node.id) || 0) + (outbound.get(node.id) || 0) > 0
      ).length
    })
  });
}

export function validateKnowledgeGraph(graph) {
  const graphNodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
  const graphEdges = Array.isArray(graph?.edges) ? graph.edges : [];
  const errors = [];
  const ids = new Set();

  for (const node of graphNodes) {
    if (!node || typeof node !== "object") {
      errors.push("Graph node is not an object");
      continue;
    }
    if (!node.id) {
      errors.push("Graph node is missing id");
      continue;
    }
    if (!node.type) errors.push("Graph node is missing type: " + node.id);
    if (ids.has(node.id)) errors.push("Duplicate graph node id: " + node.id);
    ids.add(node.id);
  }

  for (const edge of graphEdges) {
    if (!ids.has(edge?.from)) errors.push("Missing edge source: " + edge?.from);
    if (!ids.has(edge?.to)) errors.push("Missing edge target: " + edge?.to);
    if (!edge?.relation) errors.push("Edge relation is missing");
    const confidence = Number(edge?.confidence);
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
      errors.push("Invalid edge confidence: " + edge?.relation);
    }
  }

  if (graph?.statistics) {
    if (Number(graph.statistics.nodeCount) !== graphNodes.length) {
      errors.push("Knowledge Graph nodeCount statistic is inconsistent");
    }
    if (Number(graph.statistics.edgeCount) !== graphEdges.length) {
      errors.push("Knowledge Graph edgeCount statistic is inconsistent");
    }
  }

  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze(errors)
  });
}
