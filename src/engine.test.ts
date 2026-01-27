import { describe, it, expect } from "vitest";
import { World, type System, type BaseEntity } from "./engine";

interface TestEntity extends BaseEntity {
  name?: string;
  value?: number;
}

interface TestGlobal {
  count: number;
}

describe("World", () => {
  describe("constructor", () => {
    it("should initialize with empty entities", () => {
      const world = new World<TestEntity, TestGlobal>({ count: 0 });
      expect(world.entities).toEqual([]);
    });

    it("should initialize with provided global state", () => {
      const world = new World<TestEntity, TestGlobal>({ count: 42 });
      expect(world.global.count).toBe(42);
    });

    it("should start nextId at 1", () => {
      const world = new World<TestEntity, TestGlobal>({ count: 0 });
      expect(world.nextId).toBe(1);
    });
  });

  describe("addEntity", () => {
    it("should add an entity with auto-generated id", () => {
      const world = new World<TestEntity, TestGlobal>({ count: 0 });
      world.addEntity({ name: "test" });
      
      expect(world.entities.length).toBe(1);
      expect(world.entities[0].id).toBe(1);
      expect(world.entities[0].name).toBe("test");
    });

    it("should increment nextId after adding entity", () => {
      const world = new World<TestEntity, TestGlobal>({ count: 0 });
      world.addEntity({ name: "first" });
      world.addEntity({ name: "second" });
      
      expect(world.entities.length).toBe(2);
      expect(world.entities[0].id).toBe(1);
      expect(world.entities[1].id).toBe(2);
      expect(world.nextId).toBe(3);
    });

    it("should be chainable", () => {
      const world = new World<TestEntity, TestGlobal>({ count: 0 })
        .addEntity({ name: "a" })
        .addEntity({ name: "b" })
        .addEntity({ name: "c" });
      
      expect(world.entities.length).toBe(3);
    });
  });

  describe("removeEntity", () => {
    it("should remove an entity by id", () => {
      const world = new World<TestEntity, TestGlobal>({ count: 0 })
        .addEntity({ name: "keep" })
        .addEntity({ name: "remove" })
        .addEntity({ name: "keep2" });
      
      world.removeEntity(2);
      
      expect(world.entities.length).toBe(2);
      expect(world.entities.map(e => e.name)).toEqual(["keep", "keep2"]);
    });

    it("should do nothing if id not found", () => {
      const world = new World<TestEntity, TestGlobal>({ count: 0 })
        .addEntity({ name: "test" });
      
      world.removeEntity(999);
      
      expect(world.entities.length).toBe(1);
    });
  });

  describe("updateEntity", () => {
    it("should update a specific entity", () => {
      const world = new World<TestEntity, TestGlobal>({ count: 0 })
        .addEntity({ name: "original", value: 1 });
      
      world.updateEntity(1, (e) => ({ ...e, name: "updated", value: 2 }));
      
      expect(world.entities[0].name).toBe("updated");
      expect(world.entities[0].value).toBe(2);
    });

    it("should not affect other entities", () => {
      const world = new World<TestEntity, TestGlobal>({ count: 0 })
        .addEntity({ name: "first" })
        .addEntity({ name: "second" });
      
      world.updateEntity(1, (e) => ({ ...e, name: "modified" }));
      
      expect(world.entities[0].name).toBe("modified");
      expect(world.entities[1].name).toBe("second");
    });
  });

  describe("updateEntities", () => {
    it("should update all entities with updater function", () => {
      const world = new World<TestEntity, TestGlobal>({ count: 0 })
        .addEntity({ value: 1 })
        .addEntity({ value: 2 })
        .addEntity({ value: 3 });
      
      world.updateEntities((entities) =>
        entities.map((e) => ({ ...e, value: (e.value ?? 0) * 2 }))
      );
      
      expect(world.entities.map(e => e.value)).toEqual([2, 4, 6]);
    });

    it("should allow filtering entities", () => {
      const world = new World<TestEntity, TestGlobal>({ count: 0 })
        .addEntity({ value: 1 })
        .addEntity({ value: 2 })
        .addEntity({ value: 3 });
      
      world.updateEntities((entities) =>
        entities.filter((e) => (e.value ?? 0) > 1)
      );
      
      expect(world.entities.length).toBe(2);
    });
  });

  describe("updateGlobal", () => {
    it("should update global state", () => {
      const world = new World<TestEntity, TestGlobal>({ count: 0 });
      
      world.updateGlobal((g) => ({ ...g, count: g.count + 1 }));
      
      expect(world.global.count).toBe(1);
    });
  });

  describe("setGlobal", () => {
    it("should replace global state", () => {
      const world = new World<TestEntity, TestGlobal>({ count: 5 });
      
      world.setGlobal({ count: 100 });
      
      expect(world.global.count).toBe(100);
    });
  });

  describe("getEntities", () => {
    it("should return entities with specified components", () => {
      const world = new World<TestEntity, TestGlobal>({ count: 0 })
        .addEntity({ name: "has name" })
        .addEntity({ value: 42 })
        .addEntity({ name: "has both", value: 10 });
      
      const withName = world.getEntities("name");
      const withValue = world.getEntities("value");
      const withBoth = world.getEntities("name", "value");
      
      expect(withName.length).toBe(2);
      expect(withValue.length).toBe(2);
      expect(withBoth.length).toBe(1);
      expect(withBoth[0].name).toBe("has both");
    });
  });

  describe("runSystems", () => {
    it("should run all systems in order", () => {
      const world = new World<TestEntity, TestGlobal>({ count: 0 })
        .addEntity({ value: 0 });
      
      const system1: System<TestEntity, TestGlobal> = (w) => {
        w.updateEntities((entities) =>
          entities.map((e) => ({ ...e, value: (e.value ?? 0) + 1 }))
        );
        return w;
      };
      
      const system2: System<TestEntity, TestGlobal> = (w) => {
        w.updateEntities((entities) =>
          entities.map((e) => ({ ...e, value: (e.value ?? 0) * 2 }))
        );
        return w;
      };
      
      world.runSystems(16, [system1, system2]);
      
      // (0 + 1) * 2 = 2
      expect(world.entities[0].value).toBe(2);
    });

    it("should pass deltaTime to systems", () => {
      const world = new World<TestEntity, TestGlobal>({ count: 0 })
        .addEntity({ value: 0 });
      
      let receivedDt = 0;
      const system: System<TestEntity, TestGlobal> = (w, dt) => {
        receivedDt = dt;
        return w;
      };
      
      world.runSystems(33.33, [system]);
      
      expect(receivedDt).toBe(33.33);
    });
  });

  describe("observable pattern", () => {
    it("should notify subscribers on next()", () => {
      const world = new World<TestEntity, TestGlobal>({ count: 0 });
      let notified = false;
      
      world.subscribe(() => {
        notified = true;
      });
      
      world.next();
      
      expect(notified).toBe(true);
    });

    it("should return self from value getter", () => {
      const world = new World<TestEntity, TestGlobal>({ count: 0 });
      expect(world.value).toBe(world);
    });
  });
});
