import { describe, it, expect } from "vitest";
import { normalizePersianText, toDedupKey, significantTokens, titleSimilarity } from "../../../src/ai/content-engine/normalize";

describe("normalizePersianText", () => {
  it("unifies Arabic letterforms to Persian", () => {
    expect(normalizePersianText("كيبورد")).toBe("کیبورد");
  });

  it("converts Arabic-Indic digits to ASCII", () => {
    expect(normalizePersianText("٥ روش")).toBe("5 روش");
  });

  it("strips Arabic diacritics", () => {
    expect(normalizePersianText("مُوسیقی")).toBe("موسیقی");
  });

  it("collapses extra whitespace and trims", () => {
    expect(normalizePersianText("  گیتار   کلاسیک  ")).toBe("گیتار کلاسیک");
  });
});

describe("toDedupKey", () => {
  it("treats punctuation-only differences as identical", () => {
    const a = toDedupKey("چگونه گیتار یاد بگیریم؟");
    const b = toDedupKey("چگونه گیتار یاد بگیریم");
    expect(a).toBe(b);
  });

  it("treats Arabic vs Persian letterform titles as identical", () => {
    const a = toDedupKey("آموزش كيبورد در شوشتر");
    const b = toDedupKey("آموزش کیبورد در شوشتر");
    expect(a).toBe(b);
  });

  it("is case-insensitive for embedded Latin text", () => {
    expect(toDedupKey("MIDI چیست")).toBe(toDedupKey("midi چیست"));
  });
});

describe("significantTokens", () => {
  it("drops common stopwords", () => {
    const tokens = significantTokens("تفاوت تار و سه تار در چیست");
    expect(tokens).not.toContain("و");
    expect(tokens).not.toContain("در");
    expect(tokens).toContain("تفاوت");
  });
});

describe("titleSimilarity", () => {
  it("scores near-identical rewordings highly", () => {
    const sim = titleSimilarity(
      "چگونه گیتار را از صفر یاد بگیریم؟",
      "چگونه گیتار را از صفر یاد بگیریم"
    );
    expect(sim).toBeGreaterThan(0.9);
  });

  it("scores unrelated titles low", () => {
    const sim = titleSimilarity(
      "راهنمای خرید ویولن مناسب برای مبتدی‌ها",
      "فواید یادگیری تنبک برای رشد ذهنی"
    );
    expect(sim).toBeLessThan(0.3);
  });

  it("returns 0 for empty input", () => {
    expect(titleSimilarity("", "چیزی")).toBe(0);
  });
});
