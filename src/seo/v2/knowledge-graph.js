/**
 * Explicit semantic knowledge graph for SEO intelligence.
 * JSON-LD is a publication format; this graph is the reasoning model.
 */

import { articleEntityId, courseEntityId, instructorEntityId } from "../geo/entity.js";
import { resolveTopics } from "./topics.js";
import { containsSemanticPhrase } from "../helpers/text.js";

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
  const missingReferences = [];
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

  const addEdge = (from, relation, to, confidence = 1, provenance = "DERIVED") => {
    if (!from || !to || !nodeIds.has(from) || !nodeIds.has(to)) return;
    const key = from + "|" + relation + "|" + to;
    if (edgeKeys.has(key)) return;
    edgeKeys.add(key);
    edges.push(Object.freeze({
      from,
      relation,
      to,
      confidence: Math.max(0, Math.min(1, Number(confidence) || 0)),
      provenance: String(provenance || "DERIVED")
    }));
  };

  const organizationId = base + "/#organization";
  const websiteId = base + "/#website";
  const locationId = base + "/locations/shushtar#localbusiness";

  const ensureTopicNode = (topic) => {
    if (!topic?.slug) return null;
    const topicId = base + "/#topic-" + topic.slug;
    addNode({
      id: topicId,
      type: "Topic",
      schemaType: "Thing",
      name: topic.name || topic.slug,
      properties: Object.freeze({ slug: topic.slug, aliases: topic.aliases || [] })
    });
    return topicId;
  };

  const resolveEntityTopics = (title, keywords = []) =>
    resolveTopics({ title, keywords, path: "" })
      .filter((topic) => topic.slug !== "shushtar" || containsSemanticPhrase(title || "", "شوشتر"));

  addNode({ id: organizationId, type: "Organization", name: "آموزشگاه موسیقی فاتح", url: base, topics: ["music-education", "shushtar"] });
  addNode({ id: websiteId, type: "WebSite", name: "آموزشگاه موسیقی فاتح", url: base });
  addNode({ id: locationId, type: "LocalBusiness", name: "آموزشگاه موسیقی فاتح شوشتر", url: absoluteUrl("/locations/shushtar", base), topics: ["shushtar"] });
  addEdge(websiteId, "publisher", organizationId, 1, "SITE_STRUCTURE");
  addEdge(organizationId, "location", locationId, 1, "BUSINESS_LOCATION");
  const organizationTopics = resolveEntityTopics("آموزشگاه موسیقی فاتح شوشتر", ["آموزش موسیقی", "شوشتر"]);
  for (const topic of organizationTopics) addEdge(organizationId, "about", ensureTopicNode(topic), 0.9, "ORGANIZATION_TOPIC_MATCH");

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
    addEdge(instructorId, "worksFor", organizationId, 1, "ENTITY_RELATION");
    for (const topic of resolveEntityTopics(instructor.name, instructor.professional?.roles || [])) {
      addEdge(instructorId, "knowsAbout", ensureTopicNode(topic), 0.8, "ROLE_TOPIC_MATCH");
    }
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
    addEdge(courseId, "provider", organizationId, 1, "COURSE_PROVIDER");
    for (const topic of resolveEntityTopics(course.title, [course.instrument, course.category])) {
      addEdge(courseId, "about", ensureTopicNode(topic), 0.9, "COURSE_TOPIC_MATCH");
    }

    const instructorIds = Array.isArray(course.instructors)
      ? course.instructors
      : course.instructor ? [course.instructor] : [];

    for (const instructorIdRef of instructorIds) {
      const instructor = (instructors || []).find((item) => item?.id === instructorIdRef);
      if (!instructor) {
        missingReferences.push(Object.freeze({
          type: "CourseInstructor",
          sourceId: courseId,
          reference: instructorIdRef
        }));
        continue;
      }
      const instructorId = instructorEntityId(absoluteUrl("/instructors/" + instructor.slug, base));
      addEdge(instructorId, "teaches", courseId, 1, "COURSE_INSTRUCTOR_REFERENCE");
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
    addEdge(articleId, "publisher", organizationId, 1, "ARTICLE_PUBLISHER");
    for (const topic of resolveEntityTopics(post.title, [post.topic])) {
      addEdge(articleId, "about", ensureTopicNode(topic), 0.85, "ARTICLE_TOPIC_MATCH");
    }
    if (post.related_course_slug) {
      const relatedCourse = (courses || []).find((course) => course?.slug === post.related_course_slug);
      if (!relatedCourse) {
        missingReferences.push(Object.freeze({
          type: "ArticleRelatedCourse",
          sourceId: articleId,
          reference: post.related_course_slug
        }));
      } else {
        addEdge(articleId, "about", courseEntityId(absoluteUrl("/courses/" + post.related_course_slug, base)), 0.95, "ARTICLE_RELATED_COURSE_REFERENCE");
      }
    }
  }

  const inbound = new Map(nodes.map((node) => [node.id, 0]));
  const outbound = new Map(nodes.map((node) => [node.id, 0]));
  for (const edge of edges) {
    outbound.set(edge.from, (outbound.get(edge.from) || 0) + 1);
    inbound.set(edge.to, (inbound.get(edge.to) || 0) + 1);
  }

  return Object.freeze({
    version: "1.1",
    nodes: freezeArray(nodes),
    edges: freezeArray(edges),
    missingReferences: freezeArray(missingReferences),
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
      ).length,
      missingReferenceCount: missingReferences.length,
      edgeProvenanceCounts: Object.freeze(Object.fromEntries(provenanceCounts))
    })
  });
}

