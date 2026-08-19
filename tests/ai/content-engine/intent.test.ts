import { describe, it, expect } from "vitest";
import { classifyIntent } from "../../../src/ai/content-engine/intent";

describe("classifyIntent", () => {
  it("detects transactional intent from price/enrollment terms", () => {
    expect(classifyIntent("هزینه ثبت‌نام کلاس گیتار چقدر است")).toBe("transactional");
  });

  it("detects navigational intent from brand terms", () => {
    expect(classifyIntent("چرا آموزشگاه موسیقی فاتح را انتخاب کنیم")).toBe("navigational");
  });

  it("detects commercial intent from comparison terms", () => {
    expect(classifyIntent("تفاوت تار و سه‌تار در چیست؟ کدام را انتخاب کنیم")).toBe("commercial");
  });

  it("defaults to informational for how-to phrasing", () => {
    expect(classifyIntent("چگونه گیتار را از صفر یاد بگیریم؟")).toBe("informational");
  });

  it("prioritizes transactional even when brand is also mentioned", () => {
    expect(classifyIntent("هزینه ثبت‌نام در آموزشگاه فاتح")).toBe("transactional");
  });
});
