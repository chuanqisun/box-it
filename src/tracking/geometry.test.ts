import { describe, expect, test } from "vitest";
import {
  canonicalOrderPoints,
  calculateSortedSides,
  getCanonicalRotation,
  getCentroid,
  getDistance,
  normalizeAngle,
  type Point,
} from "./geometry";

describe("geometry utilities", () => {
  describe("getCentroid", () => {
    test("returns origin for empty array", () => {
      expect(getCentroid([])).toEqual({ x: 0, y: 0 });
    });

    test("returns the point itself for single point", () => {
      expect(getCentroid([{ x: 5, y: 10 }])).toEqual({ x: 5, y: 10 });
    });

    test("calculates correct centroid for 3 points", () => {
      const points = [
        { x: 0, y: 0 },
        { x: 3, y: 0 },
        { x: 0, y: 6 },
      ];
      expect(getCentroid(points)).toEqual({ x: 1, y: 2 });
    });

    test("centroid is order-invariant", () => {
      const p1 = { x: 10, y: 20 };
      const p2 = { x: 30, y: 40 };
      const p3 = { x: 50, y: 10 };

      const order1 = getCentroid([p1, p2, p3]);
      const order2 = getCentroid([p2, p3, p1]);
      const order3 = getCentroid([p3, p1, p2]);
      const order4 = getCentroid([p3, p2, p1]);

      expect(order1).toEqual(order2);
      expect(order2).toEqual(order3);
      expect(order3).toEqual(order4);
    });
  });

  describe("canonicalOrderPoints", () => {
    test("returns empty array for empty input", () => {
      expect(canonicalOrderPoints([])).toEqual([]);
    });

    test("returns single point unchanged", () => {
      const point = { x: 5, y: 10 };
      expect(canonicalOrderPoints([point])).toEqual([point]);
    });

    test("produces consistent order regardless of input permutation", () => {
      const p1 = { x: 100, y: 50 };
      const p2 = { x: 50, y: 150 };
      const p3 = { x: 150, y: 150 };

      // All 6 permutations
      const perm1 = canonicalOrderPoints([p1, p2, p3]);
      const perm2 = canonicalOrderPoints([p1, p3, p2]);
      const perm3 = canonicalOrderPoints([p2, p1, p3]);
      const perm4 = canonicalOrderPoints([p2, p3, p1]);
      const perm5 = canonicalOrderPoints([p3, p1, p2]);
      const perm6 = canonicalOrderPoints([p3, p2, p1]);

      // All should produce the same ordering
      expect(perm1).toEqual(perm2);
      expect(perm2).toEqual(perm3);
      expect(perm3).toEqual(perm4);
      expect(perm4).toEqual(perm5);
      expect(perm5).toEqual(perm6);
    });

    test("preserves point identity (same objects, just reordered)", () => {
      const p1 = { x: 10, y: 20, id: "a" } as Point & { id: string };
      const p2 = { x: 30, y: 40, id: "b" } as Point & { id: string };
      const p3 = { x: 50, y: 10, id: "c" } as Point & { id: string };

      const ordered = canonicalOrderPoints([p1, p2, p3]);
      
      // Check that the original points are in the result (by reference)
      expect(ordered).toContain(p1);
      expect(ordered).toContain(p2);
      expect(ordered).toContain(p3);
    });
  });

  describe("calculateSortedSides", () => {
    test("throws for non-3 points", () => {
      expect(() => calculateSortedSides([{ x: 0, y: 0 }])).toThrow();
      expect(() => calculateSortedSides([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toThrow();
    });

    test("calculates correct side lengths for right triangle", () => {
      const points = [
        { x: 0, y: 0 },
        { x: 3, y: 0 },
        { x: 0, y: 4 },
      ];
      const sides = calculateSortedSides(points);
      
      // 3-4-5 right triangle
      expect(sides[0]).toBeCloseTo(3, 5);
      expect(sides[1]).toBeCloseTo(4, 5);
      expect(sides[2]).toBeCloseTo(5, 5);
    });

    test("is order-invariant", () => {
      const p1 = { x: 0, y: 0 };
      const p2 = { x: 100, y: 0 };
      const p3 = { x: 50, y: 80 };

      const order1 = calculateSortedSides([p1, p2, p3]);
      const order2 = calculateSortedSides([p2, p3, p1]);
      const order3 = calculateSortedSides([p3, p1, p2]);
      const order4 = calculateSortedSides([p3, p2, p1]);

      expect(order1).toEqual(order2);
      expect(order2).toEqual(order3);
      expect(order3).toEqual(order4);
    });
  });

  describe("getCanonicalRotation", () => {
    test("throws for non-3 points", () => {
      expect(() => getCanonicalRotation([{ x: 0, y: 0 }])).toThrow();
    });

    test("is order-invariant (critical test)", () => {
      // This is the main bug we're fixing - the rotation should not depend
      // on the order in which touch points appear
      const p1 = { x: 100, y: 100 };
      const p2 = { x: 200, y: 100 };
      const p3 = { x: 150, y: 50 };

      // All 6 permutations
      const rot1 = getCanonicalRotation([p1, p2, p3]);
      const rot2 = getCanonicalRotation([p1, p3, p2]);
      const rot3 = getCanonicalRotation([p2, p1, p3]);
      const rot4 = getCanonicalRotation([p2, p3, p1]);
      const rot5 = getCanonicalRotation([p3, p1, p2]);
      const rot6 = getCanonicalRotation([p3, p2, p1]);

      // All rotations should be identical (within floating point tolerance)
      expect(rot1).toBeCloseTo(rot2, 5);
      expect(rot2).toBeCloseTo(rot3, 5);
      expect(rot3).toBeCloseTo(rot4, 5);
      expect(rot4).toBeCloseTo(rot5, 5);
      expect(rot5).toBeCloseTo(rot6, 5);
    });

    test("returns consistent rotation for isoceles triangle with different orderings", () => {
      // Isoceles triangle with apex at top
      const apex = { x: 100, y: 50 };
      const left = { x: 50, y: 150 };
      const right = { x: 150, y: 150 };

      const rot1 = getCanonicalRotation([apex, left, right]);
      const rot2 = getCanonicalRotation([left, right, apex]);
      const rot3 = getCanonicalRotation([right, apex, left]);

      expect(rot1).toBeCloseTo(rot2, 5);
      expect(rot2).toBeCloseTo(rot3, 5);
    });

    test("rotation changes smoothly with previous rotation context", () => {
      const points = [
        { x: 100, y: 100 },
        { x: 200, y: 100 },
        { x: 150, y: 50 },
      ];

      const initialRot = getCanonicalRotation(points);
      
      // Slight rotation of all points
      const angle = 0.1; // radians
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const cx = 150, cy = 83.33; // approximate centroid
      
      const rotatedPoints = points.map(p => ({
        x: cx + (p.x - cx) * cos - (p.y - cy) * sin,
        y: cy + (p.x - cx) * sin + (p.y - cy) * cos,
      }));

      const newRot = getCanonicalRotation(rotatedPoints, initialRot);
      
      // The difference should be approximately the rotation angle we applied
      const diff = Math.abs(normalizeAngle(newRot - initialRot));
      expect(diff).toBeCloseTo(angle, 1);
    });
  });

  describe("getDistance", () => {
    test("returns 0 for same point", () => {
      expect(getDistance({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(0);
    });

    test("calculates correct horizontal distance", () => {
      expect(getDistance({ x: 0, y: 0 }, { x: 10, y: 0 })).toBe(10);
    });

    test("calculates correct vertical distance", () => {
      expect(getDistance({ x: 0, y: 0 }, { x: 0, y: 10 })).toBe(10);
    });

    test("calculates correct diagonal distance", () => {
      expect(getDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    });
  });

  describe("normalizeAngle", () => {
    test("leaves angles in range unchanged", () => {
      expect(normalizeAngle(0)).toBeCloseTo(0, 5);
      expect(normalizeAngle(Math.PI / 2)).toBeCloseTo(Math.PI / 2, 5);
      expect(normalizeAngle(-Math.PI / 2)).toBeCloseTo(-Math.PI / 2, 5);
    });

    test("normalizes angles > π", () => {
      expect(normalizeAngle(Math.PI + 0.5)).toBeCloseTo(-Math.PI + 0.5, 5);
    });

    test("normalizes angles < -π", () => {
      expect(normalizeAngle(-Math.PI - 0.5)).toBeCloseTo(Math.PI - 0.5, 5);
    });

    test("handles multiple rotations", () => {
      expect(normalizeAngle(5 * Math.PI)).toBeCloseTo(Math.PI, 5);
      // -5π normalizes to π (same as -π since they're equivalent)
      const result = normalizeAngle(-5 * Math.PI);
      // Should be either π or -π (they're equivalent)
      expect(Math.abs(result)).toBeCloseTo(Math.PI, 5);
    });
  });
});
