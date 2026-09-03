import { describe, expect, it } from "vitest";
import { INK, PAPER, contrastRatio, hexToRgb } from "./contrast.ts";

describe("WCAG contrast", () => {
  it("body ink on paper exceeds 4.5:1", () => {
    expect(contrastRatio(INK, PAPER)).toBeGreaterThan(4.5);
  });

  it("deepened Japan red meets 4.5:1 on paper", () => {
    const red = hexToRgb("#9b1b30");
    expect(red).toBeDefined();
    expect(contrastRatio(red!, PAPER)).toBeGreaterThanOrEqual(4.5);
  });
});
