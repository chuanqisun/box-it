import type { GameEntity, GameGlobal, GameWorld } from "../domain";
import type { System } from "../engine";
import { removeEntity } from "../engine";

export const zoneSystem: System<GameEntity, GameGlobal> = (world, _deltaTime) => {
  const boxEntity = world.entities.find((entity) => entity.box);
  if (!boxEntity?.transform || !boxEntity?.collision) return world;

  const pointer = world.entities.find((e) => e.pointer)?.pointer;
  if (!pointer) return world;

  const zones = world.entities.filter((e) => e.zone);

  let currentWorld = world;

  for (const zone of zones) {
    if (!zone.transform || !zone.collision || !zone.zone) continue;

    const inZone =
      pointer.x >= zone.transform.x &&
      pointer.x <= zone.transform.x + zone.collision.width &&
      pointer.y >= zone.transform.y &&
      pointer.y <= zone.transform.y + zone.collision.height;

    if (zone.zone.type === "shipping" && boxEntity.box?.hasBox && inZone) {
      currentWorld = shipBox(currentWorld);
    }
    if (zone.zone.type === "restock" && !boxEntity.box?.hasBox && inZone) {
      currentWorld = buyBox(currentWorld);
    }
  }

  return currentWorld;
};

function shipBox(world: GameWorld): GameWorld {
  const packed = world.entities.filter((e) => e.boxAnchor);
  if (packed.length === 0) return world;

  const scoreEntity = world.entities.find((e) => e.score);
  if (!scoreEntity?.score) return world;

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

  let currentWorld: GameWorld = {
    ...world,
    global: {
      ...world.global,
      feedbackEffects: [...world.global.feedbackEffects, newFeedback],
    },
    entities: world.entities.map((e) => {
      if (e.score) {
        return { ...e, score: { ...e.score, value: e.score.value + boxValue } };
      }
      if (e.box) {
        return { ...e, box: { ...e.box, hasBox: false } };
      }
      return e;
    }),
  };

  packed.forEach((p) => {
    currentWorld = removeEntity(currentWorld, p.id);
  });

  return currentWorld;
}

function buyBox(world: GameWorld): GameWorld {
  const scoreEntity = world.entities.find((e) => e.score);
  const pointer = world.entities.find((e) => e.pointer)?.pointer;
  if (!scoreEntity?.score || !pointer) return world;

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
    return {
      ...world,
      global: {
        ...world.global,
        feedbackEffects: [...world.global.feedbackEffects, feedback],
      },
    };
  }

  const feedback = {
    text: "NEW BOX -$200",
    x: 150,
    y: world.global.canvas.height - 200,
    color: "#f1c40f",
    size: 40,
    life: 1,
    velocityY: -1,
  };

  const newWorld: GameWorld = {
    ...world,
    global: {
      ...world.global,
      feedbackEffects: [...world.global.feedbackEffects, feedback],
    },
    entities: world.entities.map((e) => {
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
    }),
  };

  return newWorld;
}
