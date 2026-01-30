import { playSound } from "../audio";
import type { GameEntity, GameGlobal, GameWorld } from "../domain";
import type { System } from "../engine";

/**
 * Check if two rectangles have any overlap.
 */
function rectanglesOverlap(x1: number, y1: number, w1: number, h1: number, x2: number, y2: number, w2: number, h2: number): boolean {
  return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
}

export const zoneSystem: System<GameEntity, GameGlobal> = (world, _deltaTime) => {
  const boxEntity = world.entities.find((entity) => entity.box);
  if (!boxEntity?.transform || !boxEntity?.collision) return world;

  const pointer = world.entities.find((e) => e.pointer)?.pointer;
  const zones = world.entities.filter((e) => e.zone);

  for (const zone of zones) {
    if (!zone.transform || !zone.collision || !zone.zone) continue;

    if (zone.zone.type === "shipping" && boxEntity.box?.hasBox) {
      // For shipping: check if any part of the box overlaps with the zone
      // (fixes multi-touch input where pointer may not represent box position)
      const boxInZone = rectanglesOverlap(
        boxEntity.transform.x,
        boxEntity.transform.y,
        boxEntity.collision.width,
        boxEntity.collision.height,
        zone.transform.x,
        zone.transform.y,
        zone.collision.width,
        zone.collision.height
      );
      if (boxInZone) {
        shipBox(world);
      }
    }

    if (zone.zone.type === "restock" && !boxEntity.box?.hasBox && pointer) {
      // For restock: check if a virtual box centered at pointer would overlap with zone
      // This simulates where the new box would appear when purchased
      const virtualBoxX = pointer.x - boxEntity.collision.width / 2;
      const virtualBoxY = pointer.y - boxEntity.collision.height / 2;
      const pointerInZone = rectanglesOverlap(
        virtualBoxX,
        virtualBoxY,
        boxEntity.collision.width,
        boxEntity.collision.height,
        zone.transform.x,
        zone.transform.y,
        zone.collision.width,
        zone.collision.height
      );
      if (pointerInZone) {
        buyBox(world);
      }
    }
  }

  return world;
};

function shipBox(world: GameWorld): void {
  const packed = world.entities.filter((e) => e.boxAnchor);
  if (packed.length === 0) return;

  const scoreEntity = world.entities.find((e) => e.score);
  if (!scoreEntity?.score) return;

  // Play shipped sound
  playSound("shipped");

  let boxValue = packed.length * 150;

  const newFeedback = {
    text: `SHIPPED! +$${boxValue}`,
    x: world.global.canvas.width - 150,
    y: world.global.canvas.height - 200,
    color: "#44ff44",
    size: 40,
    life: 1,
    velocityY: -1,
  };

  const itemsShipped = packed.length;

  world.updateEntities((entities) =>
    entities.map((e) => {
      if (e.feedback) {
        return {
          ...e,
          feedback: {
            ...e.feedback,
            effects: [...e.feedback.effects, newFeedback],
          },
        };
      }
      if (e.score) {
        return { ...e, score: { ...e.score, value: e.score.value + boxValue } };
      }
      if (e.box) {
        return { ...e, box: { ...e.box, hasBox: false } };
      }
      if (e.gameState) {
        return { ...e, gameState: { ...e.gameState, itemsProcessed: e.gameState.itemsProcessed + itemsShipped } };
      }
      return e;
    })
  );

  packed.forEach((p) => {
    world.removeEntity(p.id);
  });
}

function buyBox(world: GameWorld): void {
  const scoreEntity = world.entities.find((e) => e.score);
  const pointer = world.entities.find((e) => e.pointer)?.pointer;
  if (!scoreEntity?.score || !pointer) return;

  // Play get box sound
  playSound("getBox");

  const feedback = {
    text: "NEW BOX -$100",
    x: 150,
    y: world.global.canvas.height - 200,
    color: "#f1c40f",
    size: 40,
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
            effects: [...e.feedback.effects, feedback],
          },
        };
      }
      if (e.score) {
        return { ...e, score: { ...e.score, value: e.score.value - 100 } };
      }
      if (e.box && e.transform && e.collision) {
        return {
          ...e,
          box: { ...e.box, hasBox: true },
          transform: {
            ...e.transform,
            x: pointer.x - e.collision.width / 2,
            y: pointer.y - e.collision.height / 2,
          },
        };
      }
      if (e.conveyor) {
        return { ...e, conveyor: { ...e.conveyor, isActive: true } };
      }
      if (e.gameState) {
        return { ...e, gameState: { ...e.gameState, timerStarted: true } };
      }
      return e;
    })
  );
}
