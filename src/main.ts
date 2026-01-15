import "./style.css";
import type { WithCollision, WithRender, WithScore, WithTransform, WithVelocity } from "./types";

type ComponentKey = "transform" | "velocity" | "render" | "collision" | "score";

type EntityKind = "item" | "box" | "packed-item" | "zone";

type Entity = {
  id: number;
  kind: EntityKind;
  state?: "belt" | "falling" | "packed";
  zoneType?: "restock" | "shipping";
  relX?: number;
  relY?: number;
  fallScale?: number;
  isBad?: boolean;
  rotation?: number;
  size?: number;
} & Partial<WithTransform & WithVelocity & WithRender & WithCollision & WithScore>;

type World = {
  entities: Entity[];
  nextId: number;
  score: number;
  hasBox: boolean;
  spawnTimer: number;
  spawnInterval: number;
  packedCount: number;
  mouseX: number;
  mouseY: number;
};

const canvas = document.getElementById("gameCanvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const scoreEl = document.getElementById("score")!;

const world: World = {
  entities: [],
  nextId: 1,
  score: 600,
  hasBox: true,
  spawnTimer: 0,
  spawnInterval: 1000,
  packedCount: 0,
  mouseX: 0,
  mouseY: 0,
};

// Configuration
const FLOOR_COLOR = "#2a2a2a";
const CONVEYOR_COLOR = "#1a1a1a";
const CONVEYOR_BORDER_COLOR = "#f39c12";
const BOX_COLOR = "#d2b48c";
const BOX_SHADOW = "#8b5a2b";
const ZONE_SIZE = 200;

const OBJECTS = ["🧸", "📱", "👟", "📚", "⌚", "🎮", "🧴", "🕶️", "📷", "🎁", "💊", "👕"];

// Dimensions
let CONVEYOR_WIDTH = 300;
let CONVEYOR_LENGTH = 0;
const BOX_WIDTH = 180;
const BOX_HEIGHT = 130;
const ITEM_SPEED_BELT = 250;
const ITEM_SPEED_FALL = 450;
const ITEM_SIZE = 45;

// ECS helpers
const hasComponent = (entity: Entity, key: ComponentKey) => key in entity;

const createEntity = (kind: EntityKind, components: Partial<Entity>): Entity => {
  const entity: Entity = {
    id: world.nextId++,
    kind,
    ...components,
  };
  world.entities.push(entity);
  return entity;
};

const getEntities = (predicate: (entity: Entity) => boolean) => world.entities.filter(predicate);

const removeEntity = (id: number) => {
  world.entities = world.entities.filter((entity) => entity.id !== id);
};

const getBoxEntity = () => world.entities.find((entity) => entity.kind === "box");

const packedEntities = () => getEntities((entity) => entity.kind === "packed-item");

const itemEntities = () => getEntities((entity) => entity.kind === "item");

const zoneEntities = () => getEntities((entity) => entity.kind === "zone");

// World Setup
const boxEntity = createEntity("box", {
  transform: { x: 0, y: 0, rotation: 0, scale: 1 },
  collision: { width: BOX_WIDTH, height: BOX_HEIGHT, type: "rectangle" },
  render: { emoji: "📦" },
});

createEntity("zone", {
  zoneType: "restock",
  transform: { x: 0, y: 0, rotation: 0, scale: 1 },
  collision: { width: ZONE_SIZE, height: ZONE_SIZE, type: "rectangle" },
});

createEntity("zone", {
  zoneType: "shipping",
  transform: { x: 0, y: 0, rotation: 0, scale: 1 },
  collision: { width: ZONE_SIZE, height: ZONE_SIZE, type: "rectangle" },
});

const feedbackEffects: Array<{ text: string; x: number; y: number; color: string; size: number; life: number; velocityY: number }> = [];

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  CONVEYOR_WIDTH = Math.min(350, canvas.width * 0.4);
  CONVEYOR_LENGTH = canvas.height * 0.55;

  if (boxEntity.transform && boxEntity.collision) {
    boxEntity.collision.width = BOX_WIDTH;
    boxEntity.collision.height = BOX_HEIGHT;

    if (boxEntity.transform.x === 0 && boxEntity.transform.y === 0) {
      boxEntity.transform.x = canvas.width / 2 - boxEntity.collision.width / 2;
      boxEntity.transform.y = canvas.height - boxEntity.collision.height - 50;
    }
  }

  zoneEntities().forEach((zone) => {
    if (!zone.transform || !zone.collision) return;
    zone.collision.width = ZONE_SIZE;
    zone.collision.height = ZONE_SIZE;

    if (zone.zoneType === "restock") {
      zone.transform.x = 0;
      zone.transform.y = canvas.height - ZONE_SIZE;
    }
    if (zone.zoneType === "shipping") {
      zone.transform.x = canvas.width - ZONE_SIZE;
      zone.transform.y = canvas.height - ZONE_SIZE;
    }
  });
}

