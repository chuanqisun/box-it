import type { GameEntity, GameGlobal, GameWorld } from "../domain";
import type { System } from "../engine";
import { playSound } from "../sounds";

// Flag to prevent repeated shipping sound
let shippingInProgress = false;
// Flag to prevent repeated buyBox calls
let buyBoxInProgress = false;

/**
 * Check if a rotated rectangle overlaps with an axis-aligned rectangle (zone).
 * Uses the Separating Axis Theorem (SAT) for accurate collision detection.
 */
function boxOverlapsZone(
  boxCenterX: number,
  boxCenterY: number,
  boxWidth: number,
  boxHeight: number,
  boxRotation: number,
  zoneX: number,
  zoneY: number,
  zoneWidth: number,
  zoneHeight: number
): boolean {
  // Get the four corners of the rotated box
  const halfW = boxWidth / 2;
  const halfH = boxHeight / 2;
  const cos = Math.cos(boxRotation);
  const sin = Math.sin(boxRotation);

  // Box corners relative to center, then rotated
  const corners = [
    { x: boxCenterX + (-halfW * cos - -halfH * sin), y: boxCenterY + (-halfW * sin + -halfH * cos) },
    { x: boxCenterX + (halfW * cos - -halfH * sin), y: boxCenterY + (halfW * sin + -halfH * cos) },
    { x: boxCenterX + (halfW * cos - halfH * sin), y: boxCenterY + (halfW * sin + halfH * cos) },
    { x: boxCenterX + (-halfW * cos - halfH * sin), y: boxCenterY + (-halfW * sin + halfH * cos) },
  ];

  // Check if any corner of the box is inside the zone
  for (const corner of corners) {
    if (
      corner.x >= zoneX &&
      corner.x <= zoneX + zoneWidth &&
      corner.y >= zoneY &&
      corner.y <= zoneY + zoneHeight
    ) {
      return true;
    }
  }

  // Check if any corner of the zone is inside the box
  // Transform zone corners to box-local coordinates
  const zoneCorners = [
    { x: zoneX, y: zoneY },
    { x: zoneX + zoneWidth, y: zoneY },
    { x: zoneX + zoneWidth, y: zoneY + zoneHeight },
    { x: zoneX, y: zoneY + zoneHeight },
  ];

  for (const corner of zoneCorners) {
    // Translate to box center
    const dx = corner.x - boxCenterX;
    const dy = corner.y - boxCenterY;
    // Rotate to box-local coordinates (reverse rotation)
    const localX = dx * cos + dy * sin;
    const localY = -dx * sin + dy * cos;
    // Check if inside box bounds
    if (Math.abs(localX) <= halfW && Math.abs(localY) <= halfH) {
      return true;
    }
  }

  // Check if box center is inside zone (handles case where box is entirely inside zone)
  if (
    boxCenterX >= zoneX &&
    boxCenterX <= zoneX + zoneWidth &&
    boxCenterY >= zoneY &&
    boxCenterY <= zoneY + zoneHeight
  ) {
    return true;
  }

  return false;
}

export const zoneSystem: System<GameEntity, GameGlobal> = (world, _deltaTime) => {
  const boxEntity = world.entities.find((entity) => entity.box);
  if (!boxEntity?.transform || !boxEntity?.collision) return world;

  const zones = world.entities.filter((e) => e.zone);

  // Only check zone collisions if player has a box
  const hasBox = boxEntity.box?.hasBox ?? false;
  
  // Calculate box center for collision detection
  const boxCenterX = boxEntity.transform.x + boxEntity.collision.width / 2;
  const boxCenterY = boxEntity.transform.y + boxEntity.collision.height / 2;
  const boxRotation = boxEntity.transform.rotation || 0;

  for (const zone of zones) {
    if (!zone.transform || !zone.collision || !zone.zone) continue;

    // Check if box overlaps with zone (accounting for rotation)
    const overlapsZone = hasBox && boxOverlapsZone(
      boxCenterX,
      boxCenterY,
      boxEntity.collision.width,
      boxEntity.collision.height,
      boxRotation,
      zone.transform.x,
      zone.transform.y,
      zone.collision.width,
      zone.collision.height
    );

    if (zone.zone.type === "shipping") {
      if (hasBox && overlapsZone) {
        shipBox(world);
      } else {
        // Reset shipping flag when box leaves shipping zone
        shippingInProgress = false;
      }
    }
    
    if (zone.zone.type === "restock") {
      // For restock, check if pointer is in zone (no box yet)
      const pointer = world.entities.find((e) => e.pointer)?.pointer;
      if (!pointer) continue;
      
      const pointerInZone =
        pointer.x >= zone.transform.x &&
        pointer.x <= zone.transform.x + zone.collision.width &&
        pointer.y >= zone.transform.y &&
        pointer.y <= zone.transform.y + zone.collision.height;

      if (!hasBox && pointerInZone) {
        buyBox(world);
      } else {
        // Reset buyBox flag when leaving zone or has box
        buyBoxInProgress = false;
      }
    }
  }

  return world;
};

