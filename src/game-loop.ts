/**
 * Game Loop Module
 *
 * This module manages the game loop lifecycle including:
 * - Starting and stopping the game
 * - Running systems each frame
 * - Detecting game end conditions
 * - Managing subscriptions
 */

import { Subscription } from "rxjs";
import type { GameEntity, GameGlobal } from "./domain";
import type { System, World } from "./engine";
import { createAnimationFrameDelta$ } from "./engine";
import { drawWorld } from "./render";

export interface GameLoopCallbacks {
  onScoreUpdate: (score: number) => void;
  onTimeUpdate: (timeRemainingMs: number, durationMs: number) => void;
  onGameEnd: (status: "won" | "lost", score: number, itemsProcessed: number) => void;
}

export class GameLoop {
  private subscription: Subscription | null = null;
  private lastGameStatus: "playing" | "won" | "lost" = "playing";
  private world: World<GameEntity, GameGlobal>;
  private ctx: CanvasRenderingContext2D;
  private systems: System<GameEntity, GameGlobal>[];
  private callbacks: GameLoopCallbacks;

  constructor(world: World<GameEntity, GameGlobal>, ctx: CanvasRenderingContext2D, systems: System<GameEntity, GameGlobal>[], callbacks: GameLoopCallbacks) {
    this.world = world;
    this.ctx = ctx;
    this.systems = systems;
    this.callbacks = callbacks;
  }

  /**
   * Start the game loop.
   */
  start(): void {
    this.lastGameStatus = "playing";

    // Cancel existing subscription if any
    this.stop();

    this.subscription = createAnimationFrameDelta$().subscribe((dt) => {
      this.tick(dt);
    });
  }

  /**
   * Stop the game loop.
   */
  stop(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
  }

  /**
   * Process a single game tick.
   */
  private tick(deltaTime: number): void {
    const gameStateEntity = this.world.entities.find((e) => e.gameState);
    const currentStatus = gameStateEntity?.gameState?.status ?? "playing";

    // Check if game just ended
    if (currentStatus !== "playing" && this.lastGameStatus === "playing") {
      this.lastGameStatus = currentStatus;
      const scoreEntity = this.world.entities.find((e) => e.score);
      const score = scoreEntity?.score?.value ?? 0;
      const itemsProcessed = gameStateEntity?.gameState?.itemsProcessed ?? 0;

      // Delay end screen to let player see final state
      setTimeout(() => {
        this.callbacks.onGameEnd(currentStatus, score, itemsProcessed);
      }, 500);

      return;
    }

    // Run game systems if still playing
    if (currentStatus === "playing") {
      this.world.runSystems(deltaTime, this.systems).next();

      // Update score display
      const scoreEntity = this.world.entities.find((e) => e.score);
      this.callbacks.onScoreUpdate(scoreEntity?.score?.value ?? 0);

      // Update timer display
      const updatedGameState = this.world.entities.find((e) => e.gameState)?.gameState;
      if (updatedGameState) {
        this.callbacks.onTimeUpdate(updatedGameState.timeRemainingMs, updatedGameState.durationMs);
      }
    }

    // Always render the world
    drawWorld(this.ctx, this.world);
  }

  /**
   * Check if the game loop is running.
   */
  isRunning(): boolean {
    return this.subscription !== null;
  }
}
