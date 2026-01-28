import { describe, expect, it } from "vitest";
import {
  createBoxEntity,
  createConveyorEntity,
  createFeedbackEntity,
  createGameStateEntity,
  createInteractionsEntity,
  createItemEntity,
  createPackedItemEntity,
  createPointerEntity,
  createScoreEntity,
  createToolEntity,
  createZoneEntity,
  EntityConstants,
} from "./factories";

describe("Entity Factories", () => {
  describe("createFeedbackEntity", () => {
    it("should create entity with empty effects array", () => {
      const entity = createFeedbackEntity();
      expect(entity.feedback).toEqual({ effects: [] });
    });
  });

  describe("createInteractionsEntity", () => {
    it("should create entity with empty rules array", () => {
      const entity = createInteractionsEntity();
      expect(entity.interactions).toEqual({ rules: [] });
    });
  });

  describe("createConveyorEntity", () => {
    it("should create conveyor with correct dimensions", () => {
      const entity = createConveyorEntity(800);
      expect(entity.conveyor).toBeDefined();
      expect(entity.conveyor!.isActive).toBe(false);
      expect(entity.conveyor!.length).toBe(800 * 0.55);
      expect(entity.conveyor!.width).toBe(300);
    });

    it("should include spawner component", () => {
      const entity = createConveyorEntity(800);
      expect(entity.spawner).toBeDefined();
      expect(entity.spawner!.queue).toEqual([]);
      expect(entity.spawner!.timer).toBe(0);
    });
  });

  describe("createBoxEntity", () => {
    it("should create box with correct dimensions", () => {
      const entity = createBoxEntity();
      expect(entity.collision!.width).toBe(EntityConstants.BOX_WIDTH);
      expect(entity.collision!.height).toBe(EntityConstants.BOX_HEIGHT);
    });

    it("should start without a box", () => {
      const entity = createBoxEntity();
      expect(entity.box!.hasBox).toBe(false);
    });

    it("should have transform and render components", () => {
      const entity = createBoxEntity();
      expect(entity.transform).toBeDefined();
      expect(entity.render!.emoji).toBe("📦");
    });
  });

  describe("createZoneEntity", () => {
    it("should create restock zone", () => {
      const entity = createZoneEntity("restock");
      expect(entity.zone!.type).toBe("restock");
    });

    it("should create shipping zone", () => {
      const entity = createZoneEntity("shipping");
      expect(entity.zone!.type).toBe("shipping");
    });

    it("should have correct dimensions", () => {
      const entity = createZoneEntity("restock");
      expect(entity.collision!.width).toBe(EntityConstants.ZONE_SIZE);
      expect(entity.collision!.height).toBe(EntityConstants.ZONE_SIZE);
    });
  });

  describe("createPointerEntity", () => {
    it("should create pointer at origin", () => {
      const entity = createPointerEntity();
      expect(entity.pointer).toEqual({ x: 0, y: 0, rotation: 0 });
    });
  });

  describe("createToolEntity", () => {
    it("should create tool with correct id", () => {
      const entity = createToolEntity("tool1", 100, 200);
      expect(entity.tool!.id).toBe("tool1");
    });

    it("should position tool correctly", () => {
      const entity = createToolEntity("tool2", 150, 250);
      expect(entity.transform!.x).toBe(150);
      expect(entity.transform!.y).toBe(250);
    });

    it("should not be colliding initially", () => {
      const entity = createToolEntity("tool1", 0, 0);
      expect(entity.tool!.isColliding).toBe(false);
    });

    it("should have circle collision", () => {
      const entity = createToolEntity("tool1", 0, 0);
      expect(entity.collision!.type).toBe("circle");
      expect(entity.collision!.radius).toBe(EntityConstants.TOOL_SIZE / 2);
    });
  });

  describe("createScoreEntity", () => {
    it("should use default initial score", () => {
      const entity = createScoreEntity();
      expect(entity.score!.value).toBe(600);
    });

    it("should accept custom initial score", () => {
      const entity = createScoreEntity(1000);
      expect(entity.score!.value).toBe(1000);
    });

    it("should start with zero packed count", () => {
      const entity = createScoreEntity();
      expect(entity.score!.packedCount).toBe(0);
    });
  });

  describe("createGameStateEntity", () => {
    it("should start in playing state", () => {
      const entity = createGameStateEntity();
      expect(entity.gameState!.status).toBe("playing");
    });

    it("should start with zero items", () => {
      const entity = createGameStateEntity();
      expect(entity.gameState!.totalItemsSpawned).toBe(0);
      expect(entity.gameState!.itemsProcessed).toBe(0);
    });

    it("should start with full time remaining", () => {
      const entity = createGameStateEntity();
      expect(entity.gameState!.durationMs).toBe(30_000);
      expect(entity.gameState!.timeRemainingMs).toBe(30_000);
    });
  });

  describe("createItemEntity", () => {
    it("should create item at correct position", () => {
      const entity = createItemEntity(100, 200, "🍎", "apple");
      expect(entity.transform!.x).toBe(100);
      expect(entity.transform!.y).toBe(200);
    });

    it("should set emoji and name", () => {
      const entity = createItemEntity(0, 0, "🍌", "banana");
      expect(entity.render!.emoji).toBe("🍌");
      expect(entity.name!.value).toBe("banana");
    });

    it("should start on belt", () => {
      const entity = createItemEntity(0, 0, "📦", "box");
      expect(entity.itemState!.state).toBe("belt");
    });

    it("should use default velocity", () => {
      const entity = createItemEntity(0, 0, "📦", "box");
      expect(entity.velocity!.y).toBe(250);
    });

    it("should accept custom velocity", () => {
      const entity = createItemEntity(0, 0, "📦", "box", 500);
      expect(entity.velocity!.y).toBe(500);
    });
  });

  describe("createPackedItemEntity", () => {
    it("should create packed item at relative position", () => {
      const entity = createPackedItemEntity(50, 60, 0.5, "🎁", "gift", 0.8, false);
      expect(entity.boxAnchor!.relX).toBe(50);
      expect(entity.boxAnchor!.relY).toBe(60);
    });

    it("should set quality based on isBad", () => {
      const good = createPackedItemEntity(0, 0, 0, "🎁", "gift", 1, false);
      const bad = createPackedItemEntity(0, 0, 0, "💀", "skull", 1, true);
      expect(good.quality!.isBad).toBe(false);
      expect(bad.quality!.isBad).toBe(true);
    });

    it("should start in packed state", () => {
      const entity = createPackedItemEntity(0, 0, 0, "📦", "box", 1, false);
      expect(entity.itemState!.state).toBe("packed");
    });

    it("should start at scale 0 for animation", () => {
      const entity = createPackedItemEntity(0, 0, 0, "📦", "box", 1, false);
      expect(entity.transform!.scale).toBe(0);
    });
  });

  describe("EntityConstants", () => {
    it("should export expected constants", () => {
      expect(EntityConstants.BOX_WIDTH).toBe(180);
      expect(EntityConstants.BOX_HEIGHT).toBe(130);
      expect(EntityConstants.ZONE_SIZE).toBe(200);
      expect(EntityConstants.TOOL_SIZE).toBe(80);
      expect(EntityConstants.ITEM_SIZE).toBe(45);
    });
  });
});
