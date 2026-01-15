import type { GameEntity } from "../domain";
import type { System } from "../engine";

export const movementSystem: System<GameEntity, any> = (world, deltaTime) => {
  const newEntities = world.entities.map((entity) => {
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
  });

  return {
    ...world,
    entities: newEntities,
  };
};
