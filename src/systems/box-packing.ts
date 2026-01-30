import { playSound } from "../audio";
import type { GameEntity, GameGlobal } from "../domain";
import type { System } from "../engine";

export const ITEM_SIZE = 72;

export const boxPackingSystem: System<GameEntity, GameGlobal> = (world, _deltaTime) => {
  const box = world.entities.find((entity) => entity.box);
  if (!box?.transform || !box?.collision || !box?.box?.hasBox) return world;

  const items = world.entities.filter((e) => e.itemState && !e.boxAnchor);
  const packedItems = world.entities.filter((e) => e.boxAnchor);

  // Box properties for local space transformation
  const boxCenterX = box.transform.x + box.collision.width / 2;
  const boxCenterY = box.transform.y + box.collision.height / 2;
  const boxRotation = box.transform.rotation || 0;
  const cos = Math.cos(-boxRotation);
  const sin = Math.sin(-boxRotation);

  for (const item of items) {
    if (!item.transform || !item.itemState || item.itemState.state !== "falling") continue;

    const size = item.physical?.size ?? ITEM_SIZE;
    const itemCenterX = item.transform.x;
    const itemCenterY = item.transform.y + size / 2;

    // Transform item point to box-local space
    const dx = itemCenterX - boxCenterX;
    const dy = itemCenterY - boxCenterY;
    const localX = dx * cos - dy * sin;
    const localY = dx * sin + dy * cos;

    // Check hit in local space (with 10px padding)
    const hitX = Math.abs(localX) <= box.collision.width / 2 - 10;
    const hitY = Math.abs(localY) <= box.collision.height / 2 - 10;

    if (!hitX || !hitY) continue;

    // Relative coordinates for boxAnchor (from box top-left in local space)
    const relX = localX + box.collision.width / 2;
    const relY = localY + box.collision.height / 2;

    // Calculate rotation relative to the box (preserve item's visual orientation)
    const itemRotation = item.transform.rotation || 0;
    const relRotation = itemRotation - boxRotation;

    let overlap = false;
    const safeDistance = ITEM_SIZE * 0.7;
    for (const packed of packedItems) {
      if (!packed.boxAnchor) continue;
      const pdx = packed.boxAnchor.relX - relX;
      const pdy = packed.boxAnchor.relY - relY;
      const dist = Math.sqrt(pdx * pdx + pdy * pdy);
      if (dist < safeDistance) {
        overlap = true;
        break;
      }
    }

    if (overlap) {
      const effect = {
        text: "Crowded!",
        x: box.transform.x + box.collision.width / 2,
        y: box.transform.y,
        color: "#ff4444",
        size: 48,
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
          if (e.score) {
            return { ...e, score: { ...e.score, value: e.score.value - 100 } };
          }
          return e;
        })
      );
    }

    // Play sound when item falls into box
    playSound("fallIntoBox");

    world.addEntity({
      transform: { x: relX, y: relY, rotation: relRotation, scale: 0 },
      render: { emoji: item.render?.emoji ?? "📦" },
      name: item.name ? { ...item.name } : { value: item.render?.emoji ?? "📦" },
      collision: { width: ITEM_SIZE, height: ITEM_SIZE, type: "rectangle" },
      boxAnchor: { relX, relY, relRotation },
      itemState: { state: "packed", fallScale: item.itemState.fallScale },
      physical: { size: ITEM_SIZE },
    });

    world.removeEntity(item.id);
  }

  // Update packed item scaling (items rotate with the box, so no rotation update needed)
  return world.updateEntities((entities) =>
    entities.map((e) => {
      if (e.boxAnchor && e.transform && e.itemState) {
        const targetScale = e.itemState.fallScale;
        const currentScale = e.transform.scale;

        if (currentScale < targetScale) {
          return {
            ...e,
            transform: {
              ...e.transform,
              scale: Math.min(targetScale, currentScale + 0.15),
            },
          };
        }
      }
      return e;
    })
  );
};
