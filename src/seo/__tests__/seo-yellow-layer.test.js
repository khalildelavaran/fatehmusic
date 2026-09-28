import { describe, expect, it } from "vitest";
import { buildArticleSchema } from "../schema/article.js";
import { buildBreadcrumbSchema } from "../schema/breadcrumb.js";
import { auditPage } from "../v2/audit.js";
import { resolveSite } from "../resolvers/site.js";

describe("SEO yellow-layer safeguards", () => {
  const site = resolveSite();

  it("adds a resolvable Organization author when a post has no author record", () => {
    const article = buildArticleSchema(
      {
        title: "آموزش گیتار برای مبتدیان",
        excerpt: "راهنمای شروع آموزش گیتار.",
        topic: "گیتار",
        created_at: "2026-09-01T10:00:00Z"
      },
      { site, url: "https://fatehmusic.ir/blog/guitar-beginners" }
    );

    expect(article.author["@type"]).toBe("Organization");
    expect(article.author["@id"]).toBe("https://fatehmusic.ir/#organization");
  });

  it("rejects invalid or duplicate Breadcrumb items and requires a usable trail", () => {
    const breadcrumb = buildBreadcrumbSchema([
      { name: "خانه", path: "/" },
      { name: "دوره‌ها", path: "/courses" },
      { name: "دوره‌ها", path: "/courses/" },
      { name: "", path: "/courses/guitar-course" }
    ], site);

    expect(breadcrumb).not.toBeNull();
    expect(breadcrumb.itemListElement).toHaveLength(2);
    expect(breadcrumb.itemListElement[1].item).toBe("https://fatehmusic.ir/courses");
    expect(buildBreadcrumbSchema([{ name: "خانه", path: "/" }], site)).toBeNull();
  });

  it("audits image quality when the page supplies image audit evidence", () => {
    const audit = auditPage({
      metadata: {
        title: "آموزش گیتار در شوشتر | آموزشگاه موسیقی فاتح",
        description: "کلاس آموزش گیتار در شوشتر برای سطوح مختلف.",
        robots: "index,follow"
      },
      url: "https://fatehmusic.ir/courses/guitar-course",
      schemaGraph: {
        "@graph": [
          { "@id": "https://fatehmusic.ir/#organization" },
          { "@id": "https://fatehmusic.ir/#website" },
          { "@id": "https://fatehmusic.ir/courses/guitar-course#webpage" }
        ]
      },
      topicSlugs: ["guitar", "shushtar"],
      primaryIntent: "local",
      imageAudit: {
        missingDimensions: 0,
        genericAlt: 0,
        heroPriority: true
      }
    });

    expect(audit.checks.find((check) => check.id === "image-dimensions")?.status).toBe("pass");
    expect(audit.checks.find((check) => check.id === "image-alt-quality")?.status).toBe("pass");
    expect(audit.checks.find((check) => check.id === "hero-image-priority")?.status).toBe("pass");
  });
});
