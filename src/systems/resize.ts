import type { GameWorld } from "../domain";

const ZONE_SIZE = 200;

export const resizeSystem = (world: GameWorld, width: number, height: number) => {
  world.global.canvasEl.width = width;
  world.global.canvasEl.height = height;

  const conveyorWidth = Math.min(350, width * 0.4);
  const conveyorLength = height * 0.55;

  world.updateGlobal((global) => ({
    ...global,
    canvas: { width, height },
  }));

  world.updateEntities((entities) =>
    entities.map((e) => {
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
    })
  );

  return world;
};
