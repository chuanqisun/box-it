import type { GameEntity, GameGlobal } from "../domain";
import { addEntity, type System } from "../engine";

const OBJECTS = ["🧸", "📱", "👟", "📚", "⌚", "🎮", "🧴", "🕶️", "📷", "🎁", "💊", "👕"];
const ITEM_SPEED_BELT = 250;
const ITEM_SIZE = 45;

export const spawningSystem: System<GameEntity, GameGlobal> = (world, deltaTime) => {
  const conveyorEntity = world.entities.find((e) => e.conveyor);
  const conveyor = conveyorEntity?.conveyor;
  const spawner = conveyorEntity?.spawner;
  if (!conveyor || !conveyor.isActive || !spawner) return world;

  const newTimer = spawner.timer + deltaTime;

  if (newTimer > spawner.interval) {
    const emoji = OBJECTS[Math.floor(Math.random() * OBJECTS.length)];
    const beltLeft = (world.global.canvas.width - conveyor.width) / 2;
    const padding = 30;
    const x = beltLeft + padding + Math.random() * (conveyor.width - padding * 2);

    let currentWorld = addEntity(world, {
      transform: { x, y: -60, rotation: (Math.random() - 0.5) * 0.5, scale: 1 },
      velocity: { x: 0, y: ITEM_SPEED_BELT },
      render: { emoji },
      collision: { width: ITEM_SIZE, height: ITEM_SIZE, type: "rectangle" },
      itemState: { state: "belt", fallScale: 1 },
      physical: { size: ITEM_SIZE },
    });

    return {
      ...currentWorld,
      entities: currentWorld.entities.map((e) =>
        e.conveyor && e.spawner ? { ...e, spawner: { ...e.spawner, timer: 0, interval: Math.random() * 800 + 600 } } : e
      ),
    };
  }

  return {
    ...world,
    entities: world.entities.map((e) => (e.conveyor && e.spawner ? { ...e, spawner: { ...e.spawner, timer: newTimer } } : e)),
  };
};
