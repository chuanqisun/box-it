/**
 * Collision utilities for ECS.
 * These are pure functions that can be used by any system for collision detection.
 */

import type { GameEntity } from "../domain";

export interface Point {
  x: number;
  y: number;
}

export interface Circle {
  center: Point;
  radius: number;
}

export interface Rectangle {
  center: Point;
  width: number;
  height: number;
  rotation?: number;
}

/**
 * Get the center point of an entity with transform and collision components.
 */
export function getEntityCenter(entity: GameEntity): Point {
  if (!entity.transform || !entity.collision) return { x: 0, y: 0 };
  return {
    x: entity.transform.x + entity.collision.width / 2,
    y: entity.transform.y + entity.collision.height / 2,
  };
}

/**
 * Get the collision radius of an entity.
 */
export function getEntityRadius(entity: GameEntity): number {
  if (!entity.collision) return 0;
  if (entity.collision.type === "circle" && entity.collision.radius) {
    return entity.collision.radius;
  }
  return Math.max(entity.collision.width, entity.collision.height) / 2;
}

/**
 * Calculate distance between two points.
 */
export function getDistance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Check if two circles are colliding.
 */
export function circlesCollide(a: Circle, b: Circle): boolean {
  return getDistance(a.center, b.center) <= a.radius + b.radius;
}

/**
 * Check if a point is inside a rectangle.
 */
export function pointInRect(point: Point, rect: Rectangle): boolean {
  // For non-rotated rectangles
  if (!rect.rotation || rect.rotation === 0) {
    const left = rect.center.x - rect.width / 2;
    const right = rect.center.x + rect.width / 2;
    const top = rect.center.y - rect.height / 2;
    const bottom = rect.center.y + rect.height / 2;
    return point.x >= left && point.x <= right && point.y >= top && point.y <= bottom;
  }

  // For rotated rectangles, transform point to local space
  const cos = Math.cos(-rect.rotation);
  const sin = Math.sin(-rect.rotation);
  const dx = point.x - rect.center.x;
  const dy = point.y - rect.center.y;
  const localX = dx * cos - dy * sin;
  const localY = dx * sin + dy * cos;

  return Math.abs(localX) <= rect.width / 2 && Math.abs(localY) <= rect.height / 2;
}

/**
 * Check collision between two entities using their collision components.
 * Returns true if the entities are colliding.
 */
export function entitiesCollide(a: GameEntity, b: GameEntity): boolean {
  if (!a.transform || !a.collision || !b.transform || !b.collision) {
    return false;
  }

  const centerA = getEntityCenter(a);
  const centerB = getEntityCenter(b);
  const radiusA = getEntityRadius(a);
  const radiusB = getEntityRadius(b);

  // Circle-Circle collision
  if (a.collision.type === "circle" && b.collision.type === "circle") {
    return circlesCollide(
      { center: centerA, radius: radiusA },
      { center: centerB, radius: radiusB }
    );
  }

  // For mixed types or rectangle-rectangle, use circle approximation for simplicity
  return getDistance(centerA, centerB) <= radiusA + radiusB;
}

/**
 * Find all entities that collide with a given entity.
 */
export function findCollidingEntities(entity: GameEntity, candidates: GameEntity[]): GameEntity[] {
  return candidates.filter((candidate) => candidate.id !== entity.id && entitiesCollide(entity, candidate));
}
