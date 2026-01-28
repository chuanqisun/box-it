import { playSound } from "../audio";
import type { GameEntity, GameGlobal } from "../domain";
import type { System } from "../engine";

/**
 * The box tool (tool1) interacts with everything by turning them into 📦
 * It has a fixed cost of -100 score per use
 */
const BOX_TOOL_COST = -100;

/**
 * The flat iron tool (tool2) interacts with the following predefined emojis. It may result in positive or negative score change.
 * Some special items may be destroyed when ironed.
 */

interface IronTransform {
  input: string;
  output: string;
  score: number;
  destroyed?: boolean;
}

const ironToolTransforms: IronTransform[] = [
  { input: "👕", output: "🧺", score: 100 },
  { input: "👗", output: "🧺", score: 100 },
  { input: "👖", output: "🧺", score: 100 },
  { input: "👘", output: "🧺", score: 100 },
  { input: "👔", output: "🧺", score: 100 },
  { input: "👙", output: "🧺", score: 100 },
  { input: "🧥", output: "🧺", score: 100 },
  { input: "👚", output: "🧺", score: 100 },
  { input: "🩳", output: "🧺", score: 100 },
  { input: "🧦", output: "🧺", score: 100 },
  { input: "🧤", output: "🧺", score: 100 },
  { input: "🧣", output: "🧺", score: 100 },
  { input: "🥻", output: "🧺", score: 100 },
  { input: "🩱", output: "🧺", score: 100 },
  { input: "🩲", output: "🧺", score: 100 },
  { input: "🥼", output: "🧺", score: 100 },
  { input: "🦺", output: "🧺", score: 100 },
  { input: "🥋", output: "🧺", score: 100 },
  { input: "👰", output: "🧺", score: 100 },
  { input: "🤵", output: "🧺", score: 100 },
  { input: "🍓", output: "🍯", score: -100 },
  { input: "🍇", output: "🍷", score: -100 },
  { input: "🍅", output: "🥫", score: -100 },
  { input: "🍎", output: "🧃", score: -100 },
  { input: "🍑", output: "🍯", score: -100 },
  { input: "🍒", output: "🍯", score: -100 },
  { input: "🫐", output: "🍯", score: -100 },
  { input: "🥝", output: "🧃", score: -100 },
  { input: "🍐", output: "🧃", score: -100 },
  { input: "🍍", output: "🧃", score: -100 },
  { input: "🥭", output: "🍯", score: -100 },
  { input: "🍉", output: "💧", score: -100 },
  { input: "🍌", output: "🍮", score: -100 },
  { input: "🌽", output: "🍿", score: 100 },
  { input: "🥔", output: "🍟", score: 100 },
  { input: "🥓", output: "🍳", score: 100 },
  { input: "🥩", output: "🍳", score: 100 },
  { input: "🥚", output: "🍳", score: 100 },
  { input: "🧀", output: "🫠", score: 100 },
  { input: "🧈", output: "🫠", score: 100 },
  { input: "🍔", output: "💥", score: -300, destroyed: true },
  { input: "🍕", output: "🍕", score: 100 },
  { input: "🥪", output: "🥪", score: 100 },
  { input: " taco ", output: "💥", score: -300, destroyed: true },
  { input: "🌯", output: "💥", score: -300, destroyed: true },
  { input: "🍰", output: "🧁", score: -300 },
  { input: "🎂", output: "🧁", score: -300 },
  { input: "🧁", output: "💥", score: -300, destroyed: true },
  { input: "🍦", output: "💧", score: -300 },
  { input: "🍧", output: "💧", score: -300 },
  { input: "🍨", output: "💧", score: -300 },
  { input: "🍩", output: "🍪", score: -100 },
  { input: "🍪", output: "💥", score: -100, destroyed: true },
  { input: "🥨", output: "🍪", score: -100 },
  { input: "🍮", output: "💥", score: -300, destroyed: true },
  { input: "🍫", output: "🫠", score: -100 },
  { input: "🍬", output: "🫠", score: -100 },
  { input: "🍭", output: "🫠", score: -100 },
  { input: "🐱", output: "🙀", score: -300 },
  { input: "🐶", output: "🐕", score: -300 },
  { input: "🐹", output: "🐹", score: -300 },
  { input: "🐰", output: "🐰", score: -300 },
  { input: "🐭", output: "🐭", score: -300 },
  { input: "🦊", output: "🦊", score: -300 },
  { input: "🐻", output: "🐻", score: -300 },
  { input: "🐼", output: "🐼", score: -300 },
  { input: "🐨", output: "🐨", score: -300 },
  { input: "🐯", output: "🐯", score: -300 },
  { input: "🦁", output: "🦁", score: -300 },
  { input: "🐮", output: "🐮", score: -300 },
  { input: "🐷", output: "🐷", score: -300 },
  { input: "🐸", output: "🐸", score: -300 },
  { input: "🐵", output: "🐵", score: -300 },
  { input: "🐔", output: "🍗", score: -300 },
  { input: "🐧", output: "🐧", score: -300 },
  { input: "🐦", output: "🐦", score: -300 },
  { input: "🐤", output: "🐤", score: -300 },
  { input: "🦆", output: "🦆", score: -300 },
  { input: "🦅", output: "🦅", score: -300 },
  { input: "🦉", output: "🦉", score: -300 },
  { input: "🦇", output: "🦇", score: -300 },
  { input: "🐺", output: "🐺", score: -300 },
  { input: "🐗", output: "🐗", score: -300 },
  { input: "🐴", output: "🐴", score: -300 },
  { input: "🦄", output: "🦄", score: -300 },
  { input: "🦓", output: "🦓", score: -300 },
  { input: "🦒", output: "🦒", score: -300 },
  { input: "🐘", output: "🐘", score: -300 },
  { input: "🦏", output: "🦏", score: -300 },
  { input: "🦛", output: "🦛", score: -300 },
  { input: "🐁", output: "🐁", score: -300 },
  { input: "🐀", output: "🐀", score: 300 },
  { input: "🐿️", output: "🐿️", score: -300 },
  { input: "🦔", output: "🦔", score: -100 },
  { input: "🦦", output: "🦦", score: -300 },
  { input: "🦥", output: "🦥", score: -300 },
  { input: "🦘", output: "🦘", score: -300 },
  { input: "🦡", output: "🦡", score: -300 },
  { input: "🦃", output: "🍗", score: -300 },
  { input: "Swan", output: "🦢", score: -300 },
  { input: "🦩", output: "🦩", score: -300 },
  { input: "🕊️", output: "🕊️", score: -300 },
  { input: "🦜", output: "🦜", score: -300 },
  { input: "🦎", output: "🦎", score: -300 },
  { input: "🦖", output: "🦖", score: -300 },
  { input: "🦕", output: "🦕", score: -300 },
  { input: "🐳", output: "🐳", score: -300 },
  { input: "🐋", output: "🐋", score: -300 },
  { input: "🦈", output: "🦈", score: -300 },
  { input: "🐙", output: "🦑", score: -300 },
  { input: "🐡", output: "💥", score: -300, destroyed: true },
  { input: "🐠", output: "🐠", score: -300 },
  { input: "🐬", output: "🐬", score: -300 },
  { input: "🦀", output: "🦀", score: -100 },
  { input: "🦞", output: "🦞", score: -100 },
  { input: "🦐", output: "🦐", score: -100 },
  { input: "🦑", output: "🦑", score: -100 },
  { input: "🐝", output: "💥", score: -100, destroyed: true },
  { input: "🐛", output: "💥", score: -100, destroyed: true },
  { input: "🦋", output: "💥", score: -300, destroyed: true },
  { input: "🐌", output: "💥", score: -100, destroyed: true },
  { input: "🐞", output: "💥", score: -100, destroyed: true },
  { input: "🦂", output: "💥", score: 300, destroyed: true },
  { input: "🕷️", output: "💥", score: 300, destroyed: true },
  { input: "🦟", output: "💥", score: 300, destroyed: true },
  { input: "🦠", output: "💥", score: 300, destroyed: true },
  { input: "🧍", output: "🤕", score: -300 },
  { input: "👶", output: "🤕", score: -300 },
  { input: "👴", output: "🤕", score: -300 },
  { input: "👵", output: "🤕", score: -300 },
  { input: "👨", output: "🤕", score: -300 },
  { input: "👩", output: "🤕", score: -300 },
  { input: "👧", output: "🤕", score: -300 },
  { input: "👦", output: "🤕", score: -300 },
  { input: "👮", output: "🤕", score: -300 },
  { input: "👷", output: "🤕", score: -300 },
  { input: "💂", output: "🤕", score: -300 },
  { input: "🕵️", output: "🤕", score: -300 },
  { input: "🦸", output: "🤕", score: -300 },
  { input: "🦹", output: "🤕", score: -300 },
  { input: "🧙", output: "🤕", score: -300 },
  { input: "🧝", output: "🤕", score: -300 },
  { input: "🧛", output: "🤕", score: -300 },
  { input: "🧟", output: "🤕", score: -100 },
  { input: "🧜", output: "🤕", score: -300 },
  { input: "🧚", output: "🤕", score: -300 },
  { input: "👼", output: "🤕", score: -300 },
  { input: "🌻", output: "🥀", score: -100 },
  { input: "🌷", output: "🥀", score: -100 },
  { input: "🌹", output: "🥀", score: -100 },
  { input: "🌺", output: "🥀", score: -100 },
  { input: "🌸", output: "🥀", score: -100 },
  { input: "🌼", output: "🥀", score: -100 },
  { input: "🌱", output: "🥀", score: -100 },
  { input: "🌿", output: "🥀", score: -100 },
  { input: "🍀", output: "🥀", score: -100 },
  { input: "💐", output: "🥀", score: -100 },
  { input: "🌵", output: "🌵", score: -100 },
  { input: "🌲", output: "🌲", score: -100 },
  { input: "🌳", output: "🌳", score: -100 },
  { input: "🌴", output: "🌴", score: -100 },
  { input: "🍄", output: "💥", score: -100, destroyed: true },
  { input: "🧊", output: "💧", score: 100 },
  { input: "⛄", output: "💧", score: -100 },
  { input: "🏔️", output: "💧", score: -100 },
  { input: "🗻", output: "💧", score: -100 },
  { input: "🌋", output: "🔥", score: 300 },
  { input: "🎈", output: "💥", score: -100, destroyed: true },
  { input: "💵", output: "💸", score: 300 },
  { input: "🧧", output: "💵", score: 300 },
  { input: "📄", output: "📃", score: 100 },
  { input: "📜", output: "📃", score: 100 },
  { input: "🗺️", output: "📃", score: 100 },
  { input: "✉️", output: "📩", score: 100 },
  { input: "🕯️", output: "🫠", score: -100 },
  { input: "🖍️", output: "🫠", score: -100 },
  { input: "☕", output: "💨", score: 100, destroyed: true },
  { input: "🍵", output: "💨", score: 100, destroyed: true },
  { input: "♨️", output: "💨", score: 100, destroyed: true },
  { input: "🍼", output: "🥛", score: -100 },
  { input: "🥛", output: "🥛", score: -100 },
  { input: "🍷", output: "🍷", score: -100 },
  { input: "🍸", output: "🍸", score: -100 },
  { input: "🍹", output: "🍹", score: -100 },
  { input: "🍺", output: "🍺", score: -100 },
  { input: "🥤", output: "🥤", score: -100 },
  { input: "🥫", output: "💥", score: -300, destroyed: true },
  { input: "🍱", output: "💥", score: -300, destroyed: true },
  { input: "🥡", output: "💥", score: -300, destroyed: true },
  { input: "🌍", output: "🌍", score: -300 },
  { input: "🌎", output: "🌎", score: -300 },
  { input: "🌏", output: "🌏", score: -300 },
  { input: "🌡️", output: "💥", score: -300, destroyed: true },
  { input: "🧪", output: "💥", score: -300, destroyed: true },
  { input: "🧬", output: "💥", score: -300, destroyed: true },
  { input: "🧱", output: "🧱", score: -100 },
  { input: "🏠", output: "🏠", score: -300 },
  { input: "🏢", output: "🏢", score: -300 },
  { input: "🏕️", output: "⛺", score: 100 },
];

