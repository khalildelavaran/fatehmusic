/**
 * Enterprise-style diagnostics aggregation for SEO intelligence.
 * Diagnostics measures supplied evidence; it does not invent missing metrics.
 */

const WEIGHTS = Object.freeze({
  metadata: 15,
  schema: 20,
  content: 20,
  performance: 15,
  security: 10,
  accessibility: 10,
  aiReadiness: 10
});

const CATEGORIES = Object.freeze(Object.keys(WEIGHTS));

const CHECK_MAX_POINTS = Object.freeze({
  title: 10,
  description: 10,
  indexability: 10,
  canonical: 10,
  schema: 10,
  h1: 10,
  "image-alt": 5,
  "image-dimensions": 5,
  "image-alt-quality": 5,
  "hero-image-priority": 5,
  "content-depth": 5,
  "internal-links": 10,
  "web-vitals-lcp": 5,
  "web-vitals-inp": 5,
  "web-vitals-cls": 5,
  topics: 5,
  intent: 5,
  freshness: 5
});

const CATEGORY_RULES = Object.freeze({
  metadata: new Set(["title", "description", "canonical", "indexability"]),
  schema: new Set(["schema"]),
  content: new Set(["content-depth", "topics", "intent", "freshness"]),
  performance: new Set(["web-vitals-lcp", "web-vitals-inp", "web-vitals-cls", "image-dimensions", "hero-image-priority"]),
  accessibility: new Set(["h1", "image-alt", "image-alt-quality"]),
  security: new Set([]),
  aiReadiness: new Set(["schema", "topics", "intent", "content-depth"])
});

function categoryForCheck(id) {
  for (const category of CATEGORIES) {
    if (CATEGORY_RULES[category].has(id)) return category;
  }
  return null;
}

function normalizeAudit(audit) {
  if (!audit || typeof audit !== "object") return null;
  return {
    score: Number(audit.score),
    coverageScore: Number(audit.coverageScore),
    checks: Array.isArray(audit.checks) ? audit.checks : [],
    errors: Array.isArray(audit.errors) ? audit.errors : [],
    warnings: Array.isArray(audit.warnings) ? audit.warnings : []
  };
}

export function runDiagnostics({ audits = [], graphValidation = null, knowledgeGraph = null } = {}) {
  const normalizedAudits = audits.map(normalizeAudit).filter(Boolean);

  const categoryBuckets = new Map(
    CATEGORIES.map((category) => [category, {
      earnedPoints: 0,
      possiblePoints: 0,
      checks: 0,
      covered: 0,
      errors: 0,
      warnings: 0
    }])
  );

  const issues = [];

  for (const audit of normalizedAudits) {
    for (const check of audit.checks) {
      const category = categoryForCheck(check.id);
      if (!category) continue;
      const bucket = categoryBuckets.get(category);
      bucket.checks += 1;
      bucket.covered += 1;
      const maxPoints = CHECK_MAX_POINTS[check.id] || Math.max(0, Number(check.points) || 0);
      bucket.earnedPoints += Math.max(0, Number(check.points) || 0);
      bucket.possiblePoints += maxPoints;
      if (check.status === "fail") bucket.errors += 1;
      if (check.status === "warn") bucket.warnings += 1;
      if (check.status !== "pass") {
        issues.push(Object.freeze({
          category,
          severity: check.status === "fail" ? "ERROR" : "WARNING",
          id: check.id,
          message: check.label,
          recommendation: recommendationForCheck(check.id)
        }));
      }
    }

    for (const error of audit.errors) {
      issues.push(Object.freeze({
        category: "metadata",
        severity: "ERROR",
        id: "audit-error",
        message: String(error),
        recommendation: "Resolve the page audit error before release."
      }));
    }
  }

  if (graphValidation?.valid === false) {
    for (const error of graphValidation.errors || []) {
      issues.push(Object.freeze({
        category: "schema",
        severity: "ERROR",
        id: "knowledge-graph",
        message: String(error),
        recommendation: "Repair the broken Knowledge Graph edge before publishing structured data."
      }));
    }
  }

  const categories = {};
  for (const category of CATEGORIES) {
    const bucket = categoryBuckets.get(category);
    const score = bucket.possiblePoints
      ? Math.round((bucket.earnedPoints / bucket.possiblePoints) * 100)
      : null;
    const categoryMaximum = [...CATEGORY_RULES[category]]
      .reduce((sum, id) => sum + (CHECK_MAX_POINTS[id] || 0), 0);
    const coverage = categoryMaximum
      ? Math.round((bucket.possiblePoints / categoryMaximum) * 100)
      : 0;

    categories[category] = Object.freeze({
      score,
      available: score != null,
      coverage,
      errors: bucket.errors,
      warnings: bucket.warnings
    });
  }

  const availableWeighted = CATEGORIES
    .filter((category) => categories[category].available)
    .reduce((sum, category) => sum + WEIGHTS[category], 0);

  const weightedScore = availableWeighted
    ? Math.round(
        CATEGORIES.reduce((sum, category) => {
          const value = categories[category].score;
          return sum + (value == null ? 0 : value * WEIGHTS[category]);
        }, 0) / availableWeighted
      )
    : 0;

  const evidenceCoverage = Math.round(
    CATEGORIES.reduce((sum, category) => sum + categories[category].coverage * WEIGHTS[category], 0) /
    Object.values(WEIGHTS).reduce((sum, value) => sum + value, 0)
  );

  const qualityGate = Boolean(
    (!graphValidation || graphValidation.valid) &&
    issues.every((issue) => issue.severity !== "CRITICAL") &&
    weightedScore >= 70
  );

  return Object.freeze({
    version: "1.0",
    weightedScore,
    evidenceCoverage,
    qualityGate,
    categories: Object.freeze(categories),
    issues: Object.freeze(issues),
    statistics: Object.freeze({
      pagesAnalyzed: normalizedAudits.length,
      issueCount: issues.length,
      errorCount: issues.filter((item) => item.severity === "ERROR").length,
      warningCount: issues.filter((item) => item.severity === "WARNING").length,
      graphNodes: Number(knowledgeGraph?.statistics?.nodeCount || 0),
      graphEdges: Number(knowledgeGraph?.statistics?.edgeCount || 0)
    })
  });
}

function recommendationForCheck(id) {
  const recommendations = {
    title: "Rewrite the title to be unique, concise and aligned with page intent.",
    description: "Provide a unique, useful meta description within the configured guardrails.",
    canonical: "Ensure the canonical URL is present and points to the canonical page.",
    indexability: "Align robots directives with the intended indexability state.",
    schema: "Repair or enrich the JSON-LD entity graph.",
    "content-depth": "Add useful visible content that directly satisfies the page intent.",
    topics: "Resolve the page to at least one canonical semantic topic.",
    intent: "Resolve and confirm the page's primary search intent.",
    freshness: "Review stale content and update it where the topic warrants freshness.",
    h1: "Keep exactly one meaningful H1.",
    "image-alt": "Add descriptive alt text to every meaningful image.",
    "image-alt-quality": "Replace generic alt text with descriptive context.",
    "image-dimensions": "Provide explicit image dimensions to reduce layout shift.",
    "hero-image-priority": "Prioritize the primary visual asset for loading."
  };
  return recommendations[id] || "Review and correct this diagnostic finding.";
}
