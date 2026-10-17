import { describe, expect, it } from "vitest";
import { slugifyArticleTitle } from "./slug.js";

describe("semantic English article slugs", () => {
  it("translates common Persian music titles into readable English slugs", () => {
    expect(slugifyArticleTitle("آموزش گیتار")).toBe("guitar-lessons");
    expect(slugifyArticleTitle("آموزش گیتار برای مبتدیان")).toBe("guitar-lessons-for-beginners");
    expect(slugifyArticleTitle("تئوری موسیقی")).toBe("music-theory");
    expect(slugifyArticleTitle("آموزش موسیقی کودک")).toBe("music-lessons-for-children");
    expect(slugifyArticleTitle("چرا دانستن تئوری موسیقی برای نواختن گیتار مهم است"))
      .toBe("why-music-theory-matters-for-guitar");
  });

  it("uses natural phrase templates for local and educational topics", () => {
    expect(slugifyArticleTitle("هزینه کلاس آواز در شوشتر"))
      .toBe("cost-of-singing-lessons-in-shushtar");
    expect(slugifyArticleTitle("کلاس گیتار در شوشتر"))
      .toBe("guitar-lessons-in-shushtar");
    expect(slugifyArticleTitle("چگونه گیتار را از صفر یاد بگیریم؟"))
      .toBe("how-to-learn-guitar-from-scratch");
    expect(slugifyArticleTitle("راهنمای شروع یادگیری گیتار برای مبتدی‌ها"))
      .toBe("guitar-lessons-for-beginners");
  });

  it("translates instrument comparisons and preserves existing English titles", () => {
    expect(slugifyArticleTitle("تفاوت تار و سه‌تار")).toBe("difference-between-tar-and-setar");
    expect(slugifyArticleTitle("Music Theory for Guitar")).toBe("music-theory-for-guitar");
  });

  it("never falls back to letter-by-letter Finglish for unknown Persian words", () => {
    expect(slugifyArticleTitle("ژقپ ثصغ")).toBe("");
  });

  it("returns a clean ASCII slug for mixed English and recognized Persian text", () => {
    const slug = slugifyArticleTitle("Guitar آموزش در شوشتر");
    expect(slug).toBe("guitar-lessons-in-shushtar");
    expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });
});
