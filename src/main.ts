import { initSettings } from "./ai/settings";
import type { GameEntity, GameGlobal } from "./domain";
import { createAnimationFrameDelta$, createResizeObserver$, World } from "./engine";
import { drawWorld } from "./render";
import "./style.css";
import { boxPackingSystem } from "./systems/box-packing";
import { feedbackSystem } from "./systems/feedback";
import { gameStateSystem } from "./systems/game-state";
import { inputSystem } from "./systems/input";
import { interactionSystem } from "./systems/interaction";
import { itemStateSystem } from "./systems/item-state";
import { movementSystem } from "./systems/movement";
import { resizeSystem } from "./systems/resize";
import { spawningSystem } from "./systems/spawning";
import { toolSystem } from "./systems/tool";
import { zoneSystem } from "./systems/zone";
import { initCalibrationLifecycle, initObjectTracking } from "./tracking/tracking";
import { Subscription } from "rxjs";

const canvas = document.getElementById("gameCanvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const scoreEl = document.getElementById("score")!;
const startMenu = document.getElementById("startMenu") as HTMLDialogElement;
const startGameBtn = document.getElementById("startGame") as HTMLButtonElement;
const endGameMenu = document.getElementById("endGameMenu") as HTMLDialogElement;
const endGameTitle = document.getElementById("endGameTitle")!;
const endGameMessage = document.getElementById("endGameMessage")!;
const finalScoreEl = document.getElementById("finalScore")!;
const itemsProcessedEl = document.getElementById("itemsProcessed")!;
const restartGameBtn = document.getElementById("restartGame") as HTMLButtonElement;

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
  })
  .addEntity({
    gameState: { status: "playing", totalItemsSpawned: 0, itemsProcessed: 0 },
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

initObjectTracking(canvas, (id, x, y, rotation, confidence, activePoints) => {
  // Only process updates with reasonable confidence (at least 1 active point)
  if (confidence < 0.3 || activePoints === 0) return;

  if (id === "box") {
    handleInput(x, y, rotation);
    startConveyor();
  }
  if (id === "tool1" || id === "tool2") {
    updateToolState(id, x, y, rotation);
  }
});

// Game Loop
const systems = [inputSystem, spawningSystem, movementSystem, itemStateSystem, boxPackingSystem, interactionSystem, toolSystem, zoneSystem, feedbackSystem, gameStateSystem];

let gameLoopSubscription: Subscription | null = null;
let lastGameStatus: "playing" | "won" | "lost" = "playing";

function showEndGameScreen(status: "won" | "lost", score: number, itemsProcessed: number) {
  endGameMenu.classList.remove("won", "lost");
  endGameMenu.classList.add(status);

  if (status === "won") {
    endGameTitle.textContent = "🎉 Shift Complete!";
    endGameMessage.textContent = "Great job! You processed all the items!";
  } else {
    endGameTitle.textContent = "💸 Bankrupt!";
    endGameMessage.textContent = "You ran out of funds and couldn't afford a new box.";
  }

  finalScoreEl.textContent = `$${score}`;
  itemsProcessedEl.textContent = String(itemsProcessed);
  endGameMenu.showModal();
}

function startGame() {
  // Reset game state
  world.updateEntities((entities) =>
    entities.map((e) => {
      if (e.gameState) {
        return { ...e, gameState: { status: "playing" as const, totalItemsSpawned: 0, itemsProcessed: 0 } };
      }
      if (e.score) {
        return { ...e, score: { value: 600, packedCount: 0 } };
      }
      if (e.box) {
        return { ...e, box: { hasBox: false } };
      }
      if (e.conveyor) {
        return { ...e, conveyor: { ...e.conveyor, isActive: false, offset: 0 } };
      }
      if (e.spawner) {
        return { ...e, spawner: { ...e.spawner, timer: 0, queue: [] } };
      }
      if (e.feedback) {
        return { ...e, feedback: { effects: [] } };
      }
      if (e.interactions) {
        return { ...e, interactions: { rules: [] } };
      }
      return e;
    })
  );

  // Remove all items
  const itemsToRemove = world.entities.filter((e) => e.itemState || e.boxAnchor);
  itemsToRemove.forEach((item) => world.removeEntity(item.id));

  lastGameStatus = "playing";

  // Cancel existing subscription if any
  if (gameLoopSubscription) {
    gameLoopSubscription.unsubscribe();
  }

  gameLoopSubscription = createAnimationFrameDelta$().subscribe((dt) => {
    const gameStateEntity = world.entities.find((e) => e.gameState);
    const currentStatus = gameStateEntity?.gameState?.status ?? "playing";

    // Check if game just ended
    if (currentStatus !== "playing" && lastGameStatus === "playing") {
      lastGameStatus = currentStatus;
      const scoreEntity = world.entities.find((e) => e.score);
      const score = scoreEntity?.score?.value ?? 0;
      const itemsProcessed = gameStateEntity?.gameState?.itemsProcessed ?? 0;

      // Stop the game loop and show end screen
      setTimeout(() => {
        showEndGameScreen(currentStatus, score, itemsProcessed);
      }, 500); // Small delay to let the player see the final state

      return;
    }

    if (currentStatus === "playing") {
      world.runSystems(dt, systems).next();
      const scoreEntity = world.entities.find((e) => e.score);
      scoreEl.innerText = String(scoreEntity?.score?.value ?? 0);
    }

    drawWorld(ctx, world);
  });
}

startMenu.showModal();

startGameBtn.addEventListener("click", () => {
  startMenu.close();
  startGame();
});

restartGameBtn.addEventListener("click", () => {
  endGameMenu.close();
  // Reload the page for a clean restart (clears AI generation state)
  window.location.reload();
});

createResizeObserver$().subscribe(({ width, height }) => {
  resizeSystem(world, width, height);
  world.next();
});
