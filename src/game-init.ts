/**
 * Game Initialization Module
 *
 * This module is responsible for setting up the initial game world
 * with all the necessary entities. It separates entity creation
 * from the main game loop logic.
 */

import type { GameEntity, GameGlobal } from "./domain";
import { World } from "./engine";
import {
  createBoxEntity,
  createConveyorEntity,
  createFeedbackEntity,
  createGameStateEntity,
  createInteractionsEntity,
  createPointerEntity,
  createScoreEntity,
  createToolEntity,
  createZoneEntity,
  EntityConstants,
} from "./entities/factories";

export interface GameInitConfig {
  canvas: HTMLCanvasElement;
  initialScore?: number;
}

/**
 * Create and initialize the game world with all necessary entities.
 */
export function createGameWorld(config: GameInitConfig): World<GameEntity, GameGlobal> {
  const { canvas, initialScore = 600 } = config;
  const { TOOL_SIZE } = EntityConstants;

  const initialGlobal: GameGlobal = {
    canvasEl: canvas,
    canvas: { width: window.innerWidth, height: window.innerHeight },
  };

  const world = new World<GameEntity, GameGlobal>(initialGlobal)
    // Core game entities
    .addEntity(createFeedbackEntity())
    .addEntity(createInteractionsEntity())
    .addEntity(createConveyorEntity(window.innerHeight))
    .addEntity(createBoxEntity())
    .addEntity(createZoneEntity("restock"))
    .addEntity(createZoneEntity("shipping"))
    .addEntity(createPointerEntity())
    // Tools - positioned at corners
    .addEntity(createToolEntity("tool1", 40, 40))
    .addEntity(createToolEntity("tool2", window.innerWidth - TOOL_SIZE - 40, 40))
    .addEntity(createToolEntity("tool3", 40, window.innerHeight - TOOL_SIZE - 40))
    // Game state entities
    .addEntity(createScoreEntity(initialScore))
    .addEntity(createGameStateEntity());

  return world;
}

/**
 * Reset the game world to its initial state for a new game.
 */
export function resetGameWorld(world: World<GameEntity, GameGlobal>): void {
  world.updateEntities((entities) =>
    entities.map((e) => {
      if (e.gameState) {
        return {
          ...e,
          gameState: {
            status: "playing" as const,
            totalItemsSpawned: 0,
            itemsProcessed: 0,
            durationMs: 30_000,
            timeRemainingMs: 30_000,
          },
        };
      }
      if (e.score) {
        return { ...e, score: { value: 600, packedCount: 0 } };
      }
      if (e.box) {
        return { ...e, box: { hasBox: false } };
      }
      if (e.conveyor) {
        return { ...e, conveyor: { ...e.conveyor, isActive: false, offset: 0 } };
      }
      if (e.spawner) {
        return { ...e, spawner: { ...e.spawner, timer: 0, queue: [] } };
      }
      if (e.feedback) {
        return { ...e, feedback: { effects: [] } };
      }
      if (e.interactions) {
        return { ...e, interactions: { rules: [] } };
      }
      if (e.tool) {
        return { ...e, tool: { ...e.tool, isTouching: false, isColliding: false, movingItemId: null } };
      }
      return e;
    })
  );

  // Remove all items (belt items and packed items)
  const itemsToRemove = world.entities.filter((e) => e.itemState || e.boxAnchor);
  itemsToRemove.forEach((item) => world.removeEntity(item.id));
}
