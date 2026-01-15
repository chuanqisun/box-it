import { BehaviorSubject } from "rxjs";
import { initSettings } from "./ai/settings";
import type { GameEntity, GameGlobal, GameWorld } from "./domain";
import { addEntity, createAnimationFrameDelta$, createResizeObserver$, createWorld, runSystems } from "./engine";
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
  feedbackEffects: [],
};

let world = createWorld<GameEntity, GameGlobal>(initialGlobal);

// Initial Entities
world = addEntity(world, {
  kind: "conveyor",
  conveyor: {
    isActive: false,
    offset: 0,
    speed: 250,
    width: 300,
    length: window.innerHeight * 0.55,
  },
  spawner: { timer: 0, interval: 1000 },
});

world = addEntity(world, {
  kind: "box",
  transform: { x: 0, y: 0, rotation: 0, scale: 1 },
  collision: { width: BOX_WIDTH, height: BOX_HEIGHT, type: "rectangle" },
  render: { emoji: "📦" },
  box: { hasBox: false },
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

world = addEntity(world, {
  kind: "pointer",
  pointer: { x: 0, y: 0 },
});

world = addEntity(world, {
  kind: "score",
  score: { value: 600, packedCount: 0 },
});

const world$ = new BehaviorSubject<GameWorld>(world);

// Input streams
const handleInput = (clientX: number, clientY: number) => {
  const current = world$.value;
  world$.next({
    ...current,
    entities: current.entities.map((e) => (e.kind === "pointer" && e.pointer ? { ...e, pointer: { ...e.pointer, x: clientX, y: clientY } } : e)),
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
const systems = [inputSystem, spawningSystem, movementSystem, itemStateSystem, boxPackingSystem, zoneSystem, feedbackSystem];

createAnimationFrameDelta$().subscribe((dt) => {
  const currentWorld = world$.value;
  const newWorld = runSystems(currentWorld, dt, systems);
  world$.next(newWorld);
  const scoreEntity = newWorld.entities.find((e) => e.kind === "score");
  scoreEl.innerText = String(scoreEntity?.score?.value ?? 0);
  drawWorld(ctx, newWorld);
});

createResizeObserver$().subscribe(({ width, height }) => {
  const current = world$.value;
  const resizedWorld = resizeSystem(current, width, height);
  world$.next(resizedWorld);
});
