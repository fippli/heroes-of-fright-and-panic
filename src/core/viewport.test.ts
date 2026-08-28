import { describe, expect, it } from "vitest";
import {
  clampTranslation,
  edgeScrollDelta,
  formatViewParam,
  parseViewParam,
  translationCenteredOn,
} from "./viewport";

const bounds = { minX: 0, minY: 0, maxX: 2000, maxY: 1500 };
const viewport = { width: 800, height: 600 };

describe("clampTranslation", () => {
  it("leaves an in-range translation untouched", () => {
    expect(clampTranslation({ x: -500, y: -300 }, bounds, viewport)).toEqual({ x: -500, y: -300 });
  });

  it("does not allow scrolling past the map's near edge", () => {
    expect(clampTranslation({ x: 300, y: 200 }, bounds, viewport)).toEqual({ x: 0, y: 0 });
  });

  it("does not allow scrolling past the map's far edge", () => {
    expect(clampTranslation({ x: -5000, y: -5000 }, bounds, viewport)).toEqual({
      x: viewport.width - bounds.maxX,
      y: viewport.height - bounds.maxY,
    });
  });

  it("respects padding", () => {
    expect(clampTranslation({ x: 300, y: 200 }, bounds, viewport, 50)).toEqual({ x: 50, y: 50 });
  });

  it("centers a map smaller than the viewport", () => {
    const small = { minX: 0, minY: 0, maxX: 200, maxY: 100 };
    expect(clampTranslation({ x: -999, y: 999 }, small, viewport)).toEqual({ x: 300, y: 250 });
  });
});

describe("translationCenteredOn", () => {
  it("puts the point in the middle of the viewport", () => {
    expect(translationCenteredOn({ x: 1000, y: 700 }, viewport)).toEqual({ x: -600, y: -400 });
  });
});

describe("edgeScrollDelta", () => {
  it("is zero when the mouse is not over the canvas", () => {
    expect(edgeScrollDelta(null, viewport, 40, 10)).toEqual({ x: 0, y: 0 });
    expect(edgeScrollDelta({ x: -5, y: 300 }, viewport, 40, 10)).toEqual({ x: 0, y: 0 });
  });

  it("is zero in the middle of the canvas", () => {
    expect(edgeScrollDelta({ x: 400, y: 300 }, viewport, 40, 10)).toEqual({ x: 0, y: 0 });
  });

  it("scrolls the view right (content left) at the right edge, full speed at the very edge", () => {
    expect(edgeScrollDelta({ x: 800, y: 300 }, viewport, 40, 10)).toEqual({ x: -10, y: 0 });
  });

  it("scrolls the view left (content right) at the left edge, ramping with distance", () => {
    expect(edgeScrollDelta({ x: 20, y: 300 }, viewport, 40, 10)).toEqual({ x: 5, y: 0 });
  });

  it("scrolls diagonally in a corner", () => {
    expect(edgeScrollDelta({ x: 0, y: 600 }, viewport, 40, 10)).toEqual({ x: 10, y: -10 });
  });
});

describe("view URL param", () => {
  it("round-trips a center point, rounded to whole pixels", () => {
    expect(formatViewParam({ x: 1234.6, y: -7.2 })).toBe("1235,-7");
    expect(parseViewParam("1235,-7")).toEqual({ x: 1235, y: -7 });
  });

  it("rejects missing or malformed values", () => {
    expect(parseViewParam(null)).toBeNull();
    expect(parseViewParam("")).toBeNull();
    expect(parseViewParam("12")).toBeNull();
    expect(parseViewParam("a,b")).toBeNull();
    expect(parseViewParam("1,2,3")).toBeNull();
    expect(parseViewParam("Infinity,3")).toBeNull();
  });
});
