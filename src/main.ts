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
import { setSelectedTheme, PREDEFINED_THEMES } from "./ai/themes";
import { initBackgroundMusic, preloadSounds, startBackgroundMusic } from "./audio";
import { createResizeObserver$ } from "./engine";
import { createGameWorld, resetGameWorld } from "./game-init";
import { GameLoop } from "./game-loop";
import { getHighScores, isHighScore, saveHighScore, type HighScoreEntry } from "./high-scores";
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
import { moverSystem } from "./systems/mover";
import { resizeSystem } from "./systems/resize";
import { spawningSystem, resetGenerationState } from "./systems/spawning";
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
const highScoresList = document.getElementById("highScoresList")!;
const nameInputSection = document.getElementById("nameInputSection")!;
const playerNameInput = document.getElementById("playerNameInput") as HTMLInputElement;
const saveHighScoreBtn = document.getElementById("saveHighScore") as HTMLButtonElement;
const customThemeRadio = document.getElementById("customThemeRadio") as HTMLInputElement;
const customThemeInput = document.getElementById("customThemeInput") as HTMLInputElement;
const themeRadios = document.querySelectorAll<HTMLInputElement>('input[name="theme"]');

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
 * 6. Mover tool
 * 7. Interactions
 * 8. Zone actions
 * 9. Visual feedback
 * 10. Game state evaluation
 */
const systems = [
  inputSystem,
  spawningSystem,
  movementSystem,
  itemStateSystem,
  boxPackingSystem,
  toolSystem,
  moverSystem,
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

// Store current score for saving high score
let currentGameScore = 0;

function renderHighScoresList(highScores: HighScoreEntry[], currentScore?: number): void {
  if (highScores.length === 0) {
    highScoresList.innerHTML = '<div class="high-scores-empty">No high scores yet!</div>';
    return;
  }

  highScoresList.innerHTML = highScores
    .map((entry, index) => {
      const isCurrentScore = currentScore !== undefined && entry.score === currentScore;
      return `
        <div class="high-score-entry ${isCurrentScore ? "current-score" : ""}">
          <span class="high-score-rank">#${index + 1}</span>
          <span class="high-score-name">${escapeHtml(entry.name)}</span>
          <span class="high-score-value">$${entry.score}</span>
        </div>
      `;
    })
    .join("");
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

async function showEndGameScreen(status: "won" | "lost", score: number, itemsProcessed: number): Promise<void> {
  currentGameScore = score;

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

  // Load and display high scores
  const highScores = await getHighScores();
  renderHighScoresList(highScores);

  // Check if this is a new high score
  const qualifiesForHighScore = await isHighScore(score);
  if (qualifiesForHighScore) {
    nameInputSection.classList.remove("hidden");
    playerNameInput.value = "";
    saveHighScoreBtn.disabled = false;
    playerNameInput.focus();
  } else {
    nameInputSection.classList.add("hidden");
  }

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

startMenu.show();

// Handle theme radio button changes
themeRadios.forEach((radio) => {
  radio.addEventListener("change", () => {
    if (customThemeRadio.checked) {
      customThemeInput.classList.remove("hidden");
      customThemeInput.focus();
    } else {
      customThemeInput.classList.add("hidden");
    }
  });
});

function getSelectedThemeValue(): string {
  const selectedRadio = document.querySelector<HTMLInputElement>('input[name="theme"]:checked');
  if (selectedRadio?.value === "custom") {
    return customThemeInput.value.trim() || PREDEFINED_THEMES[0].label;
  }
  return selectedRadio?.value || PREDEFINED_THEMES[0].label;
}

startGameBtn.addEventListener("click", () => {
  const selectedTheme = getSelectedThemeValue();
  setSelectedTheme(selectedTheme);
  startMenu.close();
  // Preload sounds on first user interaction (browser autoplay policy)
  preloadSounds();
  startBackgroundMusic();
  startGame();
});

restartGameBtn.addEventListener("click", () => {
  endGameMenu.close();
  // Reset generation state so new theme can be used
  resetGenerationState();
  // Show theme selection menu instead of restarting directly
  startMenu.show();
});

// High score save handler
let isSavingHighScore = false;

async function handleSaveHighScore(): Promise<void> {
  if (isSavingHighScore) return;
  isSavingHighScore = true;
  saveHighScoreBtn.disabled = true;

  try {
    const name = playerNameInput.value.trim();
    const updatedScores = await saveHighScore(name, currentGameScore);
    renderHighScoresList(updatedScores, currentGameScore);
    nameInputSection.classList.add("hidden");
  } finally {
    isSavingHighScore = false;
  }
}

saveHighScoreBtn.addEventListener("click", handleSaveHighScore);

// Allow Enter key to submit high score
playerNameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    handleSaveHighScore();
  }
});

// Handle window resize
createResizeObserver$().subscribe(({ width, height }) => {
  resizeSystem(world, width, height);
  world.next();
});
