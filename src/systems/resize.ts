import type { GameEntity, GameGlobal } from "../domain";
import type { World } from "../engine";

const ZONE_SIZE = 200;

export const resizeSystem = (world: World<GameEntity, GameGlobal>, width: number, height: number) => {
  world.global.canvasEl.width = width;
  world.global.canvasEl.height = height;

  const conveyorWidth = Math.min(350, width * 0.4);
  const conveyorLength = height * 0.55;

  return {
    ...world,
    global: {
      ...world.global,
      canvas: { width, height },
    },
    entities: world.entities.map((e) => {
      if (e.conveyor) {
        return {
          ...e,
          conveyor: {
            ...e.conveyor,
            width: conveyorWidth,
            length: conveyorLength,
          },
        };
      }
      if (e.box && e.transform && e.collision) {
        if (e.transform.x === 0 && e.transform.y === 0) {
          return {
            ...e,
            transform: {
              ...e.transform,
              x: width / 2 - e.collision.width / 2,
              y: height - e.collision.height - 50,
            },
          };
        }
      }
      if (e.zone && e.transform && e.collision) {
        if (e.zone.type === "restock") {
          return { ...e, transform: { ...e.transform, x: 0, y: height - ZONE_SIZE } };
        }
        if (e.zone.type === "shipping") {
          return { ...e, transform: { ...e.transform, x: width - ZONE_SIZE, y: height - ZONE_SIZE } };
        }
      }
      return e;
    }),
  };
};
