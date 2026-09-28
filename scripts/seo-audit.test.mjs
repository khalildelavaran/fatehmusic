import { describe, expect, it } from "vitest";
import { validateRedirectFileParity } from "./seo-audit.mjs";

describe("validateRedirectFileParity", () => {
  it("returns no issues for identical redirect maps", () => {
    expect(validateRedirectFileParity(
      new Map([["/a/", { to: "/a", status: "301" }]]),
      new Map([["/a/", { to: "/a", status: "301" }]])
    )).toEqual([]);
  });

  it("ignores insertion order", () => {
    expect(validateRedirectFileParity(
      new Map([
        ["/b/", { to: "/b", status: "301" }],
        ["/a/", { to: "/a", status: "301" }]
      ]),
      new Map([
        ["/a/", { to: "/a", status: "301" }],
        ["/b/", { to: "/b", status: "301" }]
      ])
    )).toEqual([]);
  });

  it("reports missing and conflicting rules", () => {
    const issues = validateRedirectFileParity(
      new Map([
        ["/a/", { to: "/a", status: "301" }],
        ["/b/", { to: "/b", status: "301" }]
      ]),
      new Map([
        ["/a/", { to: "/different", status: "302" }],
        ["/c/", { to: "/c", status: "301" }]
      ])
    );

    expect(issues).toHaveLength(3);
    expect(issues.some((issue) => issue.includes("/a/"))).toBe(true);
    expect(issues.some((issue) => issue.includes("/b/"))).toBe(true);
    expect(issues.some((issue) => issue.includes("/c/"))).toBe(true);
  });
});
