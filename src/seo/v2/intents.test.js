import { describe, expect, it } from "vitest";
import { classifyIntent } from "./intents.js";

describe("intent phrase matching", () => {
  it("matches complete intent phrases", () => {
    expect(classifyIntent({
      title: "راهنمای انتخاب کلاس گیتار",
      entityType: "Article"
    }).primary).toBe("informational");
  });

  it("classifies strong commercial modifiers without overriding a guide intent", () => {
    expect(classifyIntent({
      title: "بهترین دوره گیتار برای مبتدیان",
      entityType: "Article"
    }).primary).toBe("commercial");

    expect(classifyIntent({
      title: "راهنمای انتخاب کلاس گیتار",
      entityType: "Article"
    }).primary).toBe("informational");
  });

  it("accumulates multiple matching rules for the same intent", () => {
    const result = classifyIntent({
      title: "بهترین دوره مناسب گیتار",
      entityType: "Article"
    });
    const commercial = result.intents.find((item) => item.intent === "commercial");
    expect(commercial?.score).toBe(60);
    expect(commercial?.reason).toEqual(expect.arrayContaining(["بهترین", "مناسب"]));
  });

  it("reports confidence from the separation between top intents", () => {
    const result = classifyIntent({
      path: "/register",
      title: "ثبت نام کلاس گیتار شوشتر",
      entityType: "Course"
    });

    expect(result.confidence).toBeGreaterThanOrEqual(0.55);
    expect(result.confidence).toBeLessThanOrEqual(0.99);
  });

  it("does not trigger a term from a larger token", () => {
    const result = classifyIntent({
      title: "گیتاریست‌های جوان",
      entityType: "Article"
    });
    expect(result.intents.find((item) => item.intent === "transactional")).toBeUndefined();
  });
});
