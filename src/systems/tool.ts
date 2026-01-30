import { playSound } from "../audio";
import type { GameEntity, GameGlobal } from "../domain";
import type { System } from "../engine";

/**
 * The box tool (tool1) interacts with everything by turning them into 📦
 * It has a fixed cost of -30 score per use
 */
const BOX_TOOL_COST = -30;

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

interface Point {
  x: number;
  y: number;
}

/**
 * Get the four corners of an oriented rectangle.
 * @param centerX - X position of the rotation center
 * @param centerY - Y position of the rotation center
 * @param width - Width of the rectangle
 * @param height - Height of the rectangle
 * @param rotation - Rotation angle in radians
 * @param xOffset - X offset of the box center from the rotation center (in local coordinates)
 * @param yOffset - Y offset of the box center from the rotation center (in local coordinates)
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

  // Corner positions relative to box center (which is at offset from rotation center)
  const localCorners = [
    { x: xOffset - halfWidth, y: yOffset - halfHeight }, // top-left
    { x: xOffset + halfWidth, y: yOffset - halfHeight }, // top-right
    { x: xOffset + halfWidth, y: yOffset + halfHeight }, // bottom-right
    { x: xOffset - halfWidth, y: yOffset + halfHeight }, // bottom-left
  ];

  // Rotate corners around the rotation center and translate to world position
  return localCorners.map((corner) => ({
    x: centerX + corner.x * cos - corner.y * sin,
    y: centerY + corner.x * sin + corner.y * cos,
  }));
}

/**
 * Get the axes (edge normals) of an oriented rectangle for SAT collision.
 */
function getRectangleAxes(corners: Point[]): Point[] {
  const axes: Point[] = [];
  for (let i = 0; i < corners.length; i++) {
    const p1 = corners[i];
    const p2 = corners[(i + 1) % corners.length];
    // Edge vector
    const edge = { x: p2.x - p1.x, y: p2.y - p1.y };
    // Normal (perpendicular)
    const length = Math.hypot(edge.x, edge.y);
    if (length > 0) {
      axes.push({ x: -edge.y / length, y: edge.x / length });
    }
  }
  // Only need 2 unique axes for a rectangle (perpendicular edges)
  return [axes[0], axes[1]];
}

/**
 * Project a set of points onto an axis and get min/max.
 */
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

/**
 * Check if two projections overlap.
 */
function projectionsOverlap(a: { min: number; max: number }, b: { min: number; max: number }): boolean {
  return a.max >= b.min && b.max >= a.min;
}

/**
 * Check collision between an oriented rectangle (tool) and a point-based circle (item).
 * Uses Separating Axis Theorem (SAT) for accurate oriented rectangle collision.
 * Items are treated as small axis-aligned circles centered at their position.
 */
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
  // Get the tool rectangle corners
  const toolCorners = getRectangleCorners(toolCenterX, toolCenterY, toolWidth, toolHeight, toolRotation, toolXOffset, toolYOffset);

  // For items, treat them as small axis-aligned rectangles (no rotation)
  const itemHalfWidth = itemWidth / 2;
  const itemHalfHeight = itemHeight / 2;
  const itemCorners: Point[] = [
    { x: itemX - itemHalfWidth, y: itemY - itemHalfHeight },
    { x: itemX + itemHalfWidth, y: itemY - itemHalfHeight },
    { x: itemX + itemHalfWidth, y: itemY + itemHalfHeight },
    { x: itemX - itemHalfWidth, y: itemY + itemHalfHeight },
  ];

  // Get axes from both rectangles
  const toolAxes = getRectangleAxes(toolCorners);
  const itemAxes = [
    { x: 1, y: 0 }, // Horizontal axis for axis-aligned item
    { x: 0, y: 1 }, // Vertical axis for axis-aligned item
  ];
  const allAxes = [...toolAxes, ...itemAxes];

  // Check for separation on each axis (SAT)
  for (const axis of allAxes) {
    const toolProjection = projectOntoAxis(toolCorners, axis);
    const itemProjection = projectOntoAxis(itemCorners, axis);
    if (!projectionsOverlap(toolProjection, itemProjection)) {
      // Found a separating axis - no collision
      return false;
    }
  }

  // No separating axis found - collision detected
  return true;
}

/**
 * Tool system that handles interactions between tools and items.
 * - Tool 1 (container): Wraps items into box emoji 📦 with fixed cost
 * - Tool 2 (flat iron): Transforms items using ironToolTransforms table
 */
export const toolSystem: System<GameEntity, GameGlobal> = (world, _deltaTime) => {
  const tools = world.entities.filter((e) => e.tool && e.transform && e.collision);
  if (tools.length === 0) return world;

  // Get items that are currently on the belt or falling (not packed or held)
  const items = world.entities.filter(
    (e) => e.itemState && e.itemState.state !== "packed" && e.itemState.state !== "held" && !e.boxAnchor && e.transform && e.collision && e.render
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

  for (const tool of tools) {
    if (!tool.tool || !tool.transform || !tool.collision) continue;
    // Skip inactive tools (not currently being touched)
    if (!tool.tool.isActive) continue;

    const toolWidth = tool.collision.width;
    const toolHeight = tool.collision.height;
    const toolRotation = tool.transform.rotation;
    const toolXOffset = tool.collision.xOffset ?? 0;
    const toolYOffset = tool.collision.yOffset ?? 0;

    for (const item of items) {
      if (!item.transform || !item.collision || !item.render || processedItems.has(item.id)) continue;

      const itemWidth = item.physical?.size ?? item.collision.width;
      const itemHeight = item.physical?.size ?? item.collision.height;

      const isColliding = checkToolItemCollision(
        tool.transform.x,
        tool.transform.y,
        toolWidth,
        toolHeight,
        toolRotation,
        toolXOffset,
        toolYOffset,
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
        // Skip items that have already been ironed to prevent multiple score deductions
        if (item.ironable?.ironed) continue;

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

          // Mark item as ironed to prevent multiple score deductions
          item.ironable = { ironed: true };
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

      const toolWidth = e.collision.width;
      const toolHeight = e.collision.height;
      const toolRotation = e.transform.rotation;
      const toolXOffset = e.collision.xOffset ?? 0;
      const toolYOffset = e.collision.yOffset ?? 0;
      let isCurrentlyColliding = false;

      for (const item of currentItems) {
        if (!item.transform || !item.collision) continue;
        const itemWidth = item.physical?.size ?? item.collision.width;
        const itemHeight = item.physical?.size ?? item.collision.height;

        if (
          checkToolItemCollision(
            e.transform.x,
            e.transform.y,
            toolWidth,
            toolHeight,
            toolRotation,
            toolXOffset,
            toolYOffset,
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
