/**
 * Tool System
 *
 * NOTE: This system is now superseded by the collision system for
 * collision detection. It remains as a legacy fallback.
 * 
 * The collision detection has been moved to:
 * - systems/collision.ts: Handles all collision detection
 * - systems/tool-effect.ts: Handles tool effects on collision
 */

import type { GameEntity, GameGlobal } from "../domain";
import type { System } from "../engine";
import { getEntityCenter, getEntityRadius, getDistance } from "../utils/collision";

const ITEM_SIZE = 45;

export const toolSystem: System<GameEntity, GameGlobal> = (world, _deltaTime) => {
  // This system is now optional as collision detection is handled by collisionEventSystem
  // Keeping it for backwards compatibility
  const tools = world.entities.filter((e) => e.tool && e.transform && e.collision);
  if (tools.length === 0) return world;

  const items = world.entities.filter((e) => e.itemState && e.transform && e.collision);

  return world.updateEntities((entities) =>
    entities.map((entity) => {
      if (!entity.tool || !entity.transform || !entity.collision) return entity;

      const toolCenter = getEntityCenter(entity);
      const toolRadius = getEntityRadius(entity);

      const isColliding = items.some((item) => {
        if (!item.transform || !item.collision) return false;
        const itemCenter = getEntityCenter(item);
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
