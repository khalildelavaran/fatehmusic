import { describe, expect, it } from "vitest";
import {
  INTENT_PRIORITY,
  areIntentsCompatible,
  choosePrimaryIntent,
  mergeIntents
} from "./policy.js";

describe("content strategy intent policy", () => {
  it("keeps transactional above local and informational", () => {
    expect(INTENT_PRIORITY.transactional).toBeGreaterThan(INTENT_PRIORITY.local);
    expect(INTENT_PRIORITY.local).toBeGreaterThan(INTENT_PRIORITY.informational);
  });

  it("only merges intent pairs that belong to the same content asset", () => {
    expect(areIntentsCompatible("local", "transactional")).toBe(true);
    expect(areIntentsCompatible("informational", "transactional")).toBe(false);
    expect(areIntentsCompatible("navigational", "commercial")).toBe(false);
  });

  it("deduplicates and keeps deterministic primary intent", () => {
    const merged = mergeIntents(
      ["local", "transactional", "transactional"],
      ["commercial", "informational"]
    );
    expect(merged).toEqual(["local", "transactional", "commercial", "informational"]);
    expect(choosePrimaryIntent(merged)).toBe("transactional");
  });
});