/**
 * Helper function to check collision between a circular tool and a rectangular item.
 * Returns true if there's any overlap (even tiny).
 */
function checkToolItemCollision(
  toolX: number,
  toolY: number,
  toolRadius: number,
  itemX: number,
  itemY: number,
  itemWidth: number,
  itemHeight: number
): boolean {
  // Tool center
  const toolCenterX = toolX + toolRadius;
  const toolCenterY = toolY + toolRadius;

  // Item bounds (item position is center-based)
  const itemLeft = itemX - itemWidth / 2;
  const itemRight = itemX + itemWidth / 2;
  const itemTop = itemY - itemHeight / 2;
  const itemBottom = itemY + itemHeight / 2;

  // Find the closest point on the item rectangle to the tool center
  const closestX = Math.max(itemLeft, Math.min(toolCenterX, itemRight));
  const closestY = Math.max(itemTop, Math.min(toolCenterY, itemBottom));

  // Calculate distance from tool center to closest point
  const dx = toolCenterX - closestX;
  const dy = toolCenterY - closestY;
  const distanceSquared = dx * dx + dy * dy;

  return distanceSquared <= toolRadius * toolRadius;
}

/**
 * Tool system that handles interactions between tools and items.
 * - Tool 1 (container): Wraps items into box emoji 📦 with fixed cost
 * - Tool 2 (flat iron): Transforms items using ironToolTransforms table
 * - Tool 3 (mover): Binds to the first touched item and moves it to the tool position
 */
