import { initSettings } from "./ai/settings";
import type { GameEntity, GameGlobal } from "./domain";
import { createAnimationFrameDelta$, createResizeObserver$, World } from "./engine";
import { drawWorld } from "./render";
import "./style.css";
import { boxPackingSystem } from "./systems/box-packing";
import { feedbackSystem } from "./systems/feedback";
import { inputSystem } from "./systems/input";
import { interactionSystem } from "./systems/interaction";
import { itemStateSystem } from "./systems/item-state";
import { movementSystem } from "./systems/movement";
import { resizeSystem } from "./systems/resize";
import { spawningSystem } from "./systems/spawning";
import { toolSystem } from "./systems/tool";
import { zoneSystem } from "./systems/zone";
import { initCalibrationLifecycle, initObjectTracking } from "./tracking/tracking";

const canvas = document.getElementById("gameCanvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const scoreEl = document.getElementById("score")!;
const startMenu = document.getElementById("startMenu") as HTMLDialogElement;
const startGameBtn = document.getElementById("startGame") as HTMLButtonElement;

initSettings();
initCalibrationLifecycle();

const BOX_WIDTH = 180;
const BOX_HEIGHT = 130;
const ZONE_SIZE = 200;
const TOOL_SIZE = 80;

// Initial state
const initialGlobal: GameGlobal = {
  canvasEl: canvas,
  canvas: { width: window.innerWidth, height: window.innerHeight },
};

const world = new World<GameEntity, GameGlobal>(initialGlobal)
  .addEntity({ feedback: { effects: [] } })
  .addEntity({ interactions: { rules: [] } })
  .addEntity({
    conveyor: {
      isActive: false,
      offset: 0,
      speed: 250,
      width: 300,
      length: window.innerHeight * 0.55,
    },
    spawner: { timer: 0, interval: 1000, queue: [] },
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
    pointer: { x: 0, y: 0, rotation: 0 },
  })
  .addEntity({
    tool: { id: "tool1", isColliding: false },
    transform: { x: 40, y: 40, rotation: 0, scale: 1 },
    collision: { width: TOOL_SIZE, height: TOOL_SIZE, type: "circle", radius: TOOL_SIZE / 2 },
  })
  .addEntity({
    tool: { id: "tool2", isColliding: false },
    transform: { x: window.innerWidth - TOOL_SIZE - 40, y: 40, rotation: 0, scale: 1 },
    collision: { width: TOOL_SIZE, height: TOOL_SIZE, type: "circle", radius: TOOL_SIZE / 2 },
  })
  .addEntity({
    score: { value: 600, packedCount: 0 },
  });

// Input streams
let pointerState = { x: 0, y: 0, rotation: 0 };

const updatePointerState = (next: Partial<typeof pointerState>) => {
  pointerState = { ...pointerState, ...next };
  world.updateEntities((entities) => entities.map((e) => (e.pointer ? { ...e, pointer: { ...pointerState } } : e))).next();
};

const handleInput = (clientX: number, clientY: number, rotation = pointerState.rotation) => {
  updatePointerState({ x: clientX, y: clientY, rotation });
};

const updateToolState = (toolId: "tool1" | "tool2", x: number, y: number, rotation: number) => {
  world
    .updateEntities((entities) =>
      entities.map((e) => {
        if (!e.tool || e.tool.id !== toolId || !e.transform || !e.collision) return e;
        return {
          ...e,
          transform: {
            ...e.transform,
            x: x - e.collision.width / 2,
            y: y - e.collision.height / 2,
            rotation,
          },
        };
      })
    )
    .next();
};

canvas.addEventListener("mousemove", (e) => handleInput(e.clientX, e.clientY));
canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    const rotationDelta = -e.deltaY * 0.002;
    updatePointerState({ rotation: pointerState.rotation + rotationDelta });
  },
  { passive: false }
);

const startConveyor = () => {
  world
    .updateEntities((entities) => entities.map((e) => (e.conveyor && !e.conveyor.isActive ? { ...e, conveyor: { ...e.conveyor, isActive: true } } : e)))
    .next();
};

initObjectTracking(canvas, (id, x, y, rotation) => {
  if (id === "box") {
    handleInput(x, y, rotation);
    startConveyor();
  }
  if (id === "tool1" || id === "tool2") {
    updateToolState(id, x, y, rotation);
  }
});

// Game Loop
const systems = [inputSystem, spawningSystem, movementSystem, itemStateSystem, boxPackingSystem, interactionSystem, toolSystem, zoneSystem, feedbackSystem];

startMenu.showModal();

startGameBtn.addEventListener("click", () => {
  startMenu.close();
  createAnimationFrameDelta$().subscribe((dt) => {
    world.runSystems(dt, systems).next();
    const scoreEntity = world.entities.find((e) => e.score);
    scoreEl.innerText = String(scoreEntity?.score?.value ?? 0);
    drawWorld(ctx, world);
  });
});

createResizeObserver$().subscribe(({ width, height }) => {
  resizeSystem(world, width, height);
  world.next();
});
