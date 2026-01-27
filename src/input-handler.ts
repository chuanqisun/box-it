/**
 * Input Handler Module
 *
 * This module manages all input handling for the game including:
 * - Mouse/touch input
 * - Physical object tracking
 * - Pointer state management
 */

import type { GameEntity, GameGlobal } from "./domain";
import type { World } from "./engine";
import { initObjectTracking } from "./tracking/tracking";

export interface PointerState {
  x: number;
  y: number;
  rotation: number;
}

export class InputHandler {
  private world: World<GameEntity, GameGlobal>;
  private canvas: HTMLCanvasElement;
  private pointerState: PointerState = { x: 0, y: 0, rotation: 0 };

  constructor(world: World<GameEntity, GameGlobal>, canvas: HTMLCanvasElement) {
    this.world = world;
    this.canvas = canvas;
  }

  /**
   * Initialize all input listeners.
   */
  init(): void {
    this.setupMouseListeners();
    this.setupObjectTracking();
  }

  /**
   * Set up mouse/touch event listeners.
   */
  private setupMouseListeners(): void {
    this.canvas.addEventListener("mousemove", (e) => {
      // Convert from window-based clientX/clientY to element-based coordinates
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      this.handlePointerInput(x, y);
    });

    this.canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const rotationDelta = -e.deltaY * 0.002;
        this.updatePointerState({ rotation: this.pointerState.rotation + rotationDelta });
      },
      { passive: false }
    );
  }

  /**
   * Set up physical object tracking.
   */
  private setupObjectTracking(): void {
    initObjectTracking(this.canvas, (id, x, y, rotation, confidence, activePoints) => {
      // Only process updates with reasonable confidence
      if (confidence < 0.3 || activePoints === 0) return;

      if (id === "box") {
        this.handlePointerInput(x, y, rotation);
        this.startConveyor();
      }
      if (id === "tool1" || id === "tool2") {
        this.updateToolState(id, x, y, rotation);
      }
    });
  }

  /**
   * Handle pointer input (mouse or tracked object).
   */
  handlePointerInput(clientX: number, clientY: number, rotation = this.pointerState.rotation): void {
    this.updatePointerState({ x: clientX, y: clientY, rotation });
  }

  /**
   * Update the pointer state and sync with world.
   */
  private updatePointerState(next: Partial<PointerState>): void {
    this.pointerState = { ...this.pointerState, ...next };
    this.world
      .updateEntities((entities) =>
        entities.map((e) => (e.pointer ? { ...e, pointer: { ...this.pointerState } } : e))
      )
      .next();
  }

  /**
   * Update a tool's position and rotation.
   */
  private updateToolState(toolId: "tool1" | "tool2", x: number, y: number, rotation: number): void {
    this.world
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
  }

  /**
   * Start the conveyor belt.
   */
  private startConveyor(): void {
    this.world
      .updateEntities((entities) =>
        entities.map((e) =>
          e.conveyor && !e.conveyor.isActive
            ? { ...e, conveyor: { ...e.conveyor, isActive: true } }
            : e
        )
      )
      .next();
  }

  /**
   * Get current pointer state.
   */
  getPointerState(): PointerState {
    return { ...this.pointerState };
  }
}
