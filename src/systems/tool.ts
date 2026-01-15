import type { GameEntity, GameGlobal } from "../domain";
import type { System } from "../engine";

const ITEM_SIZE = 45;

export const toolSystem: System<GameEntity, GameGlobal> = (world, _deltaTime) => {
  const tools = world.entities.filter((e) => e.tool && e.transform && e.collision);
  if (tools.length === 0) return world;

  const items = world.entities.filter((e) => e.itemState && e.transform && e.collision);

  return world.updateEntities((entities) =>
    entities.map((entity) => {
      if (!entity.tool || !entity.transform || !entity.collision) return entity;

      const toolCenter = getCenter(entity);
      const toolRadius = getRadius(entity);

      const isColliding = items.some((item) => {
        if (!item.transform || !item.collision) return false;
        const itemCenter = getCenter(item);
        const itemRadius = Math.max(item.collision.width, item.collision.height, item.physical?.size ?? ITEM_SIZE) / 2;
        return getDistance(toolCenter, itemCenter) <= toolRadius + itemRadius;
      });

      if (entity.tool.isColliding === isColliding) return entity;
      return {
        ...entity,
        tool: {
          ...entity.tool,
          isColliding,
        },
      };
    })
  );
};

function getCenter(entity: GameEntity): { x: number; y: number } {
  if (!entity.transform || !entity.collision) return { x: 0, y: 0 };
  return {
    x: entity.transform.x + entity.collision.width / 2,
    y: entity.transform.y + entity.collision.height / 2,
  };
}

function getRadius(entity: GameEntity): number {
  if (!entity.collision) return 0;
  if (entity.collision.type === "circle" && entity.collision.radius) return entity.collision.radius;
  return Math.max(entity.collision.width, entity.collision.height) / 2;
}

function getDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
