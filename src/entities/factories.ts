/**
 * Entity factory functions.
 * These create entity data objects that can be added to the world.
 * Each factory returns an object that can be passed to world.addEntity().
 */

import type { GameEntity } from "../domain";

// Constants for entity creation
const BOX_WIDTH = 180;
const BOX_HEIGHT = 130;
const ZONE_SIZE = 200;
const TOOL_SIZE = 80;
const ITEM_SIZE = 56;

type EntityData = Omit<GameEntity, "id">;

/**
 * Create the feedback entity that stores visual feedback effects.
 */
export function createFeedbackEntity(): EntityData {
  return {
    feedback: { effects: [] },
  };
}

/**
 * Create the interactions entity that stores interaction rules.
 */
export function createInteractionsEntity(): EntityData {
  return {
    interactions: { rules: [] },
  };
}

/**
 * Create the conveyor entity with spawner.
 */
export function createConveyorEntity(canvasHeight: number): EntityData {
  return {
    conveyor: {
      isActive: false,
      offset: 0,
      speed: 160,
      width: 300,
      length: canvasHeight * 0.55,
    },
    spawner: { timer: 0, interval: 1000, queue: [] },
  };
}

/**
 * Create the player's box entity.
 */
export function createBoxEntity(): EntityData {
  return {
    transform: { x: 0, y: 0, rotation: 0, scale: 1 },
    collision: { width: BOX_WIDTH, height: BOX_HEIGHT, type: "rectangle" },
    render: { emoji: "📦" },
    box: { hasBox: false },
  };
}

/**
 * Create a zone entity (restock or shipping).
 */
export function createZoneEntity(type: "restock" | "shipping"): EntityData {
  return {
    zone: { type },
    transform: { x: 0, y: 0, rotation: 0, scale: 1 },
    collision: { width: ZONE_SIZE, height: ZONE_SIZE, type: "rectangle" },
  };
}

/**
 * Create the pointer entity that tracks player input.
 */
export function createPointerEntity(): EntityData {
  return {
    pointer: { x: 0, y: 0, rotation: 0 },
  };
}

/**
 * Create a tool entity.
 * @param id - Tool identifier
 * @param x - Center X position
 * @param y - Center Y position
 * @param width - Bounding box width (optional, defaults to TOOL_SIZE)
 * @param height - Bounding box height (optional, defaults to TOOL_SIZE)
 * @param xOffset - X offset from center in local coordinates (optional)
 * @param yOffset - Y offset from center in local coordinates (optional)
 */
export function createToolEntity(
  id: "tool1" | "tool2" | "tool3",
  x: number,
  y: number,
  width: number = TOOL_SIZE,
  height: number = TOOL_SIZE,
  xOffset: number = 0,
  yOffset: number = 0
): EntityData {
  return {
    tool: { id, isColliding: false, isActive: false },
    transform: { x, y, rotation: 0, scale: 1 },
    collision: { width, height, type: "rectangle", xOffset, yOffset },
  };
}

/**
 * Create the score entity.
 */
export function createScoreEntity(initialValue: number = 600): EntityData {
  return {
    score: { value: initialValue, packedCount: 0 },
  };
}

/**
 * Create the game state entity.
 */
export function createGameStateEntity(): EntityData {
  return {
    gameState: {
      status: "playing",
      timerStarted: false,
      totalItemsSpawned: 0,
      itemsProcessed: 0,
      durationMs: 45_000,
      timeRemainingMs: 45_000,
    },
  };
}

/**
 * Create an item entity that spawns on the conveyor.
 */
export function createItemEntity(x: number, y: number, emoji: string, name: string, velocityY: number = 250): EntityData {
  return {
    transform: { x, y, rotation: (Math.random() - 0.5) * 0.5, scale: 1 },
    velocity: { x: 0, y: velocityY },
    render: { emoji },
    name: { value: name },
    collision: { width: ITEM_SIZE, height: ITEM_SIZE, type: "rectangle" },
    itemState: { state: "belt", fallScale: 1 },
    physical: { size: ITEM_SIZE },
  };
}

/**
 * Create a packed item entity (item that landed in the box).
 */
export function createPackedItemEntity(relX: number, relY: number, rotation: number, emoji: string, name: string, fallScale: number): EntityData {
  return {
    transform: { x: relX, y: relY, rotation, scale: 0 },
    render: { emoji },
    name: { value: name },
    collision: { width: ITEM_SIZE, height: ITEM_SIZE, type: "rectangle" },
    boxAnchor: { relX, relY },
    itemState: { state: "packed", fallScale },
    physical: { size: ITEM_SIZE },
  };
}

// Export constants for external use
export const EntityConstants = {
  BOX_WIDTH,
  BOX_HEIGHT,
  ZONE_SIZE,
  TOOL_SIZE,
  ITEM_SIZE,
} as const;
