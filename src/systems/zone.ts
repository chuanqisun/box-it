import type { GameEntity, GameGlobal, GameWorld } from "../domain";
import type { System } from "../engine";
import { removeEntity } from "../engine";

export const zoneSystem: System<GameEntity, GameGlobal> = (world, _deltaTime) => {
  const box = world.entities.find((entity) => entity.kind === "box");
  if (!box?.transform || !box?.collision) return world;

  const zones = world.entities.filter((e) => e.kind === "zone");

  let currentWorld = world;

  for (const zone of zones) {
    if (!zone.transform || !zone.collision || !zone.zone) continue;

    const inZone =
      world.global.mouseX >= zone.transform.x &&
      world.global.mouseX <= zone.transform.x + zone.collision.width &&
      world.global.mouseY >= zone.transform.y &&
      world.global.mouseY <= zone.transform.y + zone.collision.height;

    if (zone.zone.type === "shipping" && world.global.hasBox && inZone) {
      currentWorld = shipBox(currentWorld);
    }
    if (zone.zone.type === "restock" && !world.global.hasBox && inZone) {
      currentWorld = buyBox(currentWorld);
    }
  }

  return currentWorld;
};

function shipBox(world: GameWorld): GameWorld {
  const packed = world.entities.filter((e) => e.kind === "packed-item");
  if (packed.length === 0) return world;

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
      score: world.global.score + boxValue,
      hasBox: false,
      feedbackEffects: [...world.global.feedbackEffects, newFeedback],
    },
  };

  packed.forEach((p) => {
    currentWorld = removeEntity(currentWorld, p.id);
  });

  return currentWorld;
}

function buyBox(world: GameWorld): GameWorld {
  if (world.global.score < 200) {
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
      score: world.global.score - 200,
      hasBox: true,
      feedbackEffects: [...world.global.feedbackEffects, feedback],
    },
  };

  // Move the box to the mouse position
  const box = newWorld.entities.find((e) => e.kind === "box");
  if (box && box.transform && box.collision) {
    const updatedEntities = newWorld.entities.map((e) => {
      if (e.id === box.id) {
        return {
          ...e,
          transform: {
            ...e.transform!,
            x: world.global.mouseX - box.collision!.width / 2,
            y: world.global.mouseY - box.collision!.height / 2,
          },
        };
      }
      return e;
    });
    return { ...newWorld, entities: updatedEntities };
  }

  return newWorld;
}
