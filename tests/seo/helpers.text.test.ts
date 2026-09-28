import { describe, expect, it } from "vitest";
import { truncate } from "../../src/seo/helpers/text.js";

describe("truncate", () => {
  it("never exceeds maxLength, including the ellipsis", () => {
    const result = truncate("این یک متن طولانی برای بررسی محدودیت طول است", 20);
    expect(result.length).toBeLessThanOrEqual(20);
    expect(result.endsWith("…")).toBe(true);
  });

  it("keeps short values unchanged", () => {
    expect(truncate("متن کوتاه", 20)).toBe("متن کوتاه");
  });
});