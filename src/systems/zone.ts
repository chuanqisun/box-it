import type { GameEntity, GameGlobal, GameWorld } from "../domain";
import type { System } from "../engine";
import { playSound } from "../sounds";

export const zoneSystem: System<GameEntity, GameGlobal> = (world, _deltaTime) => {
  const boxEntity = world.entities.find((entity) => entity.box);
  if (!boxEntity?.transform || !boxEntity?.collision) return world;

  const pointer = world.entities.find((e) => e.pointer)?.pointer;
  if (!pointer) return world;

  const zones = world.entities.filter((e) => e.zone);

  for (const zone of zones) {
    if (!zone.transform || !zone.collision || !zone.zone) continue;

    const inZone =
      pointer.x >= zone.transform.x &&
      pointer.x <= zone.transform.x + zone.collision.width &&
      pointer.y >= zone.transform.y &&
      pointer.y <= zone.transform.y + zone.collision.height;

    if (zone.zone.type === "shipping" && boxEntity.box?.hasBox && inZone) {
      shipBox(world);
    }
    if (zone.zone.type === "restock" && !boxEntity.box?.hasBox && inZone) {
      buyBox(world);
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

  let boxValue = 0;
  packed.forEach((entity) => {
    if (entity.quality && !entity.quality.isBad) {
      boxValue += 100;
    } else {
      boxValue -= 10;
    }
  });

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

  if (scoreEntity.score.value < 200) {
    const feedback = {
      text: "INSUFFICIENT FUNDS",
      x: 150,
      y: world.global.canvas.height - 200,
      color: "#ff4444",
      size: 30,
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
        return e;
      })
    );
    return;
  }

  // Play get box sound
  playSound("getBox");

  const feedback = {
    text: "NEW BOX -$200",
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
        return { ...e, score: { ...e.score, value: e.score.value - 200 } };
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
      return e;
    })
  );
}