window.addEventListener("resize", resize);
resize();

// Input System
function handleInput(clientX: number, clientY: number) {
  world.mouseX = clientX;
  world.mouseY = clientY;

  const box = getBoxEntity();
  if (!box?.transform || !box?.collision) return;

  let newX = clientX - box.collision.width / 2;
  let newY = clientY - box.collision.height / 2;

  newX = Math.max(0, Math.min(canvas.width - box.collision.width, newX));
  newY = Math.max(0, Math.min(canvas.height - box.collision.height, newY));

  box.transform.x = newX;
  box.transform.y = newY;
}

canvas.addEventListener("mousemove", (event) => handleInput(event.clientX, event.clientY));
canvas.addEventListener(
  "touchmove",
  (event) => {
    event.preventDefault();
    const touch = event.touches[0];
    if (touch) handleInput(touch.clientX, touch.clientY);
  },
  { passive: false }
);

function addFeedback(text: string, x: number, y: number, color: string, size = 36) {
  feedbackEffects.push({ text, x, y, color, size, life: 1, velocityY: -1 });
}

// Spawn System
function spawnItem() {
  const emoji = OBJECTS[Math.floor(Math.random() * OBJECTS.length)];
  const beltLeft = (canvas.width - CONVEYOR_WIDTH) / 2;
  const padding = 30;
  const x = beltLeft + padding + Math.random() * (CONVEYOR_WIDTH - padding * 2);

  createEntity("item", {
    transform: { x, y: -60, rotation: 0, scale: 1 },
    velocity: { x: 0, y: ITEM_SPEED_BELT },
    render: { emoji },
    collision: { width: ITEM_SIZE, height: ITEM_SIZE, type: "rectangle" },
    state: "belt",
    fallScale: 1,
    rotation: (Math.random() - 0.5) * 0.5,
    size: ITEM_SIZE,
  });

  world.spawnInterval = Math.random() * 800 + 600;
}

function updateSpawning(deltaTime: number) {
  world.spawnTimer += deltaTime;
  if (world.spawnTimer > world.spawnInterval) {
    spawnItem();
    world.spawnTimer = 0;
  }
}

// Systems
function updateMovement(deltaTime: number) {
  getEntities((entity) => hasComponent(entity, "transform") && hasComponent(entity, "velocity")).forEach((entity) => {
    if (!entity.transform || !entity.velocity) return;
    entity.transform.x += (entity.velocity.x * deltaTime) / 1000;
    entity.transform.y += (entity.velocity.y * deltaTime) / 1000;
  });
}

function updateItemStates(deltaTime: number) {
  itemEntities().forEach((item) => {
    if (!item.transform || !item.velocity) return;

    if (item.state === "belt" && item.transform.y > CONVEYOR_LENGTH) {
      item.state = "falling";
      item.velocity.y = ITEM_SPEED_FALL;
    }

    if (item.state === "falling" && typeof item.fallScale === "number") {
      if (item.fallScale > 0.7) {
        item.fallScale -= (deltaTime / 1000) * 0.5;
      }
    }

    if (item.transform.y > canvas.height + 100) {
      removeEntity(item.id);
    }
  });
}

