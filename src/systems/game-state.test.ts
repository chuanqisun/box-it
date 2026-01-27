import { describe, it, expect, beforeEach } from "vitest";
import { World } from "../engine";
import type { GameEntity, GameGlobal } from "../domain";
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

  describe("lose condition", () => {
    it("should set status to lost when score < 200 and no box", () => {
      world
        .addEntity({ gameState: { status: "playing", totalItemsSpawned: 5, itemsProcessed: 3 } })
        .addEntity({ score: { value: 100, packedCount: 0 } })
        .addEntity({ box: { hasBox: false } })
        .addEntity({ spawner: { timer: 0, interval: 1000, queue: [] } });

      gameStateSystem(world, 16);

      const gameState = world.entities.find((e) => e.gameState)?.gameState;
      expect(gameState?.status).toBe("lost");
    });

    it("should not lose if player has a box", () => {
      world
        .addEntity({ gameState: { status: "playing", totalItemsSpawned: 5, itemsProcessed: 3 } })
        .addEntity({ score: { value: 100, packedCount: 0 } })
        .addEntity({ box: { hasBox: true } })
        .addEntity({ spawner: { timer: 0, interval: 1000, queue: [] } });

      gameStateSystem(world, 16);

      const gameState = world.entities.find((e) => e.gameState)?.gameState;
      expect(gameState?.status).toBe("playing");
    });

    it("should not lose if score >= 200", () => {
      world
        .addEntity({ gameState: { status: "playing", totalItemsSpawned: 5, itemsProcessed: 3 } })
        .addEntity({ score: { value: 200, packedCount: 0 } })
        .addEntity({ box: { hasBox: false } })
        .addEntity({ spawner: { timer: 0, interval: 1000, queue: [] } });

      gameStateSystem(world, 16);

      const gameState = world.entities.find((e) => e.gameState)?.gameState;
      expect(gameState?.status).toBe("playing");
    });
  });

  describe("win condition", () => {
    it("should set status to won when all items processed", () => {
      world
        .addEntity({ gameState: { status: "playing", totalItemsSpawned: 5, itemsProcessed: 5 } })
        .addEntity({ score: { value: 1000, packedCount: 0 } })
        .addEntity({ box: { hasBox: true } })
        .addEntity({ spawner: { timer: 0, interval: 1000, queue: [] } });

      gameStateSystem(world, 16);

      const gameState = world.entities.find((e) => e.gameState)?.gameState;
      expect(gameState?.status).toBe("won");
    });

    it("should not win if items are still in queue", () => {
      world
        .addEntity({ gameState: { status: "playing", totalItemsSpawned: 5, itemsProcessed: 5 } })
        .addEntity({ score: { value: 1000, packedCount: 0 } })
        .addEntity({ box: { hasBox: true } })
        .addEntity({ spawner: { timer: 0, interval: 1000, queue: [{ name: "apple", emoji: "🍎" }] } });

      gameStateSystem(world, 16);

      const gameState = world.entities.find((e) => e.gameState)?.gameState;
      expect(gameState?.status).toBe("playing");
    });

    it("should not win if active items exist", () => {
      world
        .addEntity({ gameState: { status: "playing", totalItemsSpawned: 5, itemsProcessed: 5 } })
        .addEntity({ score: { value: 1000, packedCount: 0 } })
        .addEntity({ box: { hasBox: true } })
        .addEntity({ spawner: { timer: 0, interval: 1000, queue: [] } })
        .addEntity({ itemState: { state: "belt", fallScale: 1 }, transform: { x: 0, y: 0, rotation: 0, scale: 1 } });

      gameStateSystem(world, 16);

      const gameState = world.entities.find((e) => e.gameState)?.gameState;
      expect(gameState?.status).toBe("playing");
    });

    it("should not win if packed items exist", () => {
      world
        .addEntity({ gameState: { status: "playing", totalItemsSpawned: 5, itemsProcessed: 5 } })
        .addEntity({ score: { value: 1000, packedCount: 0 } })
        .addEntity({ box: { hasBox: true } })
        .addEntity({ spawner: { timer: 0, interval: 1000, queue: [] } })
        .addEntity({ boxAnchor: { relX: 10, relY: 10 } });

      gameStateSystem(world, 16);

      const gameState = world.entities.find((e) => e.gameState)?.gameState;
      expect(gameState?.status).toBe("playing");
    });

    it("should not win if no items have spawned yet", () => {
      world
        .addEntity({ gameState: { status: "playing", totalItemsSpawned: 0, itemsProcessed: 0 } })
        .addEntity({ score: { value: 1000, packedCount: 0 } })
        .addEntity({ box: { hasBox: true } })
        .addEntity({ spawner: { timer: 0, interval: 1000, queue: [] } });

      gameStateSystem(world, 16);

      const gameState = world.entities.find((e) => e.gameState)?.gameState;
      expect(gameState?.status).toBe("playing");
    });
  });

  describe("game already ended", () => {
    it("should not change status if already won", () => {
      world
        .addEntity({ gameState: { status: "won", totalItemsSpawned: 5, itemsProcessed: 5 } })
        .addEntity({ score: { value: 50, packedCount: 0 } })
        .addEntity({ box: { hasBox: false } })
        .addEntity({ spawner: { timer: 0, interval: 1000, queue: [] } });

      gameStateSystem(world, 16);

      const gameState = world.entities.find((e) => e.gameState)?.gameState;
      expect(gameState?.status).toBe("won");
    });

    it("should not change status if already lost", () => {
      world
        .addEntity({ gameState: { status: "lost", totalItemsSpawned: 5, itemsProcessed: 5 } })
        .addEntity({ score: { value: 1000, packedCount: 0 } })
        .addEntity({ box: { hasBox: true } })
        .addEntity({ spawner: { timer: 0, interval: 1000, queue: [] } });

      gameStateSystem(world, 16);

      const gameState = world.entities.find((e) => e.gameState)?.gameState;
      expect(gameState?.status).toBe("lost");
    });
  });
});
