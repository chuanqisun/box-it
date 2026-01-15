import type { GameEntity, GameGlobal } from "../domain";
import type { System } from "../engine";

export const feedbackSystem: System<GameEntity, GameGlobal> = (world, deltaTime) => {
  return world.updateEntities((entities) =>
    entities.map((entity) => {
      if (!entity.feedback) return entity;

      const newEffects = entity.feedback.effects
        .map((effect) => ({
          ...effect,
          life: effect.life - deltaTime / 800,
          y: effect.y + effect.velocityY,
        }))
        .filter((effect) => effect.life > 0);

      return {
        ...entity,
        feedback: {
          ...entity.feedback,
          effects: newEffects,
        },
      };
    })
  );
};