function updateFeedback(deltaTime: number) {
  for (let i = feedbackEffects.length - 1; i >= 0; i -= 1) {
    const effect = feedbackEffects[i];
    effect.life -= deltaTime / 800;
    effect.y += effect.velocityY;
    if (effect.life <= 0) feedbackEffects.splice(i, 1);
  }
}

function checkZones() {
  const box = getBoxEntity();
  if (!box?.transform || !box?.collision) return;

  zoneEntities().forEach((zone) => {
    if (!zone.transform || !zone.collision) return;
    const inZone =
      world.mouseX >= zone.transform.x &&
      world.mouseX <= zone.transform.x + zone.collision.width &&
      world.mouseY >= zone.transform.y &&
      world.mouseY <= zone.transform.y + zone.collision.height;

    if (zone.zoneType === "shipping" && world.hasBox && inZone) {
      shipBox();
    }
    if (zone.zoneType === "restock" && !world.hasBox && inZone) {
      buyBox();
    }
  });
}

function handlePacking() {
  if (!world.hasBox) return;
  const box = getBoxEntity();
  if (!box?.transform || !box?.collision) return;

  for (const item of itemEntities()) {
    if (!item.transform || item.state !== "falling") continue;
    const itemCenterX = item.transform.x;
    const itemCenterY = item.transform.y + (item.size ?? ITEM_SIZE) / 2;

    const hitY = itemCenterY >= box.transform.y + 10 && itemCenterY <= box.transform.y + box.collision.height - 10;
    const hitX = itemCenterX >= box.transform.x + 10 && itemCenterX <= box.transform.x + box.collision.width - 10;

    if (!hitX || !hitY) continue;

    const relX = itemCenterX - box.transform.x;
    const relY = itemCenterY - box.transform.y;

    let overlap = false;
    const safeDistance = ITEM_SIZE * 0.7;
    for (const packed of packedEntities()) {
      if (packed.relX == null || packed.relY == null) continue;
      const dx = packed.relX - relX;
      const dy = packed.relY - relY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < safeDistance) {
        overlap = true;
        break;
      }
    }

    if (overlap) {
      addFeedback("⚠️", box.transform.x + box.collision.width / 2, box.transform.y, "#ff4444");
    }

    createEntity("packed-item", {
      transform: { x: relX, y: relY, rotation: 0, scale: 0 },
      render: { emoji: item.render?.emoji ?? "📦" },
      collision: { width: ITEM_SIZE, height: ITEM_SIZE, type: "rectangle" },
      relX,
      relY,
      rotation: (Math.random() - 0.5) * 1.0,
      fallScale: item.fallScale ?? 1,
      isBad: overlap,
      state: "packed",
    });

    removeEntity(item.id);
  }
}

function updatePackedScaling() {
  packedEntities().forEach((packed) => {
    if (!packed.transform) return;
    const targetScale = packed.fallScale ?? 1;
    if (packed.transform.scale < targetScale) {
      packed.transform.scale += 0.15;
    }
  });
}

function shipBox() {
  const packed = packedEntities();
  if (packed.length === 0) return;

  let boxValue = 0;
  packed.forEach((entity) => {
    if (!entity.isBad) {
      boxValue += 100;
    } else {
      boxValue -= 10;
    }
  });

  world.score += boxValue;
  scoreEl.innerText = String(world.score);

  addFeedback(`SHIPPED! +$${boxValue}`, canvas.width - 150, canvas.height - 200, "#44ff44", 40);

  packed.forEach((entity) => removeEntity(entity.id));
  world.hasBox = false;
}

function buyBox() {
  if (world.score < 200) {
    addFeedback("INSUFFICIENT FUNDS", 150, canvas.height - 200, "#ff4444", 30);
    return;
  }

  world.score -= 200;
  scoreEl.innerText = String(world.score);
  world.hasBox = true;
  addFeedback("NEW BOX -$200", 150, canvas.height - 200, "#f1c40f", 40);

  const box = getBoxEntity();
  if (box?.transform && box?.collision) {
    box.transform.x = world.mouseX - box.collision.width / 2;
    box.transform.y = world.mouseY - box.collision.height / 2;
  }
}

