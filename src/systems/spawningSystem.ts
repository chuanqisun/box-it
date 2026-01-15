import type { GameEntity, GameGlobal } from "../domain";
import { addEntity, type System } from "../engine";

const OBJECTS = ["🧸", "📱", "👟", "📚", "⌚", "🎮", "🧴", "🕶️", "📷", "🎁", "💊", "👕"];
const ITEM_SPEED_BELT = 250;
const ITEM_SIZE = 45;

export const spawningSystem: System<GameEntity, GameGlobal> = (world, deltaTime) => {
  let currentWorld = world;
  const newTimer = world.global.spawnTimer + deltaTime;

  if (newTimer > world.global.spawnInterval) {
    const emoji = OBJECTS[Math.floor(Math.random() * OBJECTS.length)];
    const beltLeft = (world.global.canvas.width - world.global.conveyor.width) / 2;
    const padding = 30;
    const x = beltLeft + padding + Math.random() * (world.global.conveyor.width - padding * 2);

    currentWorld = addEntity(currentWorld, {
      kind: "item",
      transform: { x, y: -60, rotation: (Math.random() - 0.5) * 0.5, scale: 1 },
      velocity: { x: 0, y: ITEM_SPEED_BELT },
      render: { emoji },
      collision: { width: ITEM_SIZE, height: ITEM_SIZE, type: "rectangle" },
      itemState: { state: "belt", fallScale: 1 },
      physical: { size: ITEM_SIZE },
    });

    return {
      ...currentWorld,
      global: {
        ...currentWorld.global,
        spawnTimer: 0,
        spawnInterval: Math.random() * 800 + 600,
      },
    };
  }

  return {
    ...world,
    global: {
      ...world.global,
      spawnTimer: newTimer,
    },
  };
};
