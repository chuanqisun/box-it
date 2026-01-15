import type { GameEntity, GameGlobal } from "../domain";
import type { System } from "../engine";

const ITEM_SIZE = 45;

export const boxPackingSystem: System<GameEntity, GameGlobal> = (world, _deltaTime) => {
  const box = world.entities.find((entity) => entity.box);
  if (!box?.transform || !box?.collision || !box?.box?.hasBox) return world;

  const items = world.entities.filter((e) => e.itemState && !e.boxAnchor);
  const packedItems = world.entities.filter((e) => e.boxAnchor);

  for (const item of items) {
    if (!item.transform || !item.itemState || item.itemState.state !== "falling") continue;

    const size = item.physical?.size ?? ITEM_SIZE;
    const itemCenterX = item.transform.x;
    const itemCenterY = item.transform.y + size / 2;

    const hitY = itemCenterY >= box.transform.y + 10 && itemCenterY <= box.transform.y + box.collision.height - 10;
    const hitX = itemCenterX >= box.transform.x + 10 && itemCenterX <= box.transform.x + box.collision.width - 10;

    if (!hitX || !hitY) continue;

    const relX = itemCenterX - box.transform.x;
    const relY = itemCenterY - box.transform.y;

    let overlap = false;
    const safeDistance = ITEM_SIZE * 0.7;
    for (const packed of packedItems) {
      if (!packed.boxAnchor) continue;
      const dx = packed.boxAnchor.relX - relX;
      const dy = packed.boxAnchor.relY - relY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < safeDistance) {
        overlap = true;
        break;
      }
    }

    if (overlap) {
      const effect = {
        text: "⚠️",
        x: box.transform.x + box.collision.width / 2,
        y: box.transform.y,
        color: "#ff4444",
        size: 36,
        life: 1,
        velocityY: -1,
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
    }

    world.addEntity({
      transform: { x: relX, y: relY, rotation: (Math.random() - 0.5) * 1.0, scale: 0 },
      render: { emoji: item.render?.emoji ?? "📦" },
      collision: { width: ITEM_SIZE, height: ITEM_SIZE, type: "rectangle" },
      boxAnchor: { relX, relY },
      itemState: { state: "packed", fallScale: item.itemState.fallScale },
      quality: { isBad: overlap },
      physical: { size: ITEM_SIZE },
    });

    world.removeEntity(item.id);
  }

  // Also update packed scaling
  return world.updateEntities((entities) =>
    entities.map((e) => {
      if (e.boxAnchor && e.transform && e.itemState) {
        const targetScale = e.itemState.fallScale;
        if (e.transform.scale < targetScale) {
          return {
            ...e,
            transform: {
              ...e.transform,
              scale: e.transform.scale + 0.15,
            },
          };
        }
      }
      return e;
    })
  );
};
