import type { GameEntity, GameGlobal } from "../domain";
import type { System } from "../engine";

export const movementSystem: System<GameEntity, GameGlobal> = (world, deltaTime) => {
  return world.updateEntities((entities) =>
    entities.map((entity) => {
      if (entity.conveyor) {
        const { isActive, offset, speed } = entity.conveyor;
        return {
          ...entity,
          conveyor: {
            ...entity.conveyor,
            offset: isActive ? (offset + (speed * deltaTime) / 1000) % 80 : offset,
          },
        };
      }

      // Don't move items that are being held by the mover tool
      if (entity.itemState?.state === "held") {
        return entity;
      }

      if (entity.transform && entity.velocity) {
        return {
          ...entity,
          transform: {
            ...entity.transform,
            x: entity.transform.x + (entity.velocity.x * deltaTime) / 1000,
            y: entity.transform.y + (entity.velocity.y * deltaTime) / 1000,
          },
        };
      }
      return entity;
    })
  );
};
