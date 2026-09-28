/**
 * Interpret before/after GSC measurements for a published SEO action.
 * This is a deterministic evidence classifier, not a causal attribution model.
 */

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, Number(value) || 0));

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

  const sampleScore =
    (latestImpressions >= 100 ? 35 : latestImpressions >= 30 ? 25 : latestImpressions >= 10 ? 15 : 5) +
    (previousImpressions >= 100 ? 25 : previousImpressions >= 30 ? 18 : previousImpressions >= 10 ? 10 : 5);

  let confidence = sampleScore;
  if (ctrLift != null) confidence += 15;
  if (positionImprovement != null) confidence += 15;
  if (impressionGrowth != null) confidence += 10;
  confidence = Math.round(clamp(confidence));

  const positive = (ctrLift != null && ctrLift >= 0.005) || (positionImprovement != null && positionImprovement >= 1);
  const negative = (ctrLift != null && ctrLift <= -0.005) || (positionImprovement != null && positionImprovement <= -1);

  return {
    effect: positive && !negative ? "POSITIVE" : negative && !positive ? "NEGATIVE" : "NEUTRAL",
    confidence,
    ctrLift,
    positionImprovement,
    impressionGrowth
  };
}
