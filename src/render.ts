import type { FeedbackEffect } from "./components";
import type { GameEntity, GameWorld } from "./domain";

const FLOOR_COLOR = "#2a2a2a";
const CONVEYOR_COLOR = "#1a1a1a";
const CONVEYOR_BORDER_COLOR = "#f39c12";
const BOX_COLOR = "#d2b48c";
const BOX_SHADOW = "#8b5a2b";
const ITEM_SIZE = 45;

export function drawWorld(ctx: CanvasRenderingContext2D, world: GameWorld) {
  ctx.fillStyle = FLOOR_COLOR;
  ctx.fillRect(0, 0, world.global.canvas.width, world.global.canvas.height);

  drawZones(ctx, world);

  const boxEntity = world.entities.find((e) => e.box);
  const pointer = world.entities.find((e) => e.pointer)?.pointer;

  if (boxEntity?.box?.hasBox) {
    drawBox(ctx, world);
  } else if (pointer) {
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.beginPath();
    ctx.arc(pointer.x, pointer.y, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.stroke();
  }

  const items = world.entities.filter((e) => e.itemState && !e.boxAnchor);

  items.forEach((item) => {
    if (item.itemState?.state === "falling") drawItem(ctx, item);
  });

  const conveyor = world.entities.find((e) => e.conveyor)?.conveyor;
  if (conveyor) {
    drawConveyor(ctx, world, conveyor);

    const beltX = (world.global.canvas.width - conveyor.width) / 2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(beltX, -100, conveyor.width, conveyor.length + 100);
    ctx.clip();
    items.forEach((item) => {
      if (item.itemState?.state === "belt") drawItem(ctx, item);
    });
    ctx.restore();
  }

  world.entities.forEach((entity) => {
    if (entity.feedback) {
      drawFeedback(ctx, entity.feedback.effects);
    }
  });
}

function drawZones(ctx: CanvasRenderingContext2D, world: GameWorld) {
  const boxEntity = world.entities.find((e) => e.box);
  const hasBox = boxEntity?.box?.hasBox ?? false;

  world.entities
    .filter((e) => e.zone)
    .forEach((zone) => {
      if (!zone.transform || !zone.collision || !zone.zone) return;

      if (zone.zone.type === "restock") {
        ctx.fillStyle = "rgba(52, 152, 219, 0.2)";
        ctx.fillRect(zone.transform.x, zone.transform.y, zone.collision.width, zone.collision.height);
        ctx.strokeStyle = "#3498db";
        ctx.lineWidth = 2;
        ctx.strokeRect(zone.transform.x, zone.transform.y, zone.collision.width, zone.collision.height);

        ctx.save();
        ctx.translate(zone.transform.x + zone.collision.width / 2, zone.transform.y + zone.collision.height / 2);
        ctx.fillStyle = "#3498db";
        ctx.font = "bold 20px Arial";
        ctx.textAlign = "center";
        if (!hasBox) {
          ctx.fillText("GET BOX", 0, -15);
          ctx.fillText("($200)", 0, 15);
          ctx.globalAlpha = (Math.sin(Date.now() / 200) + 1) / 4;
          ctx.fillStyle = "#fff";
          ctx.fillText("↓", 0, 45);
        } else {
          ctx.fillText("READY", 0, 0);
        }
        ctx.restore();
      }

      if (zone.zone.type === "shipping") {
        ctx.fillStyle = "rgba(46, 204, 113, 0.2)";
        ctx.fillRect(zone.transform.x, zone.transform.y, zone.collision.width, zone.collision.height);
        ctx.strokeStyle = "#2ecc71";
        ctx.lineWidth = 2;
        ctx.strokeRect(zone.transform.x, zone.transform.y, zone.collision.width, zone.collision.height);

        ctx.save();
        ctx.translate(zone.transform.x + zone.collision.width / 2, zone.transform.y + zone.collision.height / 2);
        ctx.fillStyle = "#2ecc71";
        ctx.font = "bold 20px Arial";
        ctx.textAlign = "center";

        const packedCount = world.entities.filter((e) => e.boxAnchor).length;
        if (hasBox && packedCount > 0) {
          ctx.fillText("SHIP IT!", 0, -15);
          ctx.fillText(`(${packedCount} ITEMS)`, 0, 15);
          ctx.globalAlpha = (Math.sin(Date.now() / 200) + 1) / 4;
          ctx.fillStyle = "#fff";
          ctx.fillText("↓", 0, 45);
        } else {
          ctx.fillText("SHIPPING", 0, 0);
        }
        ctx.restore();
      }
    });
}

function drawBox(ctx: CanvasRenderingContext2D, world: GameWorld) {
  const box = world.entities.find((e) => e.box);
  if (!box?.transform || !box?.collision) return;

  ctx.save();
  const centerX = box.transform.x + box.collision.width / 2;
  const centerY = box.transform.y + box.collision.height / 2;
  const halfWidth = box.collision.width / 2;
  const halfHeight = box.collision.height / 2;
  const wall = 8;
  const left = -halfWidth;
  const top = -halfHeight;

  ctx.translate(centerX, centerY);
  ctx.rotate(box.transform.rotation);

  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.beginPath();
  ctx.ellipse(left + halfWidth + 15, top + box.collision.height + 15, halfWidth, 20, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = BOX_COLOR;
  ctx.fillRect(left, top, box.collision.width, box.collision.height);

  ctx.fillStyle = BOX_SHADOW;
  ctx.fillRect(left + wall, top + wall, box.collision.width - wall * 2, box.collision.height - wall * 2);

  ctx.save();
  ctx.beginPath();
  ctx.rect(left + wall, top + wall, box.collision.width - wall * 2, box.collision.height - wall * 2);
  ctx.clip();

  world.entities
    .filter((e) => e.boxAnchor)
    .forEach((packed) => {
      if (!packed.transform || !packed.boxAnchor) return;
      ctx.save();
      ctx.translate(left + packed.boxAnchor.relX, top + packed.boxAnchor.relY);
      ctx.rotate(packed.transform.rotation);
      ctx.scale(packed.transform.scale, packed.transform.scale);

      if (packed.quality?.isBad) {
        ctx.shadowColor = "red";
        ctx.shadowBlur = 15;
      } else {
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = 4;
        ctx.shadowOffsetY = 2;
      }

      ctx.font = "30px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(packed.render?.emoji ?? "📦", 0, 0);

      if (packed.quality?.isBad) {
        ctx.fillStyle = "rgba(255,0,0,0.8)";
        ctx.font = "bold 24px Arial";
        ctx.fillText("❌", 0, 0);
      }
      ctx.restore();
    });
  ctx.restore();

  ctx.strokeStyle = "#a07040";
  ctx.lineWidth = 4;
  ctx.strokeRect(left, top, box.collision.width, box.collision.height);

  ctx.beginPath();
  ctx.moveTo(left, top);
  ctx.lineTo(left + 25, top + 25);
  ctx.moveTo(left + box.collision.width, top);
  ctx.lineTo(left + box.collision.width - 25, top + 25);
  ctx.moveTo(left, top + box.collision.height);
  ctx.lineTo(left + 25, top + box.collision.height - 25);
  ctx.moveTo(left + box.collision.width, top + box.collision.height);
  ctx.lineTo(left + box.collision.width - 25, top + box.collision.height - 25);
  ctx.stroke();
  ctx.restore();
}

function drawConveyor(ctx: CanvasRenderingContext2D, world: GameWorld, conveyor: NonNullable<GameEntity["conveyor"]>) {
  const beltX = (world.global.canvas.width - conveyor.width) / 2;

  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(beltX + 20, conveyor.length, conveyor.width - 40, 40);

  ctx.fillStyle = CONVEYOR_BORDER_COLOR;
  ctx.fillRect(beltX - 15, -50, conveyor.width + 30, conveyor.length + 50);

  ctx.fillStyle = CONVEYOR_COLOR;
  ctx.fillRect(beltX, -50, conveyor.width, conveyor.length + 50);

  ctx.save();
  ctx.beginPath();
  ctx.rect(beltX, -50, conveyor.width, conveyor.length + 50);
  ctx.clip();

  ctx.strokeStyle = "#333";
  ctx.lineWidth = 5;
  const timeOffset = conveyor.offset;
  for (let y = -100; y < conveyor.length + 50; y += 80) {
    const drawY = y + timeOffset;
    ctx.beginPath();
    ctx.moveTo(beltX, drawY - 20);
    ctx.lineTo(beltX + conveyor.width / 2, drawY + 20);
    ctx.lineTo(beltX + conveyor.width, drawY - 20);
    ctx.stroke();
  }
  ctx.restore();

  const gradient = ctx.createLinearGradient(0, conveyor.length - 15, 0, conveyor.length + 15);
  gradient.addColorStop(0, "#444");
  gradient.addColorStop(0.5, "#777");
  gradient.addColorStop(1, "#444");
  ctx.fillStyle = gradient;
  ctx.fillRect(beltX - 20, conveyor.length - 15, conveyor.width + 40, 30);

  ctx.fillStyle = "#d35400";
  ctx.fillRect(beltX - 15, -50, 10, conveyor.length + 50);
  ctx.fillRect(beltX + conveyor.width + 5, -50, 10, conveyor.length + 50);
}

function drawItem(ctx: CanvasRenderingContext2D, item: GameEntity) {
  if (!item.transform) return;
  ctx.save();
  ctx.translate(item.transform.x, item.transform.y);
  ctx.rotate(item.transform.rotation);

  const scale = item.itemState?.state === "falling" ? item.itemState.fallScale : 1;
  ctx.scale(scale, scale);

  let shadowY = 5;
  let shadowBlur = 5;
  let shadowAlpha = 0.3;

  if (item.itemState?.state === "falling") {
    shadowY = 15 + (1 - item.itemState.fallScale) * 50;
    shadowBlur = 10;
    shadowAlpha = 0.3 * item.itemState.fallScale;
  }

  ctx.shadowColor = `rgba(0,0,0,${shadowAlpha})`;
  ctx.shadowBlur = shadowBlur;
  ctx.shadowOffsetY = shadowY;

  ctx.font = `${item.physical?.size ?? ITEM_SIZE}px Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(item.render?.emoji ?? "📦", 0, 0);
  ctx.restore();
}

function drawFeedback(ctx: CanvasRenderingContext2D, feedbackEffects: FeedbackEffect[]) {
  feedbackEffects.forEach((effect) => {
    ctx.save();
    ctx.globalAlpha = effect.life;
    ctx.fillStyle = effect.color;
    ctx.font = `900 ${effect.size}px Arial`;
    ctx.strokeStyle = "black";
    ctx.lineWidth = 4;
    ctx.strokeText(effect.text, effect.x, effect.y);
    ctx.fillText(effect.text, effect.x, effect.y);
    ctx.restore();
  });
}
