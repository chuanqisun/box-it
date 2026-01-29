import { beforeEach, describe, expect, it } from "vitest";
import type { GameEntity, GameGlobal } from "../domain";
import { World } from "../engine";
import { moverSystem } from "./mover";

function createTestWorld(): World<GameEntity, GameGlobal> {
  return new World<GameEntity, GameGlobal>({
    canvasEl: null as unknown as HTMLCanvasElement,
    canvas: { width: 800, height: 600 },
  });
}

describe("moverSystem", () => {
  let world: World<GameEntity, GameGlobal>;

  beforeEach(() => {
    world = createTestWorld();
    // Add required entities
    world
      .addEntity({ feedback: { effects: [] } })
      .addEntity({ score: { value: 1000, packedCount: 0 } })
      .addEntity({
        gameState: {
          status: "playing",
          totalItemsSpawned: 5,
          itemsProcessed: 0,
          durationMs: 30_000,
          timeRemainingMs: 30_000,
        },
      })
      .addEntity({
        conveyor: {
          isActive: true,
          offset: 0,
          speed: 250,
          width: 300,
          length: 330,
        },
      });
  });

  describe("picking up items", () => {
    it("should pick up an item when tool3 is active and colliding", () => {
      world
        .addEntity({
          tool: { id: "tool3", isColliding: false, isActive: true },
          transform: { x: 400, y: 100, rotation: 0, scale: 1 },
          collision: { width: 80, height: 80, type: "rectangle" },
        })
        .addEntity({
          transform: { x: 410, y: 110, rotation: 0, scale: 1 },
          collision: { width: 45, height: 45, type: "rectangle" },
          render: { emoji: "🍎" },
          name: { value: "apple" },
          itemState: { state: "belt", fallScale: 1 },
          physical: { size: 45 },
        });

      moverSystem(world, 16);

      const tool = world.entities.find((e) => e.tool?.id === "tool3");
      expect(tool?.tool?.heldItemId).toBeDefined();
      expect(tool?.tool?.isColliding).toBe(true);

      const item = world.entities.find((e) => e.name?.value === "apple");
      expect(item?.itemState?.state).toBe("held");
    });

    it("should not pick up an item when tool3 is not active", () => {
      world
        .addEntity({
          tool: { id: "tool3", isColliding: false, isActive: false },
          transform: { x: 400, y: 100, rotation: 0, scale: 1 },
          collision: { width: 80, height: 80, type: "rectangle" },
        })
        .addEntity({
          transform: { x: 410, y: 110, rotation: 0, scale: 1 },
          collision: { width: 45, height: 45, type: "rectangle" },
          render: { emoji: "🍎" },
          name: { value: "apple" },
          itemState: { state: "belt", fallScale: 1 },
          physical: { size: 45 },
        });

      moverSystem(world, 16);

      const tool = world.entities.find((e) => e.tool?.id === "tool3");
      expect(tool?.tool?.heldItemId).toBeUndefined();

      const item = world.entities.find((e) => e.name?.value === "apple");
      expect(item?.itemState?.state).toBe("belt");
    });

    it("should not pick up an item when not colliding", () => {
      world
        .addEntity({
          tool: { id: "tool3", isColliding: false, isActive: true },
          transform: { x: 100, y: 100, rotation: 0, scale: 1 },
          collision: { width: 80, height: 80, type: "rectangle" },
        })
        .addEntity({
          transform: { x: 500, y: 500, rotation: 0, scale: 1 },
          collision: { width: 45, height: 45, type: "rectangle" },
          render: { emoji: "🍎" },
          name: { value: "apple" },
          itemState: { state: "belt", fallScale: 1 },
          physical: { size: 45 },
        });

      moverSystem(world, 16);

      const tool = world.entities.find((e) => e.tool?.id === "tool3");
      expect(tool?.tool?.heldItemId).toBeUndefined();

      const item = world.entities.find((e) => e.name?.value === "apple");
      expect(item?.itemState?.state).toBe("belt");
    });
  });

  describe("moving held items", () => {
    it("should move held item with the tool position", () => {
      // First add the item
      world.addEntity({
        transform: { x: 410, y: 110, rotation: 0, scale: 1 },
        collision: { width: 45, height: 45, type: "rectangle" },
        render: { emoji: "🍎" },
        name: { value: "apple" },
        itemState: { state: "held", fallScale: 1 },
        physical: { size: 45 },
      });

      // Get the item's ID
      const item = world.entities.find((e) => e.name?.value === "apple")!;

      world.addEntity({
        tool: { id: "tool3", isColliding: true, isActive: true, heldItemId: item.id },
        transform: { x: 300, y: 200, rotation: 0, scale: 1 },
        collision: { width: 80, height: 80, type: "rectangle" },
      });

      moverSystem(world, 16);

      const updatedItem = world.entities.find((e) => e.name?.value === "apple");
      expect(updatedItem?.transform?.x).toBe(300);
      expect(updatedItem?.transform?.y).toBe(200);
    });
  });

  describe("releasing items on belt", () => {
    it("should release item back to belt when released on conveyor", () => {
      // First add the item - position inside belt (x: 250-550 for 800 width canvas with 300 belt width)
      world.addEntity({
        transform: { x: 400, y: 100, rotation: 0, scale: 1 },
        collision: { width: 45, height: 45, type: "rectangle" },
        render: { emoji: "🍎" },
        name: { value: "apple" },
        itemState: { state: "held", fallScale: 1 },
        physical: { size: 45 },
      });

      // Get the item's ID
      const item = world.entities.find((e) => e.name?.value === "apple")!;

      world.addEntity({
        tool: { id: "tool3", isColliding: true, isActive: false, heldItemId: item.id },
        transform: { x: 400, y: 100, rotation: 0, scale: 1 },
        collision: { width: 80, height: 80, type: "rectangle" },
      });

      moverSystem(world, 16);

      const tool = world.entities.find((e) => e.tool?.id === "tool3");
      expect(tool?.tool?.heldItemId).toBeUndefined();
      expect(tool?.tool?.isColliding).toBe(false);

      const updatedItem = world.entities.find((e) => e.name?.value === "apple");
      expect(updatedItem?.itemState?.state).toBe("belt");
    });
  });

  describe("dropping items outside belt", () => {
    it("should remove item and deduct 50 points when dropped outside belt", () => {
      // First add the item - position outside belt
      world.addEntity({
        transform: { x: 100, y: 100, rotation: 0, scale: 1 },
        collision: { width: 45, height: 45, type: "rectangle" },
        render: { emoji: "🍎" },
        name: { value: "apple" },
        itemState: { state: "held", fallScale: 1 },
        physical: { size: 45 },
      });

      // Get the item's ID
      const item = world.entities.find((e) => e.name?.value === "apple")!;

      world.addEntity({
        tool: { id: "tool3", isColliding: true, isActive: false, heldItemId: item.id },
        transform: { x: 100, y: 100, rotation: 0, scale: 1 },
        collision: { width: 80, height: 80, type: "rectangle" },
      });

      moverSystem(world, 16);

      // Item should be removed
      const updatedItem = world.entities.find((e) => e.name?.value === "apple");
      expect(updatedItem).toBeUndefined();

      // Score should be deducted by 50
      const score = world.entities.find((e) => e.score)?.score?.value;
      expect(score).toBe(950); // 1000 - 50

      // Tool should be cleared
      const tool = world.entities.find((e) => e.tool?.id === "tool3");
      expect(tool?.tool?.heldItemId).toBeUndefined();
      expect(tool?.tool?.isColliding).toBe(false);

      // Items processed should be incremented
      const gameState = world.entities.find((e) => e.gameState)?.gameState;
      expect(gameState?.itemsProcessed).toBe(1);

      // Feedback effect should be added
      const feedback = world.entities.find((e) => e.feedback)?.feedback;
      expect(feedback?.effects.length).toBe(1);
      expect(feedback?.effects[0].text).toContain("-50");
    });
  });

  describe("edge cases", () => {
    it("should clear tool state when held item no longer exists", () => {
      // Tool thinks it's holding item with id 999, but that item doesn't exist
      world.addEntity({
        tool: { id: "tool3", isColliding: true, isActive: false, heldItemId: 999 },
        transform: { x: 400, y: 100, rotation: 0, scale: 1 },
        collision: { width: 80, height: 80, type: "rectangle" },
      });

      moverSystem(world, 16);

      const tool = world.entities.find((e) => e.tool?.id === "tool3");
      expect(tool?.tool?.heldItemId).toBeUndefined();
      expect(tool?.tool?.isColliding).toBe(false);
    });

    it("should not pick up items already in held state", () => {
      world
        .addEntity({
          tool: { id: "tool3", isColliding: false, isActive: true },
          transform: { x: 400, y: 100, rotation: 0, scale: 1 },
          collision: { width: 80, height: 80, type: "rectangle" },
        })
        .addEntity({
          transform: { x: 410, y: 110, rotation: 0, scale: 1 },
          collision: { width: 45, height: 45, type: "rectangle" },
          render: { emoji: "🍎" },
          name: { value: "apple" },
          itemState: { state: "held", fallScale: 1 }, // Already held
          physical: { size: 45 },
        });

      moverSystem(world, 16);

      const tool = world.entities.find((e) => e.tool?.id === "tool3");
      expect(tool?.tool?.heldItemId).toBeUndefined();

      const item = world.entities.find((e) => e.name?.value === "apple");
      expect(item?.itemState?.state).toBe("held");
    });

    it("should not pick up packed items", () => {
      world
        .addEntity({
          tool: { id: "tool3", isColliding: false, isActive: true },
          transform: { x: 400, y: 100, rotation: 0, scale: 1 },
          collision: { width: 80, height: 80, type: "rectangle" },
        })
        .addEntity({
          transform: { x: 410, y: 110, rotation: 0, scale: 1 },
          collision: { width: 45, height: 45, type: "rectangle" },
          render: { emoji: "🍎" },
          name: { value: "apple" },
          itemState: { state: "packed", fallScale: 1 },
          boxAnchor: { relX: 50, relY: 50 },
          physical: { size: 45 },
        });

      moverSystem(world, 16);

      const tool = world.entities.find((e) => e.tool?.id === "tool3");
      expect(tool?.tool?.heldItemId).toBeUndefined();

      const item = world.entities.find((e) => e.name?.value === "apple");
      expect(item?.itemState?.state).toBe("packed");
    });
  });
});
