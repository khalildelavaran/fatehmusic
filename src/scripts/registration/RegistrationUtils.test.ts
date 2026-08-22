import { describe, expect, it } from "vitest";
import { isValidNationalCode, normalizeNationalCode } from "./RegistrationUtils";

describe("Iranian national code validation", () => {
  it("accepts a valid national code", () => {
    expect(isValidNationalCode("1234567891")).toBe(true);
  });

  it("accepts Persian digits and normalizes them", () => {
    expect(normalizeNationalCode("۱۲۳۴۵۶۷۸۹۱")).toBe("1234567891");
    expect(isValidNationalCode("۱۲۳۴۵۶۷۸۹۱")).toBe(true);
  });

  it("rejects an invalid check digit", () => {
    expect(isValidNationalCode("1234567890")).toBe(false);
  });

  it("rejects repeated placeholder digits", () => {
    expect(isValidNationalCode("0000000000")).toBe(false);
    expect(isValidNationalCode("1111111111")).toBe(false);
  });

  it("rejects codes that are not exactly ten digits", () => {
    expect(isValidNationalCode("123456789")).toBe(false);
    expect(isValidNationalCode("12345678912")).toBe(false);
  });
});
