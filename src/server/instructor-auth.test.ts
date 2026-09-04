import { describe, expect, it } from "vitest";
import { normalizeUsername } from "./instructor-auth";

describe("normalizeUsername", () => {
  it("trims whitespace and lowercases", () => {
    expect(normalizeUsername("  Khalil.D  ")).toBe("khalil.d");
  });

  it("leaves an already-normalized username unchanged", () => {
    expect(normalizeUsername("khalil")).toBe("khalil");
  });
});
