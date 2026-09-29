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
    expect(result.categories.security.available).toBe(false);
    expect(result.categories.security.measured).toBe(false);
    expect(result.unmeasuredCategories).toContain("security");
  });

  it("requires meaningful evidence coverage for the quality gate", () => {
    const result = runDiagnostics({
      audits: [{
        score: 100,
        coverageScore: 10,
        checks: [
          { id: "title", status: "pass", points: 10 }
        ],
        errors: [],
        warnings: []
      }],
      graphValidation: { valid: true, errors: [] }
    });

    expect(result.weightedScore).toBe(100);
    expect(result.evidenceCoverage).toBeLessThan(75);
    expect(result.qualityAdjustedScore).toBeLessThan(result.weightedScore);
    expect(result.qualityGate).toBe(false);
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


  it("counts overlapping GEO checks in both content and AI-readiness categories", () => {
    const result = runDiagnostics({
      audits: [{
        checks: [
          { id: "schema", status: "pass", points: 10 },
          { id: "answer-blocks", status: "pass", points: 5 },
          { id: "answer-sources", status: "pass", points: 5 },
          { id: "entity-graph", status: "pass", points: 5 }
        ],
        errors: [],
        warnings: []
      }],
      graphValidation: { valid: true, errors: [] }
    });

    expect(result.categories.aiReadiness.available).toBe(true);
    expect(result.categories.aiReadiness.coverage).toBeGreaterThan(0);
    expect(result.categories.schema.score).toBe(100);
  });
});


  it("does not penalize evidence coverage for categories with no defined checks", () => {
    const result = runDiagnostics({
      audits: [{
        checks: [
          { id: "title", status: "pass", points: 10 },
          { id: "description", status: "pass", points: 10 }
        ],
        errors: [],
        warnings: []
      }],
      graphValidation: { valid: true, errors: [] }
    });

    expect(result.categories.security.measured).toBe(false);
    expect(result.evidenceCoverage).toBe(100);
    expect(result.qualityAdjustedScore).toBe(100);
  });
