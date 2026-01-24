/**
 * Collision Detection System
 *
 * This system is responsible for detecting collisions between entities
 * and updating the collision state. It's orthogonal to other systems
 * and can be used to detect various types of collisions.
 *
 * For tool-item collisions, it updates the tool's isColliding state
 * and prepares collision events that other systems can react to.
 */

import type { GameEntity, GameGlobal } from "../domain";
import type { System } from "../engine";
import { getEntityCenter, getEntityRadius, getDistance } from "../utils/collision";

export const collisionSystem: System<GameEntity, GameGlobal> = (world, _deltaTime) => {
  const tools = world.entities.filter((e) => e.tool && e.transform && e.collision);
  const items = world.entities.filter((e) => e.itemState && e.transform && e.collision && !e.boxAnchor);

  if (tools.length === 0) return world;

  // Collect all tool-item collisions
  const toolCollisions: Map<number, number[]> = new Map();

  for (const tool of tools) {
    if (!tool.transform || !tool.collision) continue;

    const collidingItemIds: number[] = [];
    const toolCenter = getEntityCenter(tool);
    const toolRadius = getEntityRadius(tool);

    for (const item of items) {
      if (!item.transform || !item.collision) continue;

      const itemCenter = getEntityCenter(item);
      const itemRadius = item.physical?.size ? item.physical.size / 2 : getEntityRadius(item);

      if (getDistance(toolCenter, itemCenter) <= toolRadius + itemRadius) {
        collidingItemIds.push(item.id);
      }
    }

    toolCollisions.set(tool.id, collidingItemIds);
  }

  // Update tool collision states
  return world.updateEntities((entities) =>
    entities.map((entity) => {
      if (!entity.tool) return entity;

      const collidingItems = toolCollisions.get(entity.id) ?? [];
      const isColliding = collidingItems.length > 0;

      // Only update if collision state changed
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

/**
 * Extended collision system that also generates collision events.
 * Use this when you need to react to specific collisions in other systems.
 */
export const collisionEventSystem: System<GameEntity, GameGlobal> = (world, _deltaTime) => {
  const tools = world.entities.filter((e) => e.tool && e.transform && e.collision);
  const items = world.entities.filter((e) => e.itemState && e.transform && e.collision && !e.boxAnchor);

  if (tools.length === 0) return world;

  // Collect all collisions as events
  const collisionEvents: Array<{ entityId: number; otherEntityId: number; type: string }> = [];

  for (const tool of tools) {
    if (!tool.transform || !tool.collision) continue;

    const toolCenter = getEntityCenter(tool);
    const toolRadius = getEntityRadius(tool);

    for (const item of items) {
      if (!item.transform || !item.collision) continue;

      const itemCenter = getEntityCenter(item);
      const itemRadius = item.physical?.size ? item.physical.size / 2 : getEntityRadius(item);

      if (getDistance(toolCenter, itemCenter) <= toolRadius + itemRadius) {
        collisionEvents.push({
          entityId: tool.id,
          otherEntityId: item.id,
          type: "tool-item",
        });
      }
    }
  }

  // Update collision events entity or create it if needed
  const hasCollisionEventsEntity = world.entities.some((e) => e.collisionEvents);

  if (!hasCollisionEventsEntity && collisionEvents.length > 0) {
    world.addEntity({
      collisionEvents: { collisions: collisionEvents },
    });
  } else {
    world.updateEntities((entities) =>
      entities.map((e) => {
        if (e.collisionEvents) {
          return {
            ...e,
            collisionEvents: { collisions: collisionEvents },
          };
        }
        return e;
      })
    );
  }

  // Also update tool collision states (reuse collisionEvents - all are tool-item type)
  const toolCollisions = new Map<number, boolean>();
  collisionEvents.forEach((e) => toolCollisions.set(e.entityId, true));

  return world.updateEntities((entities) =>
    entities.map((entity) => {
      if (!entity.tool) return entity;

      const isColliding = toolCollisions.has(entity.id);
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