function drawZones() {
  zoneEntities().forEach((zone) => {
    if (!zone.transform || !zone.collision) return;

    if (zone.zoneType === "restock") {
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
      if (!world.hasBox) {
        ctx.fillText("GET BOX", 0, -15);
        ctx.fillText("($200)", 0, 15);
        ctx.globalAlpha = (Math.sin(Date.now() / 200) + 1) / 4;
        ctx.fillStyle = "#fff";
        ctx.fillRect(-zone.collision.width / 2, -zone.collision.height / 2, zone.collision.width, zone.collision.height);
      } else {
        ctx.globalAlpha = 0.5;
        ctx.fillText("RESTOCK", 0, 0);
      }
      ctx.restore();
    }

    if (zone.zoneType === "shipping") {
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
      if (world.hasBox && packedEntities().length > 0) {
        ctx.fillText("SHIP IT", 0, -15);
        ctx.fillText(">>>>>", 0, 15);
        ctx.globalAlpha = (Math.sin(Date.now() / 200) + 1) / 4;
        ctx.fillStyle = "#fff";
        ctx.fillRect(-zone.collision.width / 2, -zone.collision.height / 2, zone.collision.width, zone.collision.height);
      } else {
        ctx.globalAlpha = 0.5;
        ctx.fillText("SHIPPING", 0, 0);
      }
      ctx.restore();
    }
  });
}

