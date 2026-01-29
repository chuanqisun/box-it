import { playSound } from "../audio";
import type { GameEntity, GameGlobal } from "../domain";
import type { System } from "../engine";

/**
 * The mover tool (tool3) picks up items and moves them with the tool.
 * - When active and colliding with an item, binds to the first item touched
 * - While holding an item, moves it with the tool position
 * - When released on the conveyor belt, item resumes normal movement
 * - When released outside the conveyor belt, item disappears and deducts 50 points
 */
const MOVER_DROP_PENALTY = -50;

interface Point {
  x: number;
  y: number;
}

/**
 * Get the four corners of an oriented rectangle.
 */
function getRectangleCorners(
  centerX: number,
  centerY: number,
  width: number,
  height: number,
  rotation: number,
  xOffset: number = 0,
  yOffset: number = 0
): Point[] {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const halfWidth = width / 2;
  const halfHeight = height / 2;

  const localCorners = [
    { x: xOffset - halfWidth, y: yOffset - halfHeight },
    { x: xOffset + halfWidth, y: yOffset - halfHeight },
    { x: xOffset + halfWidth, y: yOffset + halfHeight },
    { x: xOffset - halfWidth, y: yOffset + halfHeight },
  ];

  return localCorners.map((corner) => ({
    x: centerX + corner.x * cos - corner.y * sin,
    y: centerY + corner.x * sin + corner.y * cos,
  }));
}

function getRectangleAxes(corners: Point[]): Point[] {
  const axes: Point[] = [];
  for (let i = 0; i < corners.length; i++) {
    const p1 = corners[i];
    const p2 = corners[(i + 1) % corners.length];
    const edge = { x: p2.x - p1.x, y: p2.y - p1.y };
    const length = Math.hypot(edge.x, edge.y);
    if (length > 0) {
      axes.push({ x: -edge.y / length, y: edge.x / length });
    }
  }
  return [axes[0], axes[1]];
}

function projectOntoAxis(points: Point[], axis: Point): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const point of points) {
    const projection = point.x * axis.x + point.y * axis.y;
    min = Math.min(min, projection);
    max = Math.max(max, projection);
  }
  return { min, max };
}

function projectionsOverlap(a: { min: number; max: number }, b: { min: number; max: number }): boolean {
  return a.max >= b.min && b.max >= a.min;
}

function checkToolItemCollision(
  toolCenterX: number,
  toolCenterY: number,
  toolWidth: number,
  toolHeight: number,
  toolRotation: number,
  toolXOffset: number,
  toolYOffset: number,
  itemX: number,
  itemY: number,
  itemWidth: number,
  itemHeight: number
): boolean {
  const toolCorners = getRectangleCorners(toolCenterX, toolCenterY, toolWidth, toolHeight, toolRotation, toolXOffset, toolYOffset);

  const itemHalfWidth = itemWidth / 2;
  const itemHalfHeight = itemHeight / 2;
  const itemCorners: Point[] = [
    { x: itemX - itemHalfWidth, y: itemY - itemHalfHeight },
    { x: itemX + itemHalfWidth, y: itemY - itemHalfHeight },
    { x: itemX + itemHalfWidth, y: itemY + itemHalfHeight },
    { x: itemX - itemHalfWidth, y: itemY + itemHalfHeight },
  ];

  const toolAxes = getRectangleAxes(toolCorners);
  const itemAxes = [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
  ];
  const allAxes = [...toolAxes, ...itemAxes];

  for (const axis of allAxes) {
    const toolProjection = projectOntoAxis(toolCorners, axis);
    const itemProjection = projectOntoAxis(itemCorners, axis);
    if (!projectionsOverlap(toolProjection, itemProjection)) {
      return false;
    }
  }

  return true;
}

/**
 * Mover system that handles the mover tool (tool3) interactions.
 */
