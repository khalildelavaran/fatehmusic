import { describe, expect, it } from "vitest";
import { auditPage } from "./audit.js";

const base = {
  metadata: {
    title: "آموزش گیتار در شوشتر | آموزشگاه موسیقی فاتح",
    description: "کلاس آموزش گیتار در شوشتر برای سطوح مختلف در آموزشگاه موسیقی فاتح.",
    robots: "index,follow"
  },
  url: "https://fatehmusic.ir/courses/guitar-course",
  canonical: "https://fatehmusic.ir/courses/guitar-course",
  schemaGraph: {
    "@graph": [
      { "@id": "https://fatehmusic.ir/#organization" },
      { "@id": "https://fatehmusic.ir/#website" },
      { "@id": "https://fatehmusic.ir/courses/guitar-course#webpage" }
    ]
  },
  topicSlugs: ["guitar", "shushtar"],
  primaryIntent: "local",
  freshness: { status: "fresh" }
};

describe("SEO audit evidence coverage", () => {
  it("reports incomplete evidence coverage separately from quality score", () => {
    const audit = auditPage(base);

    expect(audit.coverageScore).toBeLessThan(100);
    expect(audit.score).toBeGreaterThan(0);
    expect(audit.summary.coverageScore).toBe(audit.coverageScore);
  });

  it("reaches full evidence coverage when all optional checks are supplied", () => {
    const audit = auditPage({
      ...base,
      h1Count: 1,
      missingImageAlt: 0,
      imageAudit: { missingDimensions: 0, genericAlt: 0, heroPriority: true },
      wordCount: 700,
      internalLinkCount: 6,
      webVitals: { lcp: 1800, inp: 120, cls: 0.05 }
    });

    expect(audit.coverageScore).toBe(100);
  });
});
