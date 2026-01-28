/**
 * Main Application Entry Point
 *
 * This file is focused on:
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
 */

import { initSettings } from "./ai/settings";
import { initBackgroundMusic, preloadSounds, startBackgroundMusic } from "./audio";
import { createResizeObserver$ } from "./engine";
import { createGameWorld, resetGameWorld } from "./game-init";
import { GameLoop } from "./game-loop";
import { InputHandler } from "./input-handler";
import "./style.css";

// Systems
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
import { initCalibrationLifecycle } from "./tracking/tracking";

// ============================================================================
// DOM Elements
// ============================================================================

const canvas = document.getElementById("gameCanvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const scoreEl = document.getElementById("score")!;
const timeLeftEl = document.getElementById("timeLeft")!;
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
initBackgroundMusic();

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
 * 4. State changes (item state, box packing)
 * 5. Tool interactions
 * 6. Interactions
 * 7. Zone actions
 * 8. Visual feedback
 * 9. Game state evaluation
 */
const systems = [
  inputSystem,
  spawningSystem,
  movementSystem,
  itemStateSystem,
  boxPackingSystem,
  toolSystem,
  interactionSystem,
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
  onTimeUpdate: (timeRemainingMs) => {
    const secondsRemaining = Math.ceil(timeRemainingMs / 1000);
    timeLeftEl.textContent = String(secondsRemaining);
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
    endGameMessage.textContent = "Time's up! Thanks for working the shift.";
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
  const gameState = world.entities.find((e) => e.gameState)?.gameState;
  if (gameState) {
    timeLeftEl.textContent = String(Math.ceil(gameState.timeRemainingMs / 1000));
  }
  gameLoop.start();
}

// ============================================================================
// Event Listeners
// ============================================================================

startMenu.showModal();

startGameBtn.addEventListener("click", () => {
  startMenu.close();
  // Preload sounds on first user interaction (browser autoplay policy)
  preloadSounds();
  startBackgroundMusic();
  startGame();
});

restartGameBtn.addEventListener("click", () => {
  endGameMenu.close();
  startGame();
});

// Handle window resize
createResizeObserver$().subscribe(({ width, height }) => {
  resizeSystem(world, width, height);
  world.next();
});
