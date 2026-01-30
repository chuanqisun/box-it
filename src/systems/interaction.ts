import type { GameEntity, GameGlobal } from "../domain";
import type { System } from "../engine";

export const interactionSystem: System<GameEntity, GameGlobal> = (world, _deltaTime) => {
  const interactionsEntity = world.entities.find((e) => e.interactions);
  const interactionRules = interactionsEntity?.interactions?.rules ?? [];
  if (interactionRules.length === 0) return world;

  const box = world.entities.find((entity) => entity.box);
  if (!box?.transform || !box?.collision || !box?.box?.hasBox) return world;

  const packedItems = world.entities.filter((e) => e.boxAnchor && e.name?.value && e.render?.emoji);
  if (packedItems.length < 2) return world;

  for (let i = 0; i < packedItems.length; i++) {
    const first = packedItems[i];
    for (let j = i + 1; j < packedItems.length; j++) {
      const second = packedItems[j];
      const rule = interactionRules.find(
        (r) => (r.itemOne === first.name?.value && r.itemTwo === second.name?.value) || (r.itemOne === second.name?.value && r.itemTwo === first.name?.value)
      );

      if (!rule) continue;

      const effect = {
        text: rule.effect,
        x: box.transform.x + box.collision.width / 2,
        y: box.transform.y,
        color: "#ff6666",
        size: 40,
        life: 1.5,
        velocityY: -1.2,
      };

      world.updateEntities((entities) =>
        entities.map((e) => {
          if (e.feedback) {
            return {
              ...e,
              feedback: {
                ...e.feedback,
                effects: [...e.feedback.effects, effect],
              },
            };
          }
          return e;
        })
      );

      // Remove both items since the interaction failed
      world.removeEntity(first.id);
      world.removeEntity(second.id);
      return world;
    }
  }

  return world;
};
