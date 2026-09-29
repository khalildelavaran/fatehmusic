import { describe, expect, it } from "vitest";
import {
  isBrandNavigationQuery,
  isOwnershipEligibleQuery,
  normalizeQuery,
  queryTokens
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
    expect(isBrandNavigationQuery("آدرس آموزشگاه فاتح شوشتر")).toBe(true);
    expect(isBrandNavigationQuery("ثبت نام آموزشگاه موسیقی فاتح")).toBe(true);
    expect(isBrandNavigationQuery("کلاس گیتار در آموزشگاه فاتح")).toBe(false);
    expect(isOwnershipEligibleQuery("آموزش گیتار")).toBe(true);
    expect(isOwnershipEligibleQuery("گیتار")).toBe(false);
    expect(isOwnershipEligibleQuery("آدرس آموزشگاه فاتح شوشتر")).toBe(false);
  });
});
