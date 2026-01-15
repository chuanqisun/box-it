import { initSettings } from "./ai/settings";
import type { GameEntity, GameGlobal } from "./domain";
import { createAnimationFrameDelta$, createResizeObserver$, World } from "./engine";
import { drawWorld } from "./render";
import "./style.css";
import { boxPackingSystem } from "./systems/box-packing";
import { feedbackSystem } from "./systems/feedback";
import { inputSystem } from "./systems/input";
import { itemStateSystem } from "./systems/item-state";
import { movementSystem } from "./systems/movement";
import { resizeSystem } from "./systems/resize";
import { spawningSystem } from "./systems/spawning";
import { zoneSystem } from "./systems/zone";

const canvas = document.getElementById("gameCanvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const scoreEl = document.getElementById("score")!;

initSettings();

const BOX_WIDTH = 180;
const BOX_HEIGHT = 130;
const ZONE_SIZE = 200;

// Initial state
const initialGlobal: GameGlobal = {
  canvasEl: canvas,
  canvas: { width: window.innerWidth, height: window.innerHeight },
};

const world = new World<GameEntity, GameGlobal>(initialGlobal)
  .addEntity({ feedback: { effects: [] } })
  .addEntity({
    conveyor: {
      isActive: false,
      offset: 0,
      speed: 250,
      width: 300,
      length: window.innerHeight * 0.55,
    },
    spawner: { timer: 0, interval: 1000 },
  })
  .addEntity({
    transform: { x: 0, y: 0, rotation: 0, scale: 1 },
    collision: { width: BOX_WIDTH, height: BOX_HEIGHT, type: "rectangle" },
    render: { emoji: "📦" },
    box: { hasBox: false },
  })
  .addEntity({
    zone: { type: "restock" },
    transform: { x: 0, y: 0, rotation: 0, scale: 1 },
    collision: { width: ZONE_SIZE, height: ZONE_SIZE, type: "rectangle" },
  })
  .addEntity({
    zone: { type: "shipping" },
    transform: { x: 0, y: 0, rotation: 0, scale: 1 },
    collision: { width: ZONE_SIZE, height: ZONE_SIZE, type: "rectangle" },
  })
  .addEntity({
    pointer: { x: 0, y: 0 },
  })
  .addEntity({
    score: { value: 600, packedCount: 0 },
  });

// Input streams
const handleInput = (clientX: number, clientY: number) => {
  world.updateEntities((entities) => entities.map((e) => (e.pointer ? { ...e, pointer: { ...e.pointer, x: clientX, y: clientY } } : e))).next();
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
const systems = [inputSystem, spawningSystem, movementSystem, itemStateSystem, boxPackingSystem, zoneSystem, feedbackSystem];

createAnimationFrameDelta$().subscribe((dt) => {
  world.runSystems(dt, systems).next();
  const scoreEntity = world.entities.find((e) => e.score);
  scoreEl.innerText = String(scoreEntity?.score?.value ?? 0);
  drawWorld(ctx, world);
});

createResizeObserver$().subscribe(({ width, height }) => {
  resizeSystem(world, width, height);
  world.next();
});
