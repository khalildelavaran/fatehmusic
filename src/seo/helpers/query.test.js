import { describe, expect, it } from "vitest";
import {
  isBrandNavigationQuery,
  isOwnershipEligibleQuery,
  normalizeQuery,
  queryTokens,
  querySemanticDimensions,
  querySemanticFeatureSet
} from "./query.js";

describe("semantic query layer", () => {
  it("normalizes Persian query variants consistently", () => {
    expect(normalizeQuery("آموزش گيتار‌ در شوشتر")).toBe("آموزش گیتار در شوشتر");
  });

  it("removes generic tokens while retaining subject tokens", () => {
    expect([...queryTokens("آموزش گیتار در شوشتر")]).toEqual(["گیتار"]);
  });

  it("distinguishes brand navigation from substantive ownership queries", () => {
    expect(isBrandNavigationQuery("fatehmusic.ir")).toBe(true);
    expect(isBrandNavigationQuery("آموزشگاه موسیقی فاتح")).toBe(true);
    expect(isBrandNavigationQuery("fateh music academy shushtar")).toBe(true);
    expect(isBrandNavigationQuery("فاتح موزیک شوشتر")).toBe(true);
    expect(isBrandNavigationQuery("آدرس آموزشگاه فاتح شوشتر")).toBe(true);
    expect(isBrandNavigationQuery("ثبت نام آموزشگاه موسیقی فاتح")).toBe(true);
    expect(isBrandNavigationQuery("آدرس آموزشگاه فاتح شوشتر")).toBe(true);
    expect(isBrandNavigationQuery("کلاس گیتار در آموزشگاه فاتح")).toBe(false);
    expect(isBrandNavigationQuery("آموزشگاه گیتار فاتح")).toBe(false);
    expect(isBrandNavigationQuery("آموزشگاه موسیقی فاتح برای کودکان")).toBe(false);
    expect(isOwnershipEligibleQuery("آموزش گیتار")).toBe(true);
    expect(isOwnershipEligibleQuery("گیتار")).toBe(false);
    expect(isOwnershipEligibleQuery("آدرس آموزشگاه فاتح شوشتر")).toBe(false);
  });
});


describe("semantic modifier ontology", () => {
  it("maps pricing synonyms to the same semantic family", () => {
    expect(querySemanticDimensions("قیمت کلاس گیتار").modifierFamilies).toEqual(["pricing"]);
    expect(querySemanticDimensions("هزینه گیتار").modifierFamilies).toEqual(["pricing"]);
    expect([...querySemanticFeatureSet("قیمت کلاس گیتار")]).toEqual(
      expect.arrayContaining(["گیتار", "mod:pricing"])
    );
    expect([...querySemanticFeatureSet("هزینه گیتار")]).toEqual(
      expect.arrayContaining(["گیتار", "mod:pricing"])
    );
  });

  it("keeps local scope explicit", () => {
    expect(querySemanticFeatureSet("کلاس گیتار شوشتر").has("scope:local")).toBe(true);
    expect(querySemanticFeatureSet("کلاس گیتار").has("scope:local")).toBe(false);
  });
});
