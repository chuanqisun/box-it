import { BehaviorSubject, animationFrameScheduler, interval } from "rxjs";
import { map } from "rxjs/operators";
import type { GameEntity, GameGlobal, GameWorld } from "./domain";
import { addEntity, createWorld, runSystems } from "./engine";
import { drawWorld } from "./render";
import "./style.css";

// Systems
import { boxPackingSystem } from "./systems/boxPackingSystem";
import { feedbackSystem } from "./systems/feedbackSystem";
import { inputSystem } from "./systems/inputSystem";
import { itemStateSystem } from "./systems/itemStateSystem";
import { movementSystem } from "./systems/movementSystem";
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

// Update initial positions based on resize logic
function getResizedWorld(w: GameWorld): GameWorld {
  const width = window.innerWidth;
  const height = window.innerHeight;
  canvas.width = width;
  canvas.height = height;

  const conveyorWidth = Math.min(350, width * 0.4);
  const conveyorLength = height * 0.55;

  return {
    ...w,
    global: {
      ...w.global,
      canvas: { width, height },
      conveyor: { width: conveyorWidth, length: conveyorLength },
    },
    entities: w.entities.map((e) => {
      if (e.kind === "box" && e.transform && e.collision) {
        if (e.transform.x === 0 && e.transform.y === 0) {
          return {
            ...e,
            transform: {
              ...e.transform,
              x: width / 2 - e.collision.width / 2,
              y: height - e.collision.height - 50,
            },
          };
        }
      }
      if (e.kind === "zone" && e.transform && e.collision && e.zone) {
        if (e.zone.type === "restock") {
          return { ...e, transform: { ...e.transform, x: 0, y: height - ZONE_SIZE } };
        }
        if (e.zone.type === "shipping") {
          return { ...e, transform: { ...e.transform, x: width - ZONE_SIZE, y: height - ZONE_SIZE } };
        }
      }
      return e;
    }),
  };
}

world = getResizedWorld(world);

const world$ = new BehaviorSubject<GameWorld>(world);

// Input streams
window.addEventListener("resize", () => {
  world$.next(getResizedWorld(world$.value));
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
const systems = [inputSystem, spawningSystem, movementSystem, itemStateSystem, boxPackingSystem, zoneSystem, feedbackSystem];

let lastTime = performance.now();

interval(0, animationFrameScheduler)
  .pipe(
    map(() => {
      const now = performance.now();
      const dt = now - lastTime;
      lastTime = now;
      return dt;
    })
  )
  .subscribe((dt) => {
    const currentWorld = world$.value;
    const newWorld = runSystems(currentWorld, dt, systems);
    world$.next(newWorld);
    scoreEl.innerText = String(newWorld.global.score);
    drawWorld(ctx, newWorld);
  });
