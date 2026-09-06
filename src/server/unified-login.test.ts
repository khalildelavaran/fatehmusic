import { describe, expect, it } from "vitest";
import { looksLikeNationalCode } from "./unified-login";

describe("looksLikeNationalCode", () => {
  it("recognizes a valid 10-digit national code", () => {
    expect(looksLikeNationalCode("0011122233")).toBe(true);
  });

  it("trims surrounding whitespace before checking", () => {
    expect(looksLikeNationalCode("  0011122233  ")).toBe(true);
  });

  it("rejects a typical username", () => {
    expect(looksLikeNationalCode("khalil")).toBe(false);
    expect(looksLikeNationalCode("admin")).toBe(false);
  });

  it("rejects a 9-digit or 11-digit numeric string", () => {
    expect(looksLikeNationalCode("001112223")).toBe(false);
    expect(looksLikeNationalCode("00111222334")).toBe(false);
  });

  it("rejects a numeric-looking username with letters mixed in", () => {
    expect(looksLikeNationalCode("00111a2233")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(looksLikeNationalCode("")).toBe(false);
  });
});
