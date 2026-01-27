/**
 * Geometry utility functions for touch point tracking.
 * These functions provide order-invariant calculations for triangles formed by 3 touch points.
 */

export interface Point {
  x: number;
  y: number;
}

/**
 * Calculate the centroid (geometric center) of a set of points.
 * The centroid is order-invariant - any permutation of points yields the same result.
 */
export function getCentroid(points: Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
}

/**
 * Sort points in canonical order (counterclockwise from positive x-axis relative to centroid).
 * This ensures that any permutation of the same 3 points will result in the same ordering.
 */
export function canonicalOrderPoints<T extends Point>(points: T[]): T[] {
  if (points.length < 2) return [...points];
  
  const centroid = getCentroid(points);
  
  // Calculate angle from centroid for each point
  const pointsWithAngles = points.map((p) => ({
    point: p,
    angle: Math.atan2(p.y - centroid.y, p.x - centroid.x),
  }));
  
  // Sort by angle (counterclockwise from positive x-axis)
  pointsWithAngles.sort((a, b) => a.angle - b.angle);
  
  return pointsWithAngles.map((pa) => pa.point);
}

/**
 * Calculate the three side lengths of a triangle formed by 3 points.
 * Returns sides sorted in ascending order for consistent comparison.
 * This is order-invariant - any permutation of points yields the same sorted sides.
 */
export function calculateSortedSides(points: Point[]): [number, number, number] {
  if (points.length !== 3) {
    throw new Error("calculateSortedSides requires exactly 3 points");
  }
  
  const d01 = getDistance(points[0], points[1]);
  const d12 = getDistance(points[1], points[2]);
  const d20 = getDistance(points[2], points[0]);
  
  const sides = [d01, d12, d20].sort((a, b) => a - b);
  return [sides[0], sides[1], sides[2]];
}

/**
 * Calculate the rotation angle of a triangle based on its longest edge.
 * Uses canonical point ordering to ensure consistent results regardless of input order.
 * 
 * The rotation is calculated as the angle of the longest edge from the positive x-axis.
 * To avoid 180° ambiguity, we use a consistent direction based on the third vertex position.
 * 
 * @param points - The 3 points forming the triangle (will be canonically ordered internally)
 * @param previousRotation - Optional previous rotation for continuity (avoids sudden flips)
 * @returns Rotation angle in radians
 */
export function getCanonicalRotation(points: Point[], previousRotation?: number): number {
  if (points.length !== 3) {
    throw new Error("getCanonicalRotation requires exactly 3 points");
  }
  
  // First, put points in canonical order
  const orderedPoints = canonicalOrderPoints(points);
  
  // Find the longest edge
  const edges = [
    { i: 0, j: 1, dist: getDistance(orderedPoints[0], orderedPoints[1]) },
    { i: 1, j: 2, dist: getDistance(orderedPoints[1], orderedPoints[2]) },
    { i: 2, j: 0, dist: getDistance(orderedPoints[2], orderedPoints[0]) },
  ];
  
  // Sort by distance descending
  edges.sort((a, b) => b.dist - a.dist);
  const longestEdge = edges[0];
  
  // Get the two points forming the longest edge
  const p1 = orderedPoints[longestEdge.i];
  const p2 = orderedPoints[longestEdge.j];
  
  // The third point (not on the longest edge)
  const thirdIndex = 3 - longestEdge.i - longestEdge.j;
  const p3 = orderedPoints[thirdIndex];
  
  // Calculate the midpoint of the longest edge
  const midpoint = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  
  // Direction from midpoint to third point determines the "front" of the triangle
  // We want the rotation to point in a consistent direction relative to this
  const toThird = { x: p3.x - midpoint.x, y: p3.y - midpoint.y };
  
  // Edge direction from p1 to p2
  const edgeDir = { x: p2.x - p1.x, y: p2.y - p1.y };
  
  // The perpendicular to the edge that points toward p3
  // Cross product in 2D gives us which side p3 is on
  const cross = edgeDir.x * toThird.y - edgeDir.y * toThird.x;
  
  // Calculate base angle from p1 to p2
  let baseAngle = Math.atan2(edgeDir.y, edgeDir.x);
  
  // If p3 is on the "negative" side (cross < 0), flip the direction to maintain consistency
  // This ensures that regardless of which vertex is labeled p1 or p2, we get the same result
  if (cross < 0) {
    baseAngle = normalizeAngle(baseAngle + Math.PI);
  }
  
  // If we have a previous rotation, avoid sudden 180° flips
  if (previousRotation !== undefined) {
    const flipped = normalizeAngle(baseAngle + Math.PI);
    const baseDelta = Math.abs(normalizeAngle(baseAngle - previousRotation));
    const flippedDelta = Math.abs(normalizeAngle(flipped - previousRotation));
    return flippedDelta < baseDelta ? flipped : baseAngle;
  }
  
  return baseAngle;
}

/**
 * Calculate Euclidean distance between two points.
 */
export function getDistance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Normalize angle to [-π, π] range.
 */
export function normalizeAngle(angle: number): number {
  const TWO_PI = Math.PI * 2;
  const normalized = ((angle % TWO_PI) + TWO_PI) % TWO_PI;
  return normalized > Math.PI ? normalized - TWO_PI : normalized;
}
