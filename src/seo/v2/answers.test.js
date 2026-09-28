import { describe, expect, it } from "vitest";
import { answersFromArticle } from "./answers.js";

describe("answersFromArticle", () => {
  it("extracts question-answer blocks only from question-like headings", () => {
    const markdown = [
      "# مقاله",
      "",
      "## آموزش موسیقی چگونه شروع می‌شود؟",
      "",
      "برای شروع، ابتدا هدف و ساز مورد علاقه را مشخص کنید و سپس سطح مقدماتی را انتخاب کنید.",
      "",
      "## معرفی دوره",
      "",
      "این بخش صرفاً معرفی دوره است و نباید به پاسخ GEO تبدیل شود.",
      "",
      "## آیا برای شروع باید نت بلد باشیم؟",
      "",
      "خیر. می‌توان از سطح مقدماتی شروع کرد و نت‌خوانی را در طول مسیر یاد گرفت."
    ].join("\n");

    const blocks = answersFromArticle(markdown, "https://fatehmusic.ir/blog/example", "https://fatehmusic.ir/blog/example#article");
    expect(blocks).toHaveLength(2);
    expect(blocks[0].question).toBe("آموزش موسیقی چگونه شروع می‌شود؟");
    expect(blocks[0].answer).toContain("هدف و ساز مورد علاقه");
    expect(blocks[0].sourceUrl).toBe("https://fatehmusic.ir/blog/example");
    expect(blocks[0].entityId).toBe("https://fatehmusic.ir/blog/example#article");
    expect(blocks[1].question).toBe("آیا برای شروع باید نت بلد باشیم؟");
  });

  it("does not cross a following heading or list into the answer", () => {
    const markdown = [
      "## چطور برای کلاس موسیقی آماده شویم؟",
      "",
      "ابتدا زمان تمرین هفتگی و هدف آموزشی را مشخص کنید.",
      "",
      "## بعد از شروع چه کنیم؟",
      "",
      "- تمرین منظم",
      "- مرور درس"
    ].join("\n");
    const blocks = answersFromArticle(markdown, "https://fatehmusic.ir/blog/example");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].answer).not.toContain("تمرین منظم");
  });
});