export const moverSystem: System<GameEntity, GameGlobal> = (world, _deltaTime) => {
  const moverTool = world.entities.find((e) => e.tool?.id === "tool3" && e.transform && e.collision);
  if (!moverTool?.tool || !moverTool.transform || !moverTool.collision) return world;

  const conveyor = world.entities.find((e) => e.conveyor)?.conveyor;
  if (!conveyor) return world;

  const heldItemId = moverTool.tool.heldItemId;

  // If tool is active
  if (moverTool.tool.isActive) {
    // If not holding anything, try to pick up an item
    if (heldItemId === undefined) {
      const items = world.entities.filter((e) => e.itemState?.state === "belt" && !e.boxAnchor && e.transform && e.collision && e.render);

      for (const item of items) {
        if (!item.transform || !item.collision) continue;

        const itemWidth = item.physical?.size ?? item.collision.width;
        const itemHeight = item.physical?.size ?? item.collision.height;

        const isColliding = checkToolItemCollision(
          moverTool.transform.x,
          moverTool.transform.y,
          moverTool.collision.width,
          moverTool.collision.height,
          moverTool.transform.rotation,
          moverTool.collision.xOffset ?? 0,
          moverTool.collision.yOffset ?? 0,
          item.transform.x,
          item.transform.y,
          itemWidth,
          itemHeight
        );

        if (isColliding) {
          // Pick up this item
          playSound("tool1"); // Reuse tool1 sound for pickup

          world.updateEntities((entities) =>
            entities.map((e) => {
              if (e.tool?.id === "tool3") {
                return {
                  ...e,
                  tool: {
                    ...e.tool,
                    heldItemId: item.id,
                    isColliding: true,
                  },
                };
              }
              if (e.id === item.id && e.itemState) {
                return {
                  ...e,
                  itemState: {
                    ...e.itemState,
                    state: "held" as const,
                  },
                };
              }
              return e;
            })
          );
          break;
        }
      }
    } else {
      // Already holding an item, move it with the tool
      world.updateEntities((entities) =>
        entities.map((e) => {
          if (e.id === heldItemId && e.transform) {
            // Move item to tool position (center of tool's collision box)
            const toolXOffset = moverTool.collision!.xOffset ?? 0;
            const toolYOffset = moverTool.collision!.yOffset ?? 0;
            const cos = Math.cos(moverTool.transform!.rotation);
            const sin = Math.sin(moverTool.transform!.rotation);
            const worldOffsetX = toolXOffset * cos - toolYOffset * sin;
            const worldOffsetY = toolXOffset * sin + toolYOffset * cos;

            return {
              ...e,
              transform: {
                ...e.transform,
                x: moverTool.transform!.x + worldOffsetX,
                y: moverTool.transform!.y + worldOffsetY,
              },
            };
          }
          return e;
        })
      );
    }
  } else {
    // Tool is not active (released)
    if (heldItemId !== undefined) {
      const heldItem = world.entities.find((e) => e.id === heldItemId);
      if (heldItem?.transform) {
        // Check if item is on the conveyor belt
        const beltX = (world.global.canvas.width - conveyor.width) / 2;
        const beltEndX = beltX + conveyor.width;
        const itemX = heldItem.transform.x;
        const itemY = heldItem.transform.y;

        const isOnBelt = itemX >= beltX && itemX <= beltEndX && itemY >= 0 && itemY <= conveyor.length;

        if (isOnBelt) {
          // Release item back to belt
          world.updateEntities((entities) =>
            entities.map((e) => {
              if (e.tool?.id === "tool3") {
                return {
                  ...e,
                  tool: {
                    ...e.tool,
                    heldItemId: undefined,
                    isColliding: false,
                  },
                };
              }
              if (e.id === heldItemId && e.itemState) {
                return {
                  ...e,
                  itemState: {
                    ...e.itemState,
                    state: "belt" as const,
                  },
                };
              }
              return e;
            })
          );
        } else {
          // Item dropped outside belt - remove item and deduct points
          playSound("tool2"); // Reuse tool2 sound for drop

          // Add feedback effect
          const feedbackEffect = {
            text: `💨 $${MOVER_DROP_PENALTY}`,
            x: heldItem.transform.x,
            y: heldItem.transform.y - 30,
            color: "#e74c3c",
            size: 24,
            life: 1,
            velocityY: -1,
          };

          world.updateEntities((entities) =>
            entities.map((e) => {
              if (e.tool?.id === "tool3") {
                return {
                  ...e,
                  tool: {
                    ...e.tool,
                    heldItemId: undefined,
                    isColliding: false,
                  },
                };
              }
              if (e.score) {
                return {
                  ...e,
                  score: {
                    ...e.score,
                    value: e.score.value + MOVER_DROP_PENALTY,
                  },
                };
              }
              if (e.feedback) {
                return {
                  ...e,
                  feedback: {
                    ...e.feedback,
                    effects: [...e.feedback.effects, feedbackEffect],
                  },
                };
              }
              if (e.gameState) {
                return {
                  ...e,
                  gameState: {
                    ...e.gameState,
                    itemsProcessed: e.gameState.itemsProcessed + 1,
                  },
                };
              }
              return e;
            })
          );

          // Remove the held item
          world.removeEntity(heldItemId);
        }
      }
    }
  }

  return world;
};
