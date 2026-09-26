import { describe, expect, it } from "vitest";
import { buildVitalSample, classifyVital } from "../v2/vitals.js";

describe("Core Web Vitals classifier", () => {
  it("classifies LCP at the current good threshold", () => {
    expect(classifyVital("lcp", 2500)).toBe("good");
    expect(classifyVital("lcp", 2501)).toBe("needs-improvement");
    expect(classifyVital("lcp", 4001)).toBe("poor");
  });

  it("classifies INP and CLS independently", () => {
    expect(classifyVital("inp", 200)).toBe("good");
    expect(classifyVital("inp", 500)).toBe("needs-improvement");
    expect(classifyVital("cls", 0.1)).toBe("good");
    expect(classifyVital("cls", 0.25)).toBe("needs-improvement");
  });

  it("returns a normalized metric sample", () => {
    expect(buildVitalSample("CLS", 0.08391, {
      path: "/",
      id: "sample-1"
    })).toEqual({
      id: "sample-1",
      path: "/",
      metric: "cls",
      value: 0.08391,
      rating: "good"
    });
  });
});
