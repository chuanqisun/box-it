import type { GameEntity, GameGlobal } from "../domain";
import type { System } from "../engine";

export const inputSystem: System<GameEntity, GameGlobal> = (world, _deltaTime) => {
  const box = world.entities.find((entity) => entity.kind === "box");
  if (!box?.transform || !box?.collision) return world;

  const canvasWidth = world.global.canvas.width;
  const canvasHeight = world.global.canvas.height;

  let newX = world.global.mouseX - box.collision.width / 2;
  let newY = world.global.mouseY - box.collision.height / 2;

  newX = Math.max(0, Math.min(canvasWidth - box.collision.width, newX));
  newY = Math.max(0, Math.min(canvasHeight - box.collision.height, newY));

  return {
    ...world,
    entities: world.entities.map((e) => {
      if (e.id === box.id) {
        return {
          ...e,
          transform: {
            ...e.transform!,
            x: newX,
            y: newY,
          },
        };
      }
      return e;
    }),
  };
};
