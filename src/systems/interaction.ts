import type { GameEntity, GameGlobal } from "../domain";
import type { System } from "../engine";

export const interactionSystem: System<GameEntity, GameGlobal> = (world, _deltaTime) => {
  const interactionsEntity = world.entities.find((e) => e.interactions);
  const interactionRules = interactionsEntity?.interactions?.rules ?? [];
  if (interactionRules.length === 0) return world;

  const box = world.entities.find((entity) => entity.box);
  if (!box?.transform || !box?.collision || !box?.box?.hasBox) return world;

  const boxTransform = box.transform;
  const boxCollision = box.collision;

  const packedItems = world.entities.filter((e) => e.boxAnchor && e.name?.value && e.render?.emoji);
  if (packedItems.length < 2) return world;

  // Accumulate all interactions first
  const triggeredInteractions: { first: GameEntity; second: GameEntity; rule: (typeof interactionRules)[0] }[] = [];

  for (let i = 0; i < packedItems.length; i++) {
    const first = packedItems[i];
    for (let j = i + 1; j < packedItems.length; j++) {
      const second = packedItems[j];
      const rule = interactionRules.find(
        (r) => (r.itemOne === first.name?.value && r.itemTwo === second.name?.value) || (r.itemOne === second.name?.value && r.itemTwo === first.name?.value)
      );

      if (rule) {
        triggeredInteractions.push({ first, second, rule });
      }
    }
  }

  if (triggeredInteractions.length === 0) return world;

  // Create all effects
  const effects = triggeredInteractions.map(({ rule }) => ({
    text: rule.effect,
    x: boxTransform.x + boxCollision.width / 2,
    y: boxTransform.y,
    color: "#ff6666",
    size: 40,
    life: 1.5,
    velocityY: -1.2,
  }));

  world.updateEntities((entities) =>
    entities.map((e) => {
      if (e.feedback) {
        return {
          ...e,
          feedback: {
            ...e.feedback,
            effects: [...e.feedback.effects, ...effects],
          },
        };
      }
      return e;
    })
  );

  // Bulk remove all interacting items
  const entitiesToRemove = new Set(triggeredInteractions.flatMap(({ first, second }) => [first.id, second.id]));
  for (const id of entitiesToRemove) {
    world.removeEntity(id);
  }

  return world;
};
