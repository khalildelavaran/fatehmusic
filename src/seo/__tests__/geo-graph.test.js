import { describe, expect, it } from "vitest";
import {
    buildCourseInstructorRefs,
    buildCourseRef,
    mergeEntityNodes
} from "../geo/graph.js";
import { articleEntityId, courseEntityId, instructorEntityId } from "../geo/entity.js";
import { buildSchemaGraph } from "../schema/graph.js";

describe("GEO entity graph", () => {
    it("deduplicates nodes with the same @id", () => {
        const nodes = mergeEntityNodes([
            { "@id": "https://fatehmusic.ir/#organization", "@type": "Organization" },
            { "@id": "https://fatehmusic.ir/#organization", name: "آموزشگاه موسیقی فاتح" },
            { "@id": "https://fatehmusic.ir/#website", "@type": "WebSite" }
        ]);

        expect(nodes).toHaveLength(2);
        expect(nodes[0]).toEqual({
            "@id": "https://fatehmusic.ir/#organization",
            "@type": "Organization",
            name: "آموزشگاه موسیقی فاتح"
        });
    });

    it("builds canonical Course to Instructor references", () => {
        const course = {
            url: "https://fatehmusic.ir/courses/guitar",
            instructors: [
                { url: "https://fatehmusic.ir/instructors/ali", name: "Ali" },
                { url: "https://fatehmusic.ir/instructors/sara", name: "Sara" }
            ]
        };

        expect(buildCourseInstructorRefs(course)).toEqual([
            { "@id": instructorEntityId(course.instructors[0].url) },
            { "@id": instructorEntityId(course.instructors[1].url) }
        ]);
        expect(buildCourseRef(course)).toEqual({ "@id": courseEntityId(course.url) });
    });

    it("builds canonical Article IDs", () => {
        expect(articleEntityId("https://fatehmusic.ir/blog/guide")).toBe(
            "https://fatehmusic.ir/blog/guide/#article"
        );
    });

    it("returns one graph with duplicate entities removed", () => {
        const graph = buildSchemaGraph([
            { "@id": "https://fatehmusic.ir/#organization", "@type": "Organization", logo: "x" },
            { "@id": "https://fatehmusic.ir/#website", "@type": "WebSite", inLanguage: "fa-IR" },
            { "@id": "https://fatehmusic.ir/#organization", name: "آموزشگاه موسیقی فاتح" },
            { "@id": "https://fatehmusic.ir/#website", publisher: { "@id": "https://fatehmusic.ir/#organization" } }
        ]);

        expect(graph["@graph"]).toHaveLength(2);
        expect(graph["@graph"].filter((node) => node["@id"] === "https://fatehmusic.ir/#organization")).toHaveLength(1);
        expect(graph["@graph"].filter((node) => node["@id"] === "https://fatehmusic.ir/#website")).toHaveLength(1);
    });
});