function drawBox() {
  const box = getBoxEntity();
  if (!box?.transform || !box?.collision) return;

  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.beginPath();
  ctx.ellipse(box.transform.x + box.collision.width / 2 + 15, box.transform.y + box.collision.height + 15, box.collision.width / 2, 20, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = BOX_COLOR;
  ctx.fillRect(box.transform.x, box.transform.y, box.collision.width, box.collision.height);

  ctx.fillStyle = BOX_SHADOW;
  const wall = 8;
  ctx.fillRect(box.transform.x + wall, box.transform.y + wall, box.collision.width - wall * 2, box.collision.height - wall * 2);

  ctx.save();
  ctx.beginPath();
  ctx.rect(box.transform.x + wall, box.transform.y + wall, box.collision.width - wall * 2, box.collision.height - wall * 2);
  ctx.clip();

  packedEntities().forEach((packed) => {
    if (!packed.transform) return;
    ctx.save();
    ctx.translate(box.transform!.x + (packed.relX ?? 0), box.transform!.y + (packed.relY ?? 0));
    ctx.rotate(packed.rotation ?? 0);
    ctx.scale(packed.transform.scale, packed.transform.scale);

    if (packed.isBad) {
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

    if (packed.isBad) {
      ctx.fillStyle = "rgba(255,0,0,0.8)";
      ctx.font = "bold 24px Arial";
      ctx.fillText("❌", 0, 0);
    }
    ctx.restore();
  });
  ctx.restore();

  ctx.strokeStyle = "#a07040";
  ctx.lineWidth = 4;
  ctx.strokeRect(box.transform.x, box.transform.y, box.collision.width, box.collision.height);

  ctx.beginPath();
  ctx.moveTo(box.transform.x, box.transform.y);
  ctx.lineTo(box.transform.x + 25, box.transform.y + 25);
  ctx.moveTo(box.transform.x + box.collision.width, box.transform.y);
  ctx.lineTo(box.transform.x + box.collision.width - 25, box.transform.y + 25);
  ctx.moveTo(box.transform.x, box.transform.y + box.collision.height);
  ctx.lineTo(box.transform.x + 25, box.transform.y + box.collision.height - 25);
  ctx.moveTo(box.transform.x + box.collision.width, box.transform.y + box.collision.height);
  ctx.lineTo(box.transform.x + box.collision.width - 25, box.transform.y + box.collision.height - 25);
  ctx.stroke();
}

function drawConveyor() {
  const beltX = (canvas.width - CONVEYOR_WIDTH) / 2;

  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(beltX + 20, CONVEYOR_LENGTH, CONVEYOR_WIDTH - 40, 40);

  ctx.fillStyle = CONVEYOR_BORDER_COLOR;
  ctx.fillRect(beltX - 15, -50, CONVEYOR_WIDTH + 30, CONVEYOR_LENGTH + 50);

  ctx.fillStyle = CONVEYOR_COLOR;
  ctx.fillRect(beltX, -50, CONVEYOR_WIDTH, CONVEYOR_LENGTH + 50);

  ctx.save();
  ctx.beginPath();
  ctx.rect(beltX, -50, CONVEYOR_WIDTH, CONVEYOR_LENGTH + 50);
  ctx.clip();

  ctx.strokeStyle = "#333";
  ctx.lineWidth = 5;
  const timeOffset = (Date.now() / 4) % 80;
  for (let y = -100; y < CONVEYOR_LENGTH + 50; y += 80) {
    const drawY = y + timeOffset;
    ctx.beginPath();
    ctx.moveTo(beltX, drawY - 20);
    ctx.lineTo(beltX + CONVEYOR_WIDTH / 2, drawY + 20);
    ctx.lineTo(beltX + CONVEYOR_WIDTH, drawY - 20);
    ctx.stroke();
  }
  ctx.restore();

  const gradient = ctx.createLinearGradient(0, CONVEYOR_LENGTH - 15, 0, CONVEYOR_LENGTH + 15);
  gradient.addColorStop(0, "#444");
  gradient.addColorStop(0.5, "#777");
  gradient.addColorStop(1, "#444");
  ctx.fillStyle = gradient;
  ctx.fillRect(beltX - 20, CONVEYOR_LENGTH - 15, CONVEYOR_WIDTH + 40, 30);

  ctx.fillStyle = "#d35400";
  ctx.fillRect(beltX - 15, -50, 10, CONVEYOR_LENGTH + 50);
  ctx.fillRect(beltX + CONVEYOR_WIDTH + 5, -50, 10, CONVEYOR_LENGTH + 50);
}

function drawItem(item: Entity) {
  if (!item.transform) return;
  ctx.save();
  ctx.translate(item.transform.x, item.transform.y);
  ctx.rotate(item.rotation ?? 0);

  const scale = item.state === "falling" ? item.fallScale ?? 1 : 1;
  ctx.scale(scale, scale);

  let shadowY = 5;
  let shadowBlur = 5;
  let shadowAlpha = 0.3;

  if (item.state === "falling") {
    shadowY = 15 + (1 - (item.fallScale ?? 1)) * 50;
    shadowBlur = 10;
    shadowAlpha = 0.3 * (item.fallScale ?? 1);
  }

  ctx.shadowColor = `rgba(0,0,0,${shadowAlpha})`;
  ctx.shadowBlur = shadowBlur;
  ctx.shadowOffsetY = shadowY;

  ctx.font = `${item.size ?? ITEM_SIZE}px Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(item.render?.emoji ?? "📦", 0, 0);
  ctx.restore();
}

function drawFeedback() {
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

function draw() {
  ctx.fillStyle = FLOOR_COLOR;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawZones();

  if (world.hasBox) {
    drawBox();
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.beginPath();
    ctx.arc(world.mouseX, world.mouseY, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.stroke();
  }

  itemEntities().forEach((item) => {
    if (item.state === "falling") drawItem(item);
  });

  drawConveyor();

  const beltX = (canvas.width - CONVEYOR_WIDTH) / 2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(beltX, -100, CONVEYOR_WIDTH, CONVEYOR_LENGTH + 100);
  ctx.clip();
  itemEntities().forEach((item) => {
    if (item.state === "belt") drawItem(item);
  });
  ctx.restore();

  drawFeedback();
}

function update(deltaTime: number) {
  checkZones();
  updateSpawning(deltaTime);
  updateFeedback(deltaTime);
  updateMovement(deltaTime);
  updateItemStates(deltaTime);
  handlePacking();
  updatePackedScaling();
}

let lastTime = 0;
function loop(timestamp: number) {
  const deltaTime = timestamp - lastTime;
  lastTime = timestamp;
  update(deltaTime);
  draw();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
