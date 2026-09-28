import { describe, expect, it } from "vitest";
import { classifySeoActionMeasurement } from "./action-attribution.js";

describe("SEO action outcome classifier", () => {
  it("detects positive evidence from CTR and ranking improvement", () => {
    const result = classifySeoActionMeasurement(
      { impressions: 200, ctr: 0.08, position: 5 },
      { impressions: 180, ctr: 0.05, position: 7 }
    );

    expect(result.effect).toBe("POSITIVE");
    expect(result.ctrLift).toBeCloseTo(0.03);
    expect(result.positionImprovement).toBe(2);
    expect(result.confidence).toBeGreaterThan(70);
    expect(result.ctrStatisticallyStrong).toBe(true);
    expect(result.ctrZScore).toBeGreaterThan(1.96);
    expect(result.evidenceType).toBe("DESCRIPTIVE_BEFORE_AFTER");
  });

  it("reports insufficient data when no non-overlapping baseline exists", () => {
    expect(classifySeoActionMeasurement(null, null).effect).toBe("INSUFFICIENT_DATA");
    expect(classifySeoActionMeasurement(null, null).confidence).toBe(0);
  });

  it("does not call a mixed signal causal success", () => {
    const result = classifySeoActionMeasurement(
      { impressions: 50, ctr: 0.06, position: 8 },
      { impressions: 45, ctr: 0.055, position: 7.5 }
    );

    expect(result.effect).toBe("NEUTRAL");
  });


  it("does not treat a one-impression position change as positive evidence", () => {
    const result = classifySeoActionMeasurement(
      { impressions: 1, clicks: 0, ctr: 0, position: 4 },
      { impressions: 1, clicks: 0, ctr: 0, position: 8 }
    );

    expect(result.positionEvidenceStrong).toBe(false);
    expect(result.effect).toBe("NEUTRAL");
  });
});
