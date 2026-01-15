import type { GameEntity, GameGlobal } from "../domain";
import type { System } from "../engine";

export const feedbackSystem: System<GameEntity, GameGlobal> = (world, deltaTime) => {
  const newFeedback = world.global.feedbackEffects
    .map((effect) => ({
      ...effect,
      life: effect.life - deltaTime / 800,
      y: effect.y + effect.velocityY,
    }))
    .filter((effect) => effect.life > 0);

  return {
    ...world,
    global: {
      ...world.global,
      feedbackEffects: newFeedback,
    },
  };
};
