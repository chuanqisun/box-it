import { describe, it, expect, beforeEach } from "vitest";
import { World } from "../engine";
import type { GameEntity, GameGlobal } from "../domain";
import { toolSystem } from "./tool";

function createTestWorld(): World<GameEntity, GameGlobal> {
  return new World<GameEntity, GameGlobal>({
    canvasEl: null as unknown as HTMLCanvasElement,
    canvas: { width: 800, height: 600 },
  });
}

describe("toolSystem", () => {
  let world: World<GameEntity, GameGlobal>;

  beforeEach(() => {
    world = createTestWorld();
    // Add required entities
    world
      .addEntity({ feedback: { effects: [] } })
      .addEntity({ score: { value: 1000, packedCount: 0 } })
      .addEntity({ gameState: { status: "playing", totalItemsSpawned: 5, itemsProcessed: 0 } });
  });

  describe("tool1 (container)", () => {
    it("should transform item to box emoji when colliding with tool1", () => {
      world
        .addEntity({
          tool: { id: "tool1", isColliding: false },
          transform: { x: 100, y: 100, rotation: 0, scale: 1 },
          collision: { width: 80, height: 80, type: "circle", radius: 40 },
        })
        .addEntity({
          transform: { x: 120, y: 120, rotation: 0, scale: 1 },
          collision: { width: 45, height: 45, type: "rectangle" },
          render: { emoji: "🍎" },
          name: { value: "apple" },
          itemState: { state: "belt", fallScale: 1 },
          physical: { size: 45 },
        });

      toolSystem(world, 16);

      const item = world.entities.find((e) => e.itemState && !e.boxAnchor);
      expect(item?.render?.emoji).toBe("📦");
      expect(item?.name?.value).toBe("📦");
    });

    it("should deduct 100 score when using tool1", () => {
      world
        .addEntity({
          tool: { id: "tool1", isColliding: false },
          transform: { x: 100, y: 100, rotation: 0, scale: 1 },
          collision: { width: 80, height: 80, type: "circle", radius: 40 },
        })
        .addEntity({
          transform: { x: 120, y: 120, rotation: 0, scale: 1 },
          collision: { width: 45, height: 45, type: "rectangle" },
          render: { emoji: "🍎" },
          name: { value: "apple" },
          itemState: { state: "belt", fallScale: 1 },
          physical: { size: 45 },
        });

      toolSystem(world, 16);

      const score = world.entities.find((e) => e.score)?.score?.value;
      expect(score).toBe(900); // 1000 - 100
    });

    it("should not interact when not colliding", () => {
      world
        .addEntity({
          tool: { id: "tool1", isColliding: false },
          transform: { x: 100, y: 100, rotation: 0, scale: 1 },
          collision: { width: 80, height: 80, type: "circle", radius: 40 },
        })
        .addEntity({
          transform: { x: 500, y: 500, rotation: 0, scale: 1 },
          collision: { width: 45, height: 45, type: "rectangle" },
          render: { emoji: "🍎" },
          name: { value: "apple" },
          itemState: { state: "belt", fallScale: 1 },
          physical: { size: 45 },
        });

      toolSystem(world, 16);

      const item = world.entities.find((e) => e.itemState && !e.boxAnchor);
      expect(item?.render?.emoji).toBe("🍎");
      const score = world.entities.find((e) => e.score)?.score?.value;
      expect(score).toBe(1000);
    });
  });

  describe("tool2 (flat iron)", () => {
    it("should transform clothing item with positive score", () => {
      world
        .addEntity({
          tool: { id: "tool2", isColliding: false },
          transform: { x: 100, y: 100, rotation: 0, scale: 1 },
          collision: { width: 80, height: 80, type: "circle", radius: 40 },
        })
        .addEntity({
          transform: { x: 120, y: 120, rotation: 0, scale: 1 },
          collision: { width: 45, height: 45, type: "rectangle" },
          render: { emoji: "👕" },
          name: { value: "shirt" },
          itemState: { state: "belt", fallScale: 1 },
          physical: { size: 45 },
        });

      toolSystem(world, 16);

      const item = world.entities.find((e) => e.itemState && !e.boxAnchor);
      expect(item?.render?.emoji).toBe("🧺");
      const score = world.entities.find((e) => e.score)?.score?.value;
      expect(score).toBe(1100); // 1000 + 100
    });

    it("should destroy items marked as destroyed and increment itemsProcessed", () => {
      world
        .addEntity({
          tool: { id: "tool2", isColliding: false },
          transform: { x: 100, y: 100, rotation: 0, scale: 1 },
          collision: { width: 80, height: 80, type: "circle", radius: 40 },
        })
        .addEntity({
          transform: { x: 120, y: 120, rotation: 0, scale: 1 },
          collision: { width: 45, height: 45, type: "rectangle" },
          render: { emoji: "🍔" },
          name: { value: "burger" },
          itemState: { state: "belt", fallScale: 1 },
          physical: { size: 45 },
        });

      toolSystem(world, 16);

      // Item should be removed
      const items = world.entities.filter((e) => e.itemState && !e.boxAnchor);
      expect(items.length).toBe(0);

      // Score should be reduced by 300
      const score = world.entities.find((e) => e.score)?.score?.value;
      expect(score).toBe(700); // 1000 - 300

      // itemsProcessed should be incremented
      const gameState = world.entities.find((e) => e.gameState)?.gameState;
      expect(gameState?.itemsProcessed).toBe(1);
    });

    it("should handle negative score transformations", () => {
      world
        .addEntity({
          tool: { id: "tool2", isColliding: false },
          transform: { x: 100, y: 100, rotation: 0, scale: 1 },
          collision: { width: 80, height: 80, type: "circle", radius: 40 },
        })
        .addEntity({
          transform: { x: 120, y: 120, rotation: 0, scale: 1 },
          collision: { width: 45, height: 45, type: "rectangle" },
          render: { emoji: "🍓" },
          name: { value: "strawberry" },
          itemState: { state: "belt", fallScale: 1 },
          physical: { size: 45 },
        });

      toolSystem(world, 16);

      const item = world.entities.find((e) => e.itemState && !e.boxAnchor);
      expect(item?.render?.emoji).toBe("🍯");
      const score = world.entities.find((e) => e.score)?.score?.value;
      expect(score).toBe(900); // 1000 - 100
    });

    it("should not transform items not in the lookup table", () => {
      world
        .addEntity({
          tool: { id: "tool2", isColliding: false },
          transform: { x: 100, y: 100, rotation: 0, scale: 1 },
          collision: { width: 80, height: 80, type: "circle", radius: 40 },
        })
        .addEntity({
          transform: { x: 120, y: 120, rotation: 0, scale: 1 },
          collision: { width: 45, height: 45, type: "rectangle" },
          render: { emoji: "🎮" },
          name: { value: "game" },
          itemState: { state: "belt", fallScale: 1 },
          physical: { size: 45 },
        });

      toolSystem(world, 16);

      const item = world.entities.find((e) => e.itemState && !e.boxAnchor);
      expect(item?.render?.emoji).toBe("🎮"); // Unchanged
      const score = world.entities.find((e) => e.score)?.score?.value;
      expect(score).toBe(1000); // Unchanged
    });
  });

  describe("collision detection", () => {
    it("should set tool isColliding to true when colliding", () => {
      world
        .addEntity({
          tool: { id: "tool1", isColliding: false },
          transform: { x: 100, y: 100, rotation: 0, scale: 1 },
          collision: { width: 80, height: 80, type: "circle", radius: 40 },
        })
        .addEntity({
          transform: { x: 120, y: 120, rotation: 0, scale: 1 },
          collision: { width: 45, height: 45, type: "rectangle" },
          render: { emoji: "🍎" },
          name: { value: "apple" },
          itemState: { state: "belt", fallScale: 1 },
          physical: { size: 45 },
        });

      toolSystem(world, 16);

      const tool = world.entities.find((e) => e.tool);
      expect(tool?.tool?.isColliding).toBe(true);
    });

    it("should set tool isColliding to false when not colliding", () => {
      world
        .addEntity({
          tool: { id: "tool1", isColliding: true },
          transform: { x: 100, y: 100, rotation: 0, scale: 1 },
          collision: { width: 80, height: 80, type: "circle", radius: 40 },
        })
        .addEntity({
          transform: { x: 500, y: 500, rotation: 0, scale: 1 },
          collision: { width: 45, height: 45, type: "rectangle" },
          render: { emoji: "🍎" },
          name: { value: "apple" },
          itemState: { state: "belt", fallScale: 1 },
          physical: { size: 45 },
        });

      toolSystem(world, 16);

      const tool = world.entities.find((e) => e.tool);
      expect(tool?.tool?.isColliding).toBe(false);
    });

    it("should not interact with packed items", () => {
      world
        .addEntity({
          tool: { id: "tool1", isColliding: false },
          transform: { x: 100, y: 100, rotation: 0, scale: 1 },
          collision: { width: 80, height: 80, type: "circle", radius: 40 },
        })
        .addEntity({
          transform: { x: 120, y: 120, rotation: 0, scale: 1 },
          collision: { width: 45, height: 45, type: "rectangle" },
          render: { emoji: "🍎" },
          name: { value: "apple" },
          itemState: { state: "packed", fallScale: 1 },
          boxAnchor: { relX: 50, relY: 50 },
          physical: { size: 45 },
        });

      toolSystem(world, 16);

      const item = world.entities.find((e) => e.boxAnchor);
      expect(item?.render?.emoji).toBe("🍎"); // Unchanged
      const score = world.entities.find((e) => e.score)?.score?.value;
      expect(score).toBe(1000); // Unchanged
    });
  });

  describe("feedback effects", () => {
    it("should add feedback effect when tool interacts with item", () => {
      world
        .addEntity({
          tool: { id: "tool1", isColliding: false },
          transform: { x: 100, y: 100, rotation: 0, scale: 1 },
          collision: { width: 80, height: 80, type: "circle", radius: 40 },
        })
        .addEntity({
          transform: { x: 120, y: 120, rotation: 0, scale: 1 },
          collision: { width: 45, height: 45, type: "rectangle" },
          render: { emoji: "🍎" },
          name: { value: "apple" },
          itemState: { state: "belt", fallScale: 1 },
          physical: { size: 45 },
        });

      toolSystem(world, 16);

      const feedback = world.entities.find((e) => e.feedback)?.feedback;
      expect(feedback?.effects.length).toBe(1);
      expect(feedback?.effects[0].text).toContain("📦");
    });
  });
});
