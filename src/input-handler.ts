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
    initObjectTracking(this.canvas, (id, x, y, rotation, confidence, activePoints, boundingBox) => {
      // Only process updates with reasonable confidence
      if (confidence < 0.3 || activePoints === 0) return;

      // Calculate effective rotation including the orientation offset from calibration
      const orientationOffset = boundingBox?.orientationOffset ?? 0;
      const effectiveRotation = rotation + orientationOffset;

      // Apply offset from bounding box configuration in local (rotated) coordinates
      // The offset is defined relative to the object's orientation, so we need to
      // rotate it by the effective rotation to get the world-space offset
      const xOffset = boundingBox?.xOffset ?? 0;
      const yOffset = boundingBox?.yOffset ?? 0;
      
      // Rotate offset by effective rotation to convert from local to world coordinates
      const cos = Math.cos(effectiveRotation);
      const sin = Math.sin(effectiveRotation);
      const worldOffsetX = xOffset * cos - yOffset * sin;
      const worldOffsetY = xOffset * sin + yOffset * cos;
      
      const adjustedX = x + worldOffsetX;
      const adjustedY = y + worldOffsetY;

      if (id === "box") {
        this.handlePointerInput(adjustedX, adjustedY, effectiveRotation);
        this.startConveyor();
      }
      if (id === "tool1" || id === "tool2") {
        this.updateToolState(id, adjustedX, adjustedY, effectiveRotation);
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
