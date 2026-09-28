import { describe, expect, it } from "vitest";
import { classifyIntent } from "./intents.js";

describe("intent phrase matching", () => {
  it("matches complete intent phrases", () => {
    expect(classifyIntent({
      title: "راهنمای انتخاب کلاس گیتار",
      entityType: "Article"
    }).primary).toBe("informational");
  });

  it("does not trigger a term from a larger token", () => {
    const result = classifyIntent({
      title: "گیتاریست‌های جوان",
      entityType: "Article"
    });
    expect(result.intents.find((item) => item.intent === "transactional")).toBeUndefined();
  });
});
