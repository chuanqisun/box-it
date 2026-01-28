import { beforeEach, describe, expect, it } from "vitest";
import type { GameEntity, GameGlobal } from "../domain";
import { World } from "../engine";
import { itemStateSystem } from "./item-state";

function createTestWorld(): World<GameEntity, GameGlobal> {
  return new World<GameEntity, GameGlobal>({
    canvasEl: null as unknown as HTMLCanvasElement,
    canvas: { width: 800, height: 600 },
  });
}

describe("itemStateSystem", () => {
  let world: World<GameEntity, GameGlobal>;

  beforeEach(() => {
    world = createTestWorld();
  });

  describe("belt to falling transition", () => {
    it("should transition item from belt to falling when past conveyor length", () => {
      world
        .addEntity({
          conveyor: { isActive: true, offset: 0, speed: 250, width: 300, length: 300 },
        })
        .addEntity({
          transform: { x: 100, y: 350, rotation: 0, scale: 1 },
          velocity: { x: 0, y: 250 },
          itemState: { state: "belt", fallScale: 1 },
        });

      itemStateSystem(world, 16);

      const item = world.entities.find((e) => e.itemState);
      expect(item?.itemState?.state).toBe("falling");
      expect(item?.velocity?.y).toBe(450); // ITEM_SPEED_FALL
    });

    it("should keep item on belt if not past conveyor length", () => {
      world
        .addEntity({
          conveyor: { isActive: true, offset: 0, speed: 250, width: 300, length: 300 },
        })
        .addEntity({
          transform: { x: 100, y: 200, rotation: 0, scale: 1 },
          velocity: { x: 0, y: 250 },
          itemState: { state: "belt", fallScale: 1 },
        });

      itemStateSystem(world, 16);

      const item = world.entities.find((e) => e.itemState);
      expect(item?.itemState?.state).toBe("belt");
      expect(item?.velocity?.y).toBe(250);
    });
  });

  describe("falling state", () => {
    it("should decrease fallScale when falling", () => {
      world.addEntity({
        transform: { x: 100, y: 400, rotation: 0, scale: 1 },
        velocity: { x: 0, y: 450 },
        itemState: { state: "falling", fallScale: 1 },
      });

      itemStateSystem(world, 1000); // 1 second

      const item = world.entities.find((e) => e.itemState);
      expect(item?.itemState?.fallScale).toBe(0.5); // 1 - 0.5
    });

    it("should not decrease fallScale below 0.7", () => {
      world.addEntity({
        transform: { x: 100, y: 400, rotation: 0, scale: 1 },
        velocity: { x: 0, y: 450 },
        itemState: { state: "falling", fallScale: 0.7 },
      });

      itemStateSystem(world, 1000);

      const item = world.entities.find((e) => e.itemState);
      expect(item?.itemState?.fallScale).toBe(0.7);
    });
  });

  describe("item removal", () => {
    it("should remove items that fall off screen", () => {
      world.addEntity({
        transform: { x: 100, y: 750, rotation: 0, scale: 1 }, // > 600 + 100
        velocity: { x: 0, y: 450 },
        itemState: { state: "falling", fallScale: 0.8 },
      });

      itemStateSystem(world, 16);

      const items = world.entities.filter((e) => e.itemState);
      expect(items.length).toBe(0);
    });

    it("should not remove packed items", () => {
      world.addEntity({
        transform: { x: 100, y: 750, rotation: 0, scale: 1 },
        velocity: { x: 0, y: 0 },
        itemState: { state: "packed", fallScale: 1 },
        boxAnchor: { relX: 50, relY: 50 },
      });

      itemStateSystem(world, 16);

      const items = world.entities.filter((e) => e.itemState);
      expect(items.length).toBe(1);
    });

    it("should increment itemsProcessed in gameState when item removed", () => {
      world
        .addEntity({
          gameState: {
            status: "playing",
            totalItemsSpawned: 5,
            itemsProcessed: 2,
            durationMs: 30_000,
            timeRemainingMs: 30_000,
          },
        })
        .addEntity({
          transform: { x: 100, y: 750, rotation: 0, scale: 1 },
          velocity: { x: 0, y: 450 },
          itemState: { state: "falling", fallScale: 0.8 },
        });

      itemStateSystem(world, 16);

      const gameState = world.entities.find((e) => e.gameState)?.gameState;
      expect(gameState?.itemsProcessed).toBe(3);
    });
  });

  describe("multiple items", () => {
    it("should process all items correctly", () => {
      world
        .addEntity({
          conveyor: { isActive: true, offset: 0, speed: 250, width: 300, length: 300 },
        })
        .addEntity({
          transform: { x: 100, y: 100, rotation: 0, scale: 1 },
          velocity: { x: 0, y: 250 },
          itemState: { state: "belt", fallScale: 1 },
        })
        .addEntity({
          transform: { x: 200, y: 350, rotation: 0, scale: 1 },
          velocity: { x: 0, y: 250 },
          itemState: { state: "belt", fallScale: 1 },
        });

      itemStateSystem(world, 16);

      const items = world.entities.filter((e) => e.itemState);
      expect(items.length).toBe(2);
      expect(items[0].itemState?.state).toBe("belt");
      expect(items[1].itemState?.state).toBe("falling");
    });
  });
});
