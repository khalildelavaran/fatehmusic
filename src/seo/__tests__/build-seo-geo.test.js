import { describe, expect, it } from "vitest";
import { buildSEO } from "../index.js";
import { validateEntityGraph } from "../geo/validate.js";

function idsOf(graph) {
    return graph["@graph"].map((node) => node?.["@id"]).filter(Boolean);
}

describe("buildSEO GEO integration", () => {
    it("produces a structurally valid canonical graph", () => {
        const result = buildSEO({
            path: "/courses/guitar",
            title: "آموزش گیتار",
            description: "دوره آموزش گیتار آموزشگاه موسیقی فاتح",
            extraSchema: []
        });

        const validation = validateEntityGraph(result.schemaGraph);

        expect(validation.valid).toBe(true);
        expect(validation.errors).toEqual([]);
        expect(validation.nodeCount).toBeGreaterThan(0);
    });

    it("contains only one canonical Organization and WebSite", () => {
        const result = buildSEO({ path: "/" });
        const ids = idsOf(result.schemaGraph);

        expect(ids.filter((id) => id.endsWith("/#organization"))).toHaveLength(1);
        expect(ids.filter((id) => id.endsWith("/#website"))).toHaveLength(1);
    });

    it("keeps page-specific schema in the same graph", () => {
        const result = buildSEO({
            path: "/courses/guitar",
            extraSchema: [
                {
                    "@type": "Course",
                    "@id": "https://fatehmusic.ir/courses/guitar/#course",
                    name: "گیتار"
                }
            ]
        });

        const course = result.schemaGraph["@graph"].find(
            (node) => node?.["@id"] === "https://fatehmusic.ir/courses/guitar/#course"
        );

        expect(course).toBeDefined();
        expect(course.name).toBe("گیتار");
    });
});
