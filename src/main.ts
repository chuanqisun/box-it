/**
 * Main Application Entry Point
 *
 * This file is now focused solely on:
 * - DOM element references
 * - Module initialization
 * - UI event handling
 *
 * Game logic is organized into:
 * - game-init.ts: World creation and reset
 * - game-loop.ts: Game loop management
 * - input-handler.ts: Input handling
 * - systems/: Individual ECS systems
 * - entities/: Entity factories
 * - utils/: Shared utilities
 */

import { initSettings } from "./ai/settings";
import { createGameWorld, resetGameWorld } from "./game-init";
import { GameLoop } from "./game-loop";
import { InputHandler } from "./input-handler";
import { createResizeObserver$ } from "./engine";
import "./style.css";

// Systems
import { boxPackingSystem } from "./systems/box-packing";
import { collisionEventSystem } from "./systems/collision";
import { feedbackSystem } from "./systems/feedback";
import { gameStateSystem } from "./systems/game-state";
import { inputSystem } from "./systems/input";
import { interactionSystem } from "./systems/interaction";
import { itemStateSystem } from "./systems/item-state";
import { movementSystem } from "./systems/movement";
import { resizeSystem } from "./systems/resize";
import { spawningSystem } from "./systems/spawning";
import { toolEffectSystem } from "./systems/tool-effect";
import { zoneSystem } from "./systems/zone";
import { initCalibrationLifecycle } from "./tracking/tracking";

// ============================================================================
// DOM Elements
// ============================================================================

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

// ============================================================================
// Initialization
// ============================================================================

// Initialize settings and calibration
initSettings();
initCalibrationLifecycle();

// Create game world
const world = createGameWorld({ canvas });

// Set up input handling
const inputHandler = new InputHandler(world, canvas);
inputHandler.init();

// ============================================================================
// Systems Configuration
// ============================================================================

/**
 * Systems are organized in execution order:
 * 1. Input processing
 * 2. Spawning new entities
 * 3. Movement and physics
 * 4. Collision detection
 * 5. State changes (item state, box packing)
 * 6. Interactions and effects
 * 7. Tool effects (responds to collisions)
 * 8. Zone actions
 * 9. Visual feedback
 * 10. Game state evaluation
 */
const systems = [
  inputSystem,
  spawningSystem,
  movementSystem,
  collisionEventSystem,  // Detect collisions first
  itemStateSystem,
  boxPackingSystem,
  interactionSystem,
  toolEffectSystem,      // Apply tool effects after collision detection
  zoneSystem,
  feedbackSystem,
  gameStateSystem,
];

// ============================================================================
// Game Loop
// ============================================================================

const gameLoop = new GameLoop(world, ctx, systems, {
  onScoreUpdate: (score) => {
    scoreEl.innerText = String(score);
  },
  onGameEnd: (status, score, itemsProcessed) => {
    showEndGameScreen(status, score, itemsProcessed);
  },
});

// ============================================================================
// UI Functions
// ============================================================================

function showEndGameScreen(status: "won" | "lost", score: number, itemsProcessed: number): void {
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

function startGame(): void {
  resetGameWorld(world);
  gameLoop.start();
}

// ============================================================================
// Event Listeners
// ============================================================================

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

// Handle window resize
createResizeObserver$().subscribe(({ width, height }) => {
  resizeSystem(world, width, height);
  world.next();
});
