/**
 * Interpret before/after GSC measurements for a published SEO action.
 * This is a deterministic evidence classifier, not a causal attribution model.
 */

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, Number(value) || 0));

function ctrZScore(latestClicks, latestImpressions, previousClicks, previousImpressions) {
  if (latestImpressions <= 0 || previousImpressions <= 0) return null;
  const latestRate = latestClicks / latestImpressions;
  const previousRate = previousClicks / previousImpressions;
  const pooled = (latestClicks + previousClicks) / (latestImpressions + previousImpressions);
  const variance = pooled * (1 - pooled) * (1 / latestImpressions + 1 / previousImpressions);
  if (variance <= 0) return latestRate === previousRate ? 0 : null;
  return (latestRate - previousRate) / Math.sqrt(variance);
}

function ctrLiftInterval95(latestClicks, latestImpressions, previousClicks, previousImpressions, z = 1.96) {
  if (latestImpressions <= 0 || previousImpressions <= 0) return null;

  const latestRate = latestClicks / latestImpressions;
  const previousRate = previousClicks / previousImpressions;
  const lift = latestRate - previousRate;
  const variance =
    (latestRate * (1 - latestRate)) / latestImpressions +
    (previousRate * (1 - previousRate)) / previousImpressions;

  if (!Number.isFinite(variance) || variance < 0) {
    return Number.isFinite(lift) ? { lower: lift, upper: lift } : null;
  }

  const halfWidth = z * Math.sqrt(variance);
  return Object.freeze({
    lower: Number((lift - halfWidth).toFixed(4)),
    upper: Number((lift + halfWidth).toFixed(4))
  });
}

export function classifySeoActionMeasurement(latest, previous) {
  if (!latest || !previous) {
    return {
      effect: "INSUFFICIENT_DATA",
      confidence: 0,
      ctrLift: null,
      positionImprovement: null,
      impressionGrowth: null
    };
  }

  const latestImpressions = Math.max(0, Number(latest.impressions) || 0);
  const previousImpressions = Math.max(0, Number(previous.impressions) || 0);
  const latestClicksValue = Number(latest.clicks);
  const previousClicksValue = Number(previous.clicks);
  const latestClicks = Number.isFinite(latestClicksValue)
    ? Math.max(0, latestClicksValue)
    : Math.round(latestImpressions * Math.max(0, Number(latest.ctr) || 0));
  const previousClicks = Number.isFinite(previousClicksValue)
    ? Math.max(0, previousClicksValue)
    : Math.round(previousImpressions * Math.max(0, Number(previous.ctr) || 0));
  const latestCtr = Number(latest.ctr);
  const previousCtr = Number(previous.ctr);
  const latestPosition = Number(latest.position);
  const previousPosition = Number(previous.position);

  const ctrLift = Number.isFinite(latestCtr) && Number.isFinite(previousCtr)
    ? latestCtr - previousCtr
    : null;
  const positionImprovement = Number.isFinite(latestPosition) && Number.isFinite(previousPosition)
    ? previousPosition - latestPosition
    : null;
  const impressionGrowth = previousImpressions > 0
    ? (latestImpressions - previousImpressions) / previousImpressions
    : null;
  const exposureRatio = previousImpressions > 0
    ? latestImpressions / previousImpressions
    : null;
  const exposureComparability =
    !Number.isFinite(exposureRatio) ? "UNKNOWN" :
    exposureRatio >= 0.5 && exposureRatio <= 2 ? "COMPARABLE" :
    "MIX_SHIFT";
  const ctrZ = ctrZScore(latestClicks, latestImpressions, previousClicks, previousImpressions);
  const ctrLiftInterval = ctrLiftInterval95(
    latestClicks,
    latestImpressions,
    previousClicks,
    previousImpressions
  );
  const ctrStatisticallyStrong = Number.isFinite(ctrZ) && Math.abs(ctrZ) >= 1.96;
  const ctrLiftStatisticallyClear =
    Boolean(ctrLiftInterval) &&
    (ctrLiftInterval.upper < 0 || ctrLiftInterval.lower > 0);

  const sampleScore =
    (latestImpressions >= 100 ? 35 : latestImpressions >= 30 ? 25 : latestImpressions >= 10 ? 15 : 5) +
    (previousImpressions >= 100 ? 25 : previousImpressions >= 30 ? 18 : previousImpressions >= 10 ? 10 : 5);

  let confidence = sampleScore;
  if (ctrLift != null) confidence += 15;
  if (positionImprovement != null) confidence += 15;
  if (impressionGrowth != null) confidence += 10;
  if (ctrStatisticallyStrong) confidence += 12;
  confidence = Math.round(clamp(confidence));

  const positionEvidenceStrong = latestImpressions >= 10 && previousImpressions >= 10;
  const positiveCtr = ctrLift != null && ctrLift >= 0.005 && ctrStatisticallyStrong && ctrZ > 0;
  const negativeCtr = ctrLift != null && ctrLift <= -0.005 && ctrStatisticallyStrong && ctrZ < 0;
  const positivePosition = positionEvidenceStrong && positionImprovement != null && positionImprovement >= 1;
  const negativePosition = positionEvidenceStrong && positionImprovement != null && positionImprovement <= -1;
  const positive = positiveCtr || positivePosition;
  const negative = negativeCtr || negativePosition;

  return {
    effect: positive && !negative ? "POSITIVE" : negative && !positive ? "NEGATIVE" : "NEUTRAL",
    confidence,
    ctrLift,
    ctrZScore: Number.isFinite(ctrZ) ? Number(ctrZ.toFixed(3)) : null,
    ctrLiftInterval95: ctrLiftInterval,
    ctrStatisticallyStrong,
    ctrLiftStatisticallyClear,
    positionEvidenceStrong,
    positionImprovement,
    impressionGrowth,
    exposureRatio,
    exposureComparability,
    sampleScore,
    evidenceType: "DESCRIPTIVE_BEFORE_AFTER",
    statisticalMethod: "TWO_PROPORTION_Z_TEST",
    assumptions: Object.freeze([
      "before_after_windows_are_non_overlapping",
      "ctr_is_approximated_as_a_binomial_proportion",
      "observations_are_treated_as_independent_for_the_z_test"
    ]),
    limitations: Object.freeze([
      ...(exposureComparability === "MIX_SHIFT" ? ["LARGE_IMPRESSION_MIX_SHIFT"] : []),
      "DESCRIPTIVE_NOT_CAUSAL"
    ])
  };
}
