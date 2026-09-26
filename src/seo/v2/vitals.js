/**
 * --------------------------------------------------------
 * Fateh Music Academy — SEO Engine
 * Module: Core Web Vitals classifier
 * --------------------------------------------------------
 */

export const CORE_WEB_VITAL_THRESHOLDS = Object.freeze({
  lcp: Object.freeze({ good: 2500, needsImprovement: 4000 }),
  inp: Object.freeze({ good: 200, needsImprovement: 500 }),
  cls: Object.freeze({ good: 0.1, needsImprovement: 0.25 })
});

export function classifyVital(metric, value) {
  const key = String(metric || "").toLowerCase();
  const thresholds = CORE_WEB_VITAL_THRESHOLDS[key];
  const numeric = Number(value);

  if (!thresholds || !Number.isFinite(numeric) || numeric < 0) return "unknown";
  if (numeric <= thresholds.good) return "good";
  if (numeric <= thresholds.needsImprovement) return "needs-improvement";
  return "poor";
}

export function buildVitalSample(metric, value, { path = "", id = "" } = {}) {
  const name = String(metric || "").toLowerCase();
  return Object.freeze({
    id: id || undefined,
    path: path || undefined,
    metric: name,
    value: Number(value),
    rating: classifyVital(name, value)
  });
}
