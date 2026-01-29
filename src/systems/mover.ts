import { playSound } from "../audio";
import type { GameEntity, GameGlobal } from "../domain";
import type { System } from "../engine";

/**
 * The mover tool (tool3) picks up items and moves them with the tool.
 * - When active and colliding with an item, binds to the first item touched
 * - While holding an item, moves it with the tool position
 * - When released on the conveyor belt, item resumes normal movement
 * - When released outside the conveyor belt, item disappears and deducts 50 points
 *
 * Uses debouncing (50ms) to prevent accidental release from brief touch interruptions.
 */
const MOVER_DROP_PENALTY = -50;
const RELEASE_DEBOUNCE_MS = 50;

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
 * Calculate the world position for an item held by the mover tool.
 * Applies the tool's offset in rotated coordinates.
 */
function getHeldItemPosition(toolX: number, toolY: number, toolRotation: number, toolXOffset: number, toolYOffset: number): { x: number; y: number } {
  const cos = Math.cos(toolRotation);
  const sin = Math.sin(toolRotation);
  const worldOffsetX = toolXOffset * cos - toolYOffset * sin;
  const worldOffsetY = toolXOffset * sin + toolYOffset * cos;
  return {
    x: toolX + worldOffsetX,
    y: toolY + worldOffsetY,
  };
}

/**
 * Calculate the center position of the tool's bounding box in world coordinates.
 */
function getToolBoxCenter(toolX: number, toolY: number, toolRotation: number, xOffset: number, yOffset: number): { x: number; y: number } {
  const cos = Math.cos(toolRotation);
  const sin = Math.sin(toolRotation);
  return {
    x: toolX + xOffset * cos - yOffset * sin,
    y: toolY + xOffset * sin + yOffset * cos,
  };
}

/**
 * Calculate squared distance between two points.
 */
function distanceSquared(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return dx * dx + dy * dy;
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

  // Helper to move the held item to the tool position
  const moveHeldItemToTool = () => {
    const toolPos = getHeldItemPosition(
      moverTool.transform!.x,
      moverTool.transform!.y,
      moverTool.transform!.rotation,
      moverTool.collision!.xOffset ?? 0,
      moverTool.collision!.yOffset ?? 0
    );
    world.updateEntities((entities) =>
      entities.map((e) => {
        if (e.id === heldItemId && e.transform) {
          return {
            ...e,
            transform: {
              ...e.transform,
              x: toolPos.x,
              y: toolPos.y,
            },
          };
        }
        return e;
      })
    );
  };

  // Get items that can be picked up
  const items = world.entities.filter((e) => e.itemState?.state === "belt" && !e.boxAnchor && e.transform && e.collision && e.render);

  // Calculate tool box center for distance comparisons
  const toolBoxCenter = getToolBoxCenter(
    moverTool.transform.x,
    moverTool.transform.y,
    moverTool.transform.rotation,
    moverTool.collision.xOffset ?? 0,
    moverTool.collision.yOffset ?? 0
  );

  // Find all colliding items and track if any are colliding (for visual feedback)
  const collidingItems: { item: GameEntity; distSq: number }[] = [];

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
      const distSq = distanceSquared(toolBoxCenter.x, toolBoxCenter.y, item.transform.x, item.transform.y);
      collidingItems.push({ item, distSq });
    }
  }

  // Update collision state for visual feedback when not holding an item
  if (heldItemId === undefined) {
    const hasCollision = collidingItems.length > 0;
    if (moverTool.tool.isColliding !== hasCollision) {
      world.updateEntities((entities) =>
        entities.map((e) => {
          if (e.tool?.id === "tool3") {
            return {
              ...e,
              tool: {
                ...e.tool,
                isColliding: hasCollision,
              },
            };
          }
          return e;
        })
      );
    }
  }

  // If tool is active
  if (moverTool.tool.isActive) {
    // If not holding anything, try to pick up an item
    if (heldItemId === undefined) {
      if (collidingItems.length > 0) {
        // Sort by distance and pick the closest item to the tool box center
        collidingItems.sort((a, b) => a.distSq - b.distSq);
        const closestItem = collidingItems[0].item;

        // Pick up this item
        playSound("tool3Engage");

        world.updateEntities((entities) =>
          entities.map((e) => {
            if (e.tool?.id === "tool3") {
              return {
                ...e,
                tool: {
                  ...e.tool,
                  heldItemId: closestItem.id,
                  isColliding: true,
                },
              };
            }
            if (e.id === closestItem.id && e.itemState) {
              return {
                ...e,
                itemState: {
                  ...e.itemState,
                  state: "held" as const,
                  raisedScale: 1.2,
                },
              };
            }
            return e;
          })
        );
      }
    } else {
      // Already holding an item, move it with the tool
      moveHeldItemToTool();
    }
  } else {
    // Tool is not active (released)
    if (heldItemId !== undefined) {
      // Check debounce - only release if enough time has passed since last active
      const lastActiveTime = moverTool.tool.lastActiveTime ?? 0;
      const timeSinceActive = Date.now() - lastActiveTime;

      if (timeSinceActive < RELEASE_DEBOUNCE_MS) {
        // Not enough time has passed - don't release yet, but still move the item
        // This prevents flickering from brief touch interruptions
        const heldItem = world.entities.find((e) => e.id === heldItemId);
        if (heldItem?.transform) {
          moveHeldItemToTool();
        }
        return world;
      }

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
          playSound("tool3Disengage");
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
                    raisedScale: undefined,
                  },
                };
              }
              return e;
            })
          );
        } else {
          // Item dropped outside belt - remove item and deduct points
          playSound("tool3Disengage");

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
            entities
              .map((e) => {
                // Remove the held item from entities
                if (e.id === heldItemId) {
                  return null;
                }
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
              .filter((e): e is GameEntity => e !== null)
          );
        }
      } else {
        // Held item was removed by another system - clear the tool state
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
            return e;
          })
        );
      }
    }
  }

  return world;
};
