import { describe, expect, it } from "vitest";
import { buildImageGallerySchema } from "../schema/image-gallery.js";

describe("Image gallery schema", () => {
  it("creates one ImageGallery node and one ImageObject per gallery asset", () => {
    const site = { url: "https://fatehmusic.ir" };
    const items = [
      { title: "کلاس گیتار", subtitle: "آموزش گیتار", image: "/images/gallery/guitar.webp" },
      { title: "کلاس پیانو", subtitle: "آموزش پیانو", image: "/images/gallery/piano.webp" },
    ];

    const graph = buildImageGallerySchema({
      site,
      url: `${site.url}/gallery`,
      name: "گالری عکس آموزشگاه موسیقی فاتح شوشتر",
      description: "گالری عکس کلاس موسیقی در شوشتر",
      items
    });

    expect(graph).toHaveLength(3);
    expect(graph[0]["@type"]).toBe("ImageGallery");
    expect(graph[0].associatedMedia).toHaveLength(2);
    expect(graph.slice(1).every((node) => node["@type"] === "ImageObject")).toBe(true);
    expect(graph.slice(1).every((node) => node.mainEntityOfPage["@id"] === "https://fatehmusic.ir/gallery/#webpage")).toBe(true);
  });
});