function shipBox(world: GameWorld): void {
  // Prevent repeated shipping while in zone
  if (shippingInProgress) return;
  
  const packed = world.entities.filter((e) => e.boxAnchor);
  if (packed.length === 0) return;

  const scoreEntity = world.entities.find((e) => e.score);
  if (!scoreEntity?.score) return;

  // Mark shipping as in progress to prevent repeated sound/feedback
  shippingInProgress = true;

  // Play shipped sound
  playSound("shipped");

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

  const itemsShipped = packed.length;

  world.updateEntities((entities) =>
    entities.map((e) => {
      if (e.feedback) {
        return {
          ...e,
          feedback: {
            ...e.feedback,
            effects: [...e.feedback.effects, newFeedback],
          },
        };
      }
      if (e.score) {
        return { ...e, score: { ...e.score, value: e.score.value + boxValue } };
      }
      if (e.box) {
        return { ...e, box: { ...e.box, hasBox: false } };
      }
      if (e.gameState) {
        return { ...e, gameState: { ...e.gameState, itemsProcessed: e.gameState.itemsProcessed + itemsShipped } };
      }
      return e;
    })
  );

  packed.forEach((p) => {
    world.removeEntity(p.id);
  });
}

function buyBox(world: GameWorld): void {
  // Prevent repeated buyBox calls while in zone
  if (buyBoxInProgress) return;

  const scoreEntity = world.entities.find((e) => e.score);
  const pointer = world.entities.find((e) => e.pointer)?.pointer;
  if (!scoreEntity?.score || !pointer) return;

  if (scoreEntity.score.value < 200) {
    const feedback = {
      text: "INSUFFICIENT FUNDS",
      x: 150,
      y: world.global.canvas.height - 200,
      color: "#ff4444",
      size: 30,
      life: 1,
      velocityY: -1,
    };
    world.updateEntities((entities) =>
      entities.map((e) => {
        if (e.feedback) {
          return {
            ...e,
            feedback: {
              ...e.feedback,
              effects: [...e.feedback.effects, feedback],
            },
          };
        }
        return e;
      })
    );
    return;
  }

  // Mark buyBox as in progress to prevent repeated calls
  buyBoxInProgress = true;

  // Play get box sound
  playSound("getBox");

  const feedback = {
    text: "NEW BOX -$200",
    x: 150,
    y: world.global.canvas.height - 200,
    color: "#f1c40f",
    size: 40,
    life: 1,
    velocityY: -1,
  };

  world.updateEntities((entities) =>
    entities.map((e) => {
      if (e.feedback) {
        return {
          ...e,
          feedback: {
            ...e.feedback,
            effects: [...e.feedback.effects, feedback],
          },
        };
      }
      if (e.score) {
        return { ...e, score: { ...e.score, value: e.score.value - 200 } };
      }
      if (e.box && e.transform && e.collision) {
        return {
          ...e,
          box: { ...e.box, hasBox: true },
          transform: {
            ...e.transform,
            x: pointer.x - e.collision.width / 2,
            y: pointer.y - e.collision.height / 2,
          },
        };
      }
      if (e.conveyor) {
        return { ...e, conveyor: { ...e.conveyor, isActive: true } };
      }
      return e;
    })
  );
}
