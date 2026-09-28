import { describe, expect, it } from "vitest";
import { runDiagnostics } from "./diagnostics.js";

describe("SEO diagnostics engine", () => {
  it("aggregates supplied evidence into weighted category scores and coverage", () => {
    const result = runDiagnostics({
      audits: [{
        score: 92,
        coverageScore: 100,
        checks: [
          { id: "title", status: "pass", points: 10 },
          { id: "description", status: "pass", points: 10 },
          { id: "canonical", status: "pass", points: 10 },
          { id: "schema", status: "pass", points: 10 },
          { id: "content-depth", status: "pass", points: 5 },
          { id: "h1", status: "pass", points: 10 }
        ],
        errors: [],
        warnings: []
      }],
      graphValidation: { valid: true, errors: [] }
    });

    expect(result.weightedScore).toBeGreaterThan(0);
    expect(result.evidenceCoverage).toBeGreaterThan(0);
    expect(result.categories.metadata.available).toBe(true);
    expect(result.categories.metadata.score).toBe(100);
    expect(result.statistics.pagesAnalyzed).toBe(1);
  });

  it("surfaces failed checks as actionable issues", () => {
    const result = runDiagnostics({
      audits: [{
        score: 40,
        checks: [
          { id: "title", status: "fail", points: 0 },
          { id: "h1", status: "warn", points: 5 }
        ],
        errors: ["title broken"],
        warnings: []
      }],
      graphValidation: { valid: false, errors: ["Missing edge target: x"] }
    });

    expect(result.qualityGate).toBe(false);
    expect(result.issues.some((item) => item.id === "title")).toBe(true);
    expect(result.issues.some((item) => item.id === "knowledge-graph")).toBe(true);
  });
});