export const toolSystem: System<GameEntity, GameGlobal> = (world, _deltaTime) => {
  const tools = world.entities.filter((e) => e.tool && e.transform && e.collision);
  if (tools.length === 0) return world;

  // Get items that are currently on the belt or falling (not packed)
  const items = world.entities.filter(
    (e) => e.itemState && !e.boxAnchor && e.transform && e.collision && e.render
  );

  // Track items to remove, transform, and score changes
  const itemsToRemove: number[] = [];
  const itemTransformations: Map<number, { emoji: string; name: string }> = new Map();
  let totalScoreChange = 0;
  const feedbackEffects: {
    text: string;
    x: number;
    y: number;
    color: string;
    size: number;
    life: number;
    velocityY: number;
  }[] = [];

  // Track which items have already been processed this frame to avoid double-processing
  const processedItems = new Set<number>();

  // Track mover tool bindings and position updates
  const moverUpdates: Map<number, { movingItemId: number | null }> = new Map();
  const itemPositionUpdates: Map<number, { x: number; y: number }> = new Map();

  for (const tool of tools) {
    if (!tool.tool || !tool.transform || !tool.collision) continue;

    // Skip tool3 (mover) in this loop - it's handled separately
    if (tool.tool.id === "tool3") continue;

    const toolRadius = tool.collision.radius ?? tool.collision.width / 2;

    for (const item of items) {
      if (!item.transform || !item.collision || !item.render || processedItems.has(item.id)) continue;

      const itemWidth = item.physical?.size ?? item.collision.width;
      const itemHeight = item.physical?.size ?? item.collision.height;

      const isColliding = checkToolItemCollision(
        tool.transform.x,
        tool.transform.y,
        toolRadius,
        item.transform.x,
        item.transform.y,
        itemWidth,
        itemHeight
      );

      if (!isColliding) continue;

      processedItems.add(item.id);

      if (tool.tool.id === "tool1") {
        // Tool 1: Container - turns items into 📦 with fixed cost
        // Skip if item is already a container
        const emoji = item.render.emoji;
        if (emoji === "📦") {
          continue;
        }

        // Play tool collision sound
        playSound("tool1");

        totalScoreChange += BOX_TOOL_COST;

        feedbackEffects.push({
          text: `📦 $${BOX_TOOL_COST}`,
          x: item.transform.x,
          y: item.transform.y - 30,
          color: "#f1c40f",
          size: 24,
          life: 1,
          velocityY: -1,
        });

        // Queue transformation to a box
        itemTransformations.set(item.id, { emoji: "📦", name: "📦" });
      } else if (tool.tool.id === "tool2") {
        // Tool 2: Flat Iron - transforms items based on the lookup table
        const emoji = item.render.emoji;
        const transform = ironToolTransforms.find((t) => t.input === emoji);

        if (transform) {
          // Play tool collision sound
          playSound("tool2");

          totalScoreChange += transform.score;

          const scoreColor = transform.score >= 0 ? "#2ecc71" : "#e74c3c";
          const scoreText = transform.score >= 0 ? `+$${transform.score}` : `$${transform.score}`;

          feedbackEffects.push({
            text: `${transform.output} ${scoreText}`,
            x: item.transform.x,
            y: item.transform.y - 30,
            color: scoreColor,
            size: 24,
            life: 1.2,
            velocityY: -1.2,
          });

          if (transform.destroyed) {
            // Item is destroyed - mark for removal
            itemsToRemove.push(item.id);
          } else {
            // Queue transformation
            itemTransformations.set(item.id, { emoji: transform.output, name: transform.output });
          }
        }
      }
      // Note: tool3 (mover) is handled separately below the collision loop
    }
  }

  // Handle mover tool (tool3) - moves items to tool position
  for (const tool of tools) {
    if (!tool.tool || tool.tool.id !== "tool3" || !tool.transform || !tool.collision) continue;

    const toolRadius = tool.collision.radius ?? tool.collision.width / 2;
    const toolCenterX = tool.transform.x + toolRadius;
    const toolCenterY = tool.transform.y + toolRadius;

    // If the mover tool already has a bound item, move it
    if (tool.tool.movingItemId != null) {
      const boundItem = items.find((item) => item.id === tool.tool!.movingItemId);
      if (boundItem && boundItem.transform) {
        // Update item position to follow the tool center
        itemPositionUpdates.set(boundItem.id, { x: toolCenterX, y: toolCenterY });
        // Mark item as processed to prevent other tools from interacting with it
        processedItems.add(boundItem.id);
      } else {
        // Item no longer exists, clear the binding
        moverUpdates.set(tool.id, { movingItemId: null });
      }
    } else if (tool.tool.isTouching) {
      // Mover is touching but not bound to any item yet - find first colliding item
      for (const item of items) {
        // Skip items already processed by another tool
        if (!item.transform || !item.collision || processedItems.has(item.id)) continue;

        const itemWidth = item.physical?.size ?? item.collision.width;
        const itemHeight = item.physical?.size ?? item.collision.height;

        const isColliding = checkToolItemCollision(
          tool.transform.x,
          tool.transform.y,
          toolRadius,
          item.transform.x,
          item.transform.y,
          itemWidth,
          itemHeight
        );

        if (isColliding) {
          // Bind to this item and mark it as processed
          processedItems.add(item.id);
          moverUpdates.set(tool.id, { movingItemId: item.id });
          // Also update position immediately
          itemPositionUpdates.set(item.id, { x: toolCenterX, y: toolCenterY });
          break; // Only bind to the first item
        }
      }
    }
  }

  // Apply all item transformations in a single batch
  if (itemTransformations.size > 0) {
    world.updateEntities((entities) =>
      entities.map((e) => {
        const transformation = itemTransformations.get(e.id);
        if (transformation) {
          return {
            ...e,
            render: { ...e.render!, emoji: transformation.emoji },
            name: { value: transformation.name },
          };
        }
        return e;
      })
    );
  }

  // Apply mover tool item position updates
  if (itemPositionUpdates.size > 0) {
    world.updateEntities((entities) =>
      entities.map((e) => {
        const positionUpdate = itemPositionUpdates.get(e.id);
        if (positionUpdate && e.transform) {
          return {
            ...e,
            transform: {
              ...e.transform,
              x: positionUpdate.x,
              y: positionUpdate.y,
            },
          };
        }
        return e;
      })
    );
  }

  // Apply mover tool binding updates
  if (moverUpdates.size > 0) {
    world.updateEntities((entities) =>
      entities.map((e) => {
        const moverUpdate = moverUpdates.get(e.id);
        if (moverUpdate && e.tool) {
          return {
            ...e,
            tool: {
              ...e.tool,
              movingItemId: moverUpdate.movingItemId,
            },
          };
        }
        return e;
      })
    );
  }

  // Remove destroyed items and update game state
  if (itemsToRemove.length > 0) {
    for (const id of itemsToRemove) {
      world.removeEntity(id);
    }

    // Update itemsProcessed count for destroyed items
    world.updateEntities((entities) =>
      entities.map((e) =>
        e.gameState
          ? {
              ...e,
              gameState: {
                ...e.gameState,
                itemsProcessed: e.gameState.itemsProcessed + itemsToRemove.length,
              },
            }
          : e
      )
    );
  }

  // Update score
  if (totalScoreChange !== 0) {
    world.updateEntities((entities) =>
      entities.map((e) =>
        e.score
          ? {
              ...e,
              score: {
                ...e.score,
                value: e.score.value + totalScoreChange,
              },
            }
          : e
      )
    );
  }

  // Add feedback effects
  if (feedbackEffects.length > 0) {
    world.updateEntities((entities) =>
      entities.map((e) =>
        e.feedback
          ? {
              ...e,
              feedback: {
                ...e.feedback,
                effects: [...e.feedback.effects, ...feedbackEffects],
              },
            }
          : e
      )
    );
  }

  // Update tool collision state for visual feedback
  // Get fresh items list excluding removed items
  const removedSet = new Set(itemsToRemove);
  const currentItems = items.filter((item) => !removedSet.has(item.id));

  world.updateEntities((entities) =>
    entities.map((e) => {
      if (!e.tool || !e.transform || !e.collision) return e;

      const toolRadius = e.collision.radius ?? e.collision.width / 2;
      let isCurrentlyColliding = false;

      for (const item of currentItems) {
        if (!item.transform || !item.collision) continue;
        const itemWidth = item.physical?.size ?? item.collision.width;
        const itemHeight = item.physical?.size ?? item.collision.height;

        if (
          checkToolItemCollision(
            e.transform.x,
            e.transform.y,
            toolRadius,
            item.transform.x,
            item.transform.y,
            itemWidth,
            itemHeight
          )
        ) {
          isCurrentlyColliding = true;
          break;
        }
      }

      return {
        ...e,
        tool: { ...e.tool, isColliding: isCurrentlyColliding },
      };
    })
  );

  return world;
};
