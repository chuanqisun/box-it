import { describe, it, expect, beforeEach } from "vitest";
import { World } from "../engine";
import type { GameEntity, GameGlobal } from "../domain";
import { movementSystem } from "./movement";

function createTestWorld(): World<GameEntity, GameGlobal> {
  return new World<GameEntity, GameGlobal>({
    canvasEl: null as unknown as HTMLCanvasElement,
    canvas: { width: 800, height: 600 },
  });
}

describe("movementSystem", () => {
  let world: World<GameEntity, GameGlobal>;

  beforeEach(() => {
    world = createTestWorld();
  });

  describe("entity movement", () => {
    it("should move entity based on velocity and deltaTime", () => {
      world.addEntity({
        transform: { x: 100, y: 200, rotation: 0, scale: 1 },
        velocity: { x: 100, y: 50 },
      });

      movementSystem(world, 1000); // 1 second

      const entity = world.entities[0];
      expect(entity.transform?.x).toBe(200); // 100 + 100 * 1
      expect(entity.transform?.y).toBe(250); // 200 + 50 * 1
    });

    it("should scale movement by deltaTime", () => {
      world.addEntity({
        transform: { x: 0, y: 0, rotation: 0, scale: 1 },
        velocity: { x: 60, y: 120 },
      });

      movementSystem(world, 500); // 0.5 seconds

      const entity = world.entities[0];
      expect(entity.transform?.x).toBe(30); // 60 * 0.5
      expect(entity.transform?.y).toBe(60); // 120 * 0.5
    });

    it("should not move entities without velocity", () => {
      world.addEntity({
        transform: { x: 100, y: 100, rotation: 0, scale: 1 },
      });

      movementSystem(world, 1000);

      const entity = world.entities[0];
      expect(entity.transform?.x).toBe(100);
      expect(entity.transform?.y).toBe(100);
    });

    it("should not move entities without transform", () => {
      world.addEntity({
        velocity: { x: 100, y: 100 },
      });

      movementSystem(world, 1000);

      const entity = world.entities[0];
      expect(entity.transform).toBeUndefined();
    });

    it("should preserve other entity properties", () => {
      world.addEntity({
        transform: { x: 0, y: 0, rotation: 0.5, scale: 2 },
        velocity: { x: 10, y: 20 },
        name: { value: "test" },
      });

      movementSystem(world, 1000);

      const entity = world.entities[0];
      expect(entity.transform?.rotation).toBe(0.5);
      expect(entity.transform?.scale).toBe(2);
      expect(entity.name?.value).toBe("test");
    });
  });

  describe("conveyor movement", () => {
    it("should update conveyor offset when active", () => {
      world.addEntity({
        conveyor: {
          isActive: true,
          offset: 0,
          speed: 250,
          width: 300,
          length: 400,
        },
      });

      movementSystem(world, 1000); // 1 second

      const entity = world.entities[0];
      // offset = (0 + 250 * 1) % 80 = 250 % 80 = 10
      expect(entity.conveyor?.offset).toBe(10);
    });

    it("should not update conveyor offset when inactive", () => {
      world.addEntity({
        conveyor: {
          isActive: false,
          offset: 50,
          speed: 250,
          width: 300,
          length: 400,
        },
      });

      movementSystem(world, 1000);

      const entity = world.entities[0];
      expect(entity.conveyor?.offset).toBe(50);
    });

    it("should wrap offset at 80", () => {
      world.addEntity({
        conveyor: {
          isActive: true,
          offset: 70,
          speed: 80,
          width: 300,
          length: 400,
        },
      });

      movementSystem(world, 1000); // adds 80, total = 150

      const entity = world.entities[0];
      // (70 + 80) % 80 = 70
      expect(entity.conveyor?.offset).toBe(70);
    });
  });

  describe("multiple entities", () => {
    it("should move all entities with velocity", () => {
      world
        .addEntity({
          transform: { x: 0, y: 0, rotation: 0, scale: 1 },
          velocity: { x: 10, y: 0 },
        })
        .addEntity({
          transform: { x: 100, y: 100, rotation: 0, scale: 1 },
          velocity: { x: 0, y: 20 },
        });

      movementSystem(world, 1000);

      expect(world.entities[0].transform?.x).toBe(10);
      expect(world.entities[1].transform?.y).toBe(120);
    });
  });
});
