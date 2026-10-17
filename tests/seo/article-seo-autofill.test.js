import { describe, expect, it } from "vitest";
import { buildArticleSeoFields } from "../../src/seo/v2/content-strategy/article-metadata.js";
import { articleContentToText, summarizeArticleContent } from "../../src/utils/article-summary.js";

const courses = [
  { slug: "guitar-course", title: "آموزش گیتار", active: true },
  { slug: "tar-course", title: "آموزش تار", active: true },
  { slug: "setar-course", title: "آموزش سه تار", active: true },
  { slug: "inactive-course", title: "آموزش ویولن", active: false }
];

describe("automatic article SEO fields", () => {
  it("creates an English slug, infers a topic and matches a related course", () => {
    const fields = buildArticleSeoFields({
      title: "چرا دانستن تئوری موسیقی برای نواختن گیتار مهم است",
      courses
    });
    expect(fields.slug).toBe("why-music-theory-matters-for-guitar");
    expect(fields.topic).toBeTruthy();
    expect(fields.related_course_slug).toBe("guitar-course");
    expect(fields.related_course_title).toBe("آموزش گیتار");
    expect(fields.meta_title).toBeTruthy();
    expect(fields.meta_title.length).toBeLessThanOrEqual(60);
  });

  it("keeps an explicitly entered topic and derives a slug when no title exists", () => {
    const fields = buildArticleSeoFields({ topic: "آموزش گیتار", courses });
    expect(fields.topic).toBe("آموزش گیتار");
    expect(fields.slug).toBe("guitar-lessons");
    expect(fields.related_course_slug).toBe("guitar-course");
  });

  it("does not arbitrarily select one course for a multi-course comparison", () => {
    const fields = buildArticleSeoFields({ title: "تفاوت تار و سه تار", courses });
    expect(fields.related_course_slug).toBe("");
    expect(fields.related_course_title).toBe("");
  });

  it("does not match inactive courses", () => {
    const fields = buildArticleSeoFields({ title: "آموزش ویولن", courses });
    expect(fields.related_course_slug).toBe("");
  });
});

describe("article summary extraction", () => {
  it("extracts readable text from HTML and decodes entities", () => {
    expect(articleContentToText("<h2>راهنمای گیتار</h2><p>تمرین &amp; تکرار&nbsp; روزانه.</p><script>alert(1)</script>"))
      .toBe("راهنمای گیتار تمرین & تکرار روزانه.");
  });

  it("generates a summary from article text and respects the requested length", () => {
    const content = "<p>" + "تمرین منظم گیتار به هماهنگی دست‌ها کمک می‌کند و بهتر است هر بار یک بخش کوتاه را با دقت تمرین کنید. ".repeat(6) + "</p>";
    const summary = summarizeArticleContent(content, 120);
    expect(summary.length).toBeLessThanOrEqual(120);
    expect(summary).toContain("گیتار");
    expect(summary).toMatch(/…|[.!؟؛]$/u);
  });

  it("returns an empty summary when the article has no text", () => {
    expect(summarizeArticleContent("<img src='/photo.webp' alt=''>")).toBe("");
  });
});
