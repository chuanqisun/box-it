import type { GameEntity, GameGlobal } from "../domain";
import type { System } from "../engine";

const ITEM_SPEED_FALL = 450;

export const itemStateSystem: System<GameEntity, GameGlobal> = (world, deltaTime) => {
  const conveyor = world.entities.find((e) => e.kind === "conveyor" && e.conveyor)?.conveyor;
  const newEntities = world.entities
    .map((entity) => {
      if (entity.kind !== "item" || !entity.itemState || !entity.transform || !entity.velocity) {
        return entity;
      }

      const item = entity;
      let { state, fallScale } = item.itemState!;
      let { y } = item.transform!;
      let { x: vx, y: vy } = item.velocity!;

      if (state === "belt" && conveyor && y > conveyor.length) {
        state = "falling";
        vy = ITEM_SPEED_FALL;
      }

      if (state === "falling") {
        if (fallScale > 0.7) {
          fallScale -= (deltaTime / 1000) * 0.5;
        }
      }

      return {
        ...item,
        itemState: { ...item.itemState!, state, fallScale },
        velocity: { ...item.velocity!, y: vy },
      };
    })
    .filter((item) => {
      // Remove if off screen
      if (item.kind === "item" && item.transform && item.transform.y > world.global.canvas.height + 100) {
        return false;
      }
      return true;
    });

  return {
    ...world,
    entities: newEntities,
  };
};
