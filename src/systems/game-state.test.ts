import { beforeEach, describe, expect, it } from "vitest";
import type { GameEntity, GameGlobal } from "../domain";
import { World } from "../engine";
import { gameStateSystem } from "./game-state";

function createTestWorld(): World<GameEntity, GameGlobal> {
  return new World<GameEntity, GameGlobal>({
    canvasEl: null as unknown as HTMLCanvasElement,
    canvas: { width: 800, height: 600 },
  });
}

describe("gameStateSystem", () => {
  let world: World<GameEntity, GameGlobal>;

  beforeEach(() => {
    world = createTestWorld();
  });

  describe("timer", () => {
    it("should decrement the time remaining", () => {
      world.addEntity({
        gameState: {
          status: "playing",
          totalItemsSpawned: 0,
          itemsProcessed: 0,
          durationMs: 60_000,
          timeRemainingMs: 30_000,
        },
      });

      gameStateSystem(world, 1000);

      const gameState = world.entities.find((e) => e.gameState)?.gameState;
      expect(gameState?.timeRemainingMs).toBe(29_000);
      expect(gameState?.status).toBe("playing");
    });

    it("should set status to won when time runs out", () => {
      world.addEntity({
        gameState: {
          status: "playing",
          totalItemsSpawned: 0,
          itemsProcessed: 0,
          durationMs: 60_000,
          timeRemainingMs: 500,
        },
      });

      gameStateSystem(world, 1000);

      const gameState = world.entities.find((e) => e.gameState)?.gameState;
      expect(gameState?.timeRemainingMs).toBe(0);
      expect(gameState?.status).toBe("won");
    });
  });

  describe("game already ended", () => {
    it("should not change status if already won", () => {
      world.addEntity({
        gameState: {
          status: "won",
          totalItemsSpawned: 5,
          itemsProcessed: 5,
          durationMs: 60_000,
          timeRemainingMs: 0,
        },
      });

      gameStateSystem(world, 16);

      const gameState = world.entities.find((e) => e.gameState)?.gameState;
      expect(gameState?.status).toBe("won");
    });

    it("should not change status if already lost", () => {
      world.addEntity({
        gameState: {
          status: "lost",
          totalItemsSpawned: 5,
          itemsProcessed: 5,
          durationMs: 60_000,
          timeRemainingMs: 0,
        },
      });

      gameStateSystem(world, 16);

      const gameState = world.entities.find((e) => e.gameState)?.gameState;
      expect(gameState?.status).toBe("lost");
    });
  });
});
