import { describe, expect, it } from "vitest";
import { barWidths, donutArcPath, formatDecimal, percent } from "./geometry.js";

describe("donutArcPath", () => {
  it("is empty for zero and invalid rates", () => {
    expect(donutArcPath(0, 42, 42, 34)).toBe("");
    expect(donutArcPath(Number.NaN, 42, 42, 34)).toBe("");
  });
  it("draws a half circle for 0.5 ending at the bottom", () => {
    expect(donutArcPath(0.5, 42, 42, 34)).toBe("M 42 8 A 34 34 0 0 1 42 76");
  });
  it("uses the large-arc flag past half", () => {
    expect(donutArcPath(0.75, 42, 42, 34)).toBe("M 42 8 A 34 34 0 1 1 8 42");
  });
  it("closes a full circle with two arcs and clamps above one", () => {
    const full = "M 42 8 A 34 34 0 1 1 42 76 A 34 34 0 1 1 42 8";
    expect(donutArcPath(1, 42, 42, 34)).toBe(full);
    expect(donutArcPath(7, 42, 42, 34)).toBe(full);
  });
});

describe("barWidths", () => {
  it("guards a zero or negative max", () => {
    expect(barWidths([5, 0], 0)).toEqual([0, 0]);
    expect(barWidths([5], -1)).toEqual([0]);
  });
  it("scales one value to the max", () => {
    expect(barWidths([50], 50)).toEqual([100]);
    expect(barWidths([1, 3], 4)).toEqual([25, 75]);
  });
  it("handles large values and clamps overflow", () => {
    expect(barWidths([5_000_000, 10_000_000], 10_000_000)).toEqual([50, 100]);
    expect(barWidths([20], 10)).toEqual([100]);
  });
});

describe("formatting", () => {
  it("percent rounds and clamps", () => {
    expect(percent(0)).toBe("0%");
    expect(percent(0.3333)).toBe("33%");
    expect(percent(1)).toBe("100%");
  });
  it("formatDecimal trims to two places", () => {
    expect(formatDecimal(0)).toBe("0");
    expect(formatDecimal(1.3333)).toBe("1.33");
  });
});