export function validateKnowledgeGraph(graph) {
  const graphNodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
  const graphEdges = Array.isArray(graph?.edges) ? graph.edges : [];
  const graphMissingReferences = Array.isArray(graph?.missingReferences) ? graph.missingReferences : [];
  const errors = [];

  for (const reference of graphMissingReferences) {
    errors.push("Unresolved graph reference: " + String(reference?.type || "unknown") + ":" + String(reference?.reference || ""));
  }
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
    if (!edge?.provenance || typeof edge.provenance !== "string") {
      errors.push("Edge provenance is missing: " + edge?.relation);
    }
  }

  const provenanceCounts = new Map();
  for (const edge of graphEdges) {
    const provenance = String(edge?.provenance || "UNKNOWN");
    provenanceCounts.set(provenance, (provenanceCounts.get(provenance) || 0) + 1);
  }

  const outgoingRelations = new Map();
  for (const edge of graphEdges) {
    const key = edge.from;
    const relations = outgoingRelations.get(key) || new Set();
    relations.add(edge.relation);
    outgoingRelations.set(key, relations);
  }

  for (const node of graphNodes) {
    const relations = outgoingRelations.get(node.id) || new Set();
    if (node.type === "Organization" && !relations.has("location")) {
      errors.push("Organization is missing a location relation: " + node.id);
    }
    if (node.type === "Person" && !relations.has("worksFor")) {
      errors.push("Person is missing worksFor relation: " + node.id);
    }
    if (node.type === "Course" && !relations.has("provider")) {
      errors.push("Course is missing provider relation: " + node.id);
    }
    if (node.type === "Article" && !relations.has("publisher")) {
      errors.push("Article is missing publisher relation: " + node.id);
    }
  }

  if (graph?.statistics) {
    if (Number(graph.statistics.missingReferenceCount || 0) !== graphMissingReferences.length) {
      errors.push("Knowledge Graph missingReferenceCount statistic is inconsistent");
    }
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


export function findRelatedEntities(graph, nodeId, {
  relations = [],
  direction = "out",
  limit = 20
} = {}) {
  if (!graph?.nodes?.length || !nodeId) return [];

  const relationSet = new Set((Array.isArray(relations) ? relations : [relations]).filter(Boolean));
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const matches = [];

  for (const edge of graph.edges || []) {
    const isOutgoing = edge.from === nodeId;
    const isIncoming = edge.to === nodeId;
    const directionMatch =
      direction === "both" ||
      (direction === "out" && isOutgoing) ||
      (direction === "in" && isIncoming);

    if (!directionMatch) continue;
    if (relationSet.size && !relationSet.has(edge.relation)) continue;

    const targetId = isOutgoing ? edge.to : edge.from;
    const target = nodesById.get(targetId);
    if (!target) continue;

    matches.push({
      entity: target,
      relation: edge.relation,
      direction: isOutgoing ? "out" : "in",
      confidence: Number(edge.confidence) || 0
    });
  }

  return Object.freeze(
    matches
      .sort((a, b) => b.confidence - a.confidence || a.relation.localeCompare(b.relation))
      .slice(0, Math.max(0, Number(limit) || 20))
  );
}


export function findRelationPaths(graph, fromId, toId, {
  maxDepth = 2,
  relations = [],
  direction = "both",
  limit = 10
} = {}) {
  if (!graph?.nodes?.length || !fromId || !toId || fromId === toId) return [];

  const relationSet = new Set((Array.isArray(relations) ? relations : [relations]).filter(Boolean));
  const adjacency = new Map();

  for (const edge of graph.edges || []) {
    const add = (from, to, directionLabel) => {
      const list = adjacency.get(from) || [];
      list.push({ to, relation: edge.relation, direction: directionLabel, confidence: Number(edge.confidence) || 0 });
      adjacency.set(from, list);
    };

    if (direction === "out" || direction === "both") add(edge.from, edge.to, "out");
    if (direction === "in" || direction === "both") add(edge.to, edge.from, "in");
  }

  const queue = [{ id: fromId, path: [], visited: new Set([fromId]) }];
  const results = [];

  while (queue.length && results.length < Math.max(1, Number(limit) || 10)) {
    const current = queue.shift();
    if (current.path.length >= Math.max(1, Number(maxDepth) || 2)) continue;

    for (const step of adjacency.get(current.id) || []) {
      if (relationSet.size && !relationSet.has(step.relation)) continue;
      if (current.visited.has(step.to)) continue;

      const path = [...current.path, {
        from: current.id,
        to: step.to,
        relation: step.relation,
        direction: step.direction,
        confidence: step.confidence
      }];

      if (step.to === toId) {
        results.push(Object.freeze({
          nodes: Object.freeze([fromId, ...path.map((item) => item.to)]),
          edges: Object.freeze(path),
          depth: path.length,
          confidence: path.reduce((product, item) => product * Math.max(0, Math.min(1, item.confidence)), 1)
        }));
        continue;
      }

      queue.push({
        id: step.to,
        path,
        visited: new Set([...current.visited, step.to])
      });
    }
  }

  return Object.freeze(
    results.sort((a, b) => b.confidence - a.confidence || a.depth - b.depth).slice(0, Math.max(1, Number(limit) || 10))
  );
}
