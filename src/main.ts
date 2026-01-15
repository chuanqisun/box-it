import { BehaviorSubject } from "rxjs";
import type { GameEntity, GameGlobal, GameWorld } from "./domain";
import { addEntity, createAnimationFrameDelta$, createWorld, runSystems } from "./engine";
import { drawWorld } from "./render";
import "./style.css";

// Systems
import { boxPackingSystem } from "./systems/boxPackingSystem";
import { feedbackSystem } from "./systems/feedbackSystem";
import { inputSystem } from "./systems/inputSystem";
import { itemStateSystem } from "./systems/itemStateSystem";
import { movementSystem } from "./systems/movementSystem";
import { resizeSystem } from "./systems/resizeSystem";
import { spawningSystem } from "./systems/spawningSystem";
import { zoneSystem } from "./systems/zoneSystem";

const canvas = document.getElementById("gameCanvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const scoreEl = document.getElementById("score")!;

const BOX_WIDTH = 180;
const BOX_HEIGHT = 130;
const ZONE_SIZE = 200;

// Initial state
const initialGlobal: GameGlobal = {
  score: 600,
  hasBox: true,
  spawnTimer: 0,
  spawnInterval: 1000,
  packedCount: 0,
  mouseX: 0,
  mouseY: 0,
  resizePending: true,
  resizeWidth: window.innerWidth,
  resizeHeight: window.innerHeight,
  canvasEl: canvas,
  canvas: { width: window.innerWidth, height: window.innerHeight },
  conveyor: { width: 300, length: window.innerHeight * 0.55 },
  feedbackEffects: [],
};

let world = createWorld<GameEntity, GameGlobal>(initialGlobal);

// Initial Entities
world = addEntity(world, {
  kind: "box",
  transform: { x: 0, y: 0, rotation: 0, scale: 1 },
  collision: { width: BOX_WIDTH, height: BOX_HEIGHT, type: "rectangle" },
  render: { emoji: "📦" },
});

world = addEntity(world, {
  kind: "zone",
  zone: { type: "restock" },
  transform: { x: 0, y: 0, rotation: 0, scale: 1 },
  collision: { width: ZONE_SIZE, height: ZONE_SIZE, type: "rectangle" },
});

world = addEntity(world, {
  kind: "zone",
  zone: { type: "shipping" },
  transform: { x: 0, y: 0, rotation: 0, scale: 1 },
  collision: { width: ZONE_SIZE, height: ZONE_SIZE, type: "rectangle" },
});

world = resizeSystem(world, 0);

const world$ = new BehaviorSubject<GameWorld>(world);

// Input streams
window.addEventListener("resize", () => {
  const current = world$.value;
  world$.next({
    ...current,
    global: {
      ...current.global,
      resizePending: true,
      resizeWidth: window.innerWidth,
      resizeHeight: window.innerHeight,
    },
  });
});

const handleInput = (clientX: number, clientY: number) => {
  const current = world$.value;
  world$.next({
    ...current,
    global: {
      ...current.global,
      mouseX: clientX,
      mouseY: clientY,
    },
  });
};

canvas.addEventListener("mousemove", (e) => handleInput(e.clientX, e.clientY));
canvas.addEventListener(
  "touchmove",
  (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    if (touch) handleInput(touch.clientX, touch.clientY);
  },
  { passive: false }
);

// Game Loop
const systems = [resizeSystem, inputSystem, spawningSystem, movementSystem, itemStateSystem, boxPackingSystem, zoneSystem, feedbackSystem];

createAnimationFrameDelta$().subscribe((dt) => {
  const currentWorld = world$.value;
  const newWorld = runSystems(currentWorld, dt, systems);
  world$.next(newWorld);
  scoreEl.innerText = String(newWorld.global.score);
  drawWorld(ctx, newWorld);
});
