import { describe, expect, it } from "vitest";
import { buildKnowledgeGraph, validateKnowledgeGraph, findRelatedEntities, findRelationPaths } from "./knowledge-graph.js";
import { courseEntityId, instructorEntityId } from "../geo/entity.js";

describe("SEO knowledge graph", () => {
  it("builds connected organization, course, instructor and article nodes", () => {
    const graph = buildKnowledgeGraph({
      siteUrl: "https://fatehmusic.ir",
      courses: [{
        id: 1,
        slug: "guitar-course",
        title: "آموزش گیتار",
        instrument: "guitar",
        instructor: 7
      }],
      instructors: [{
        id: 7,
        slug: "ali-music",
        name: "علی",
        professional: { roles: ["مدرس گیتار"] }
      }],
      posts: [{
        slug: "guitar-guide",
        title: "راهنمای گیتار",
        topic: "گیتار",
        related_course_slug: "guitar-course"
      }]
    });

    expect(graph.nodes.map((node) => node.type)).toEqual(
      expect.arrayContaining(["Organization", "WebSite", "LocalBusiness", "Course", "Person", "Article"])
    );
    expect(graph.edges.some((edge) => edge.relation === "teaches")).toBe(true);
    expect(graph.edges.some((edge) => edge.relation === "about")).toBe(true);
    expect(validateKnowledgeGraph(graph).valid).toBe(true);
    expect(graph.statistics.orphanNodeCount).toBe(0);
    expect(graph.nodes.some((node) =>
      node.id === courseEntityId("https://fatehmusic.ir/courses/guitar-course")
    )).toBe(true);
    expect(graph.nodes.some((node) =>
      node.id === instructorEntityId("https://fatehmusic.ir/instructors/ali-music")
    )).toBe(true);
  });

  it("traverses related entities through the canonical edge API", () => {
    const graph = buildKnowledgeGraph({
      siteUrl: "https://fatehmusic.ir",
      courses: [{
        id: 1,
        slug: "guitar-course",
        title: "گیتار",
        instructor: 7
      }],
      instructors: [{
        id: 7,
        slug: "ali",
        name: "علی"
      }]
    });
    const personId = "https://fatehmusic.ir/instructors/ali#person";
    const related = findRelatedEntities(graph, personId, { relations: ["teaches"], direction: "out" });

    expect(related).toHaveLength(1);
    expect(related[0].entity.name).toBe("گیتار");
    expect(related[0].confidence).toBe(1);
  });

  it("finds multi-hop semantic paths through shared topic entities", () => {
    const graph = buildKnowledgeGraph({
      siteUrl: "https://fatehmusic.ir",
      courses: [{
        id: 1,
        slug: "guitar-course",
        title: "آموزش گیتار"
      }],
      posts: [{
        slug: "guitar-guide",
        title: "راهنمای گیتار",
        topic: "گیتار"
      }]
    });

    const articleId = "https://fatehmusic.ir/blog/guitar-guide/#article";
    const courseId = "https://fatehmusic.ir/courses/guitar-course/#course";
    const paths = findRelationPaths(graph, articleId, courseId, {
      maxDepth: 2,
      relations: ["about"],
      direction: "both"
    });

    expect(paths).toHaveLength(1);
    expect(paths[0].depth).toBe(2);
    expect(paths[0].confidence).toBe(1);
  });

  it("deduplicates edges and validates broken references", () => {
    const graph = buildKnowledgeGraph({ siteUrl: "https://fatehmusic.ir" });
    const broken = {
      ...graph,
      edges: [...graph.edges, {
        from: "https://fatehmusic.ir/missing",
        relation: "about",
        to: "https://fatehmusic.ir/#organization",
        confidence: 1
      }]
    };

    expect(validateKnowledgeGraph(broken).valid).toBe(false);
  });
});
