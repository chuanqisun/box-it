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
  /** Cached box dimensions to avoid unnecessary updates */
  private cachedBoxDimensions: { width: number; height: number } | null = null;

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
    initObjectTracking(this.canvas, (id, x, y, rotation, confidence, activePoints, boundingBox, eventType) => {
      // Handle tool deactivation on "up" event
      if (eventType === "up") {
        if (id === "tool1" || id === "tool2" || id === "tool3") {
          this.deactivateTool(id);
        }
        return;
      }

      // Only process updates with reasonable confidence
      if (confidence < 0.3 || activePoints === 0) return;

      // Calculate effective rotation including the orientation offset from calibration
      const orientationOffset = boundingBox?.orientationOffset ?? 0;
      const effectiveRotation = rotation + orientationOffset;

      // For the box, we apply offset to position since it's rendered at the pointer location
      // For tools, we keep the centroid as the transform position and store offset in collision
      const xOffset = boundingBox?.xOffset ?? 0;
      const yOffset = boundingBox?.yOffset ?? 0;

      if (id === "box") {
        // Rotate offset by effective rotation to convert from local to world coordinates
        const cos = Math.cos(effectiveRotation);
        const sin = Math.sin(effectiveRotation);
        const worldOffsetX = xOffset * cos - yOffset * sin;
        const worldOffsetY = xOffset * sin + yOffset * cos;

        const adjustedX = x + worldOffsetX;
        const adjustedY = y + worldOffsetY;

        // Update box dimensions if calibrated dimensions are available
        if (boundingBox?.width && boundingBox?.height) {
          this.updateBoxDimensions(boundingBox.width, boundingBox.height);
        }
        this.handlePointerInput(adjustedX, adjustedY, effectiveRotation);
        this.startConveyor();
      }
      if (id === "tool1" || id === "tool2" || id === "tool3") {
        // For tools, position is the centroid (rotation center)
        // Offset is stored in collision and applied during rendering and collision detection
        const toolBoundingBox = boundingBox
          ? {
              width: boundingBox.width,
              height: boundingBox.height,
              xOffset: boundingBox.xOffset,
              yOffset: boundingBox.yOffset,
            }
          : undefined;
        this.updateToolState(id, x, y, effectiveRotation, toolBoundingBox);
      }
    });
  }

  /**
   * Update the box entity's collision dimensions to match calibrated values.
   * Uses caching to avoid unnecessary updates on every tracking frame.
   */
  private updateBoxDimensions(width: number, height: number): void {
    // Check cache first to avoid unnecessary entity updates
    if (this.cachedBoxDimensions?.width === width && this.cachedBoxDimensions?.height === height) {
      return;
    }

    // Update cache
    this.cachedBoxDimensions = { width, height };

    this.world
      .updateEntities((entities) =>
        entities.map((e) => {
          if (!e.box || !e.collision) return e;
          // Only update if dimensions are different
          if (e.collision.width === width && e.collision.height === height) return e;
          return {
            ...e,
            collision: {
              ...e.collision,
              width,
              height,
            },
          };
        })
      )
      .next();
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
    this.world.updateEntities((entities) => entities.map((e) => (e.pointer ? { ...e, pointer: { ...this.pointerState } } : e))).next();
  }

  /** Cached tool dimensions to avoid unnecessary updates */
  private cachedToolDimensions: Map<string, { width: number; height: number; xOffset: number; yOffset: number }> = new Map();

  /**
   * Update a tool's position, rotation, and optionally its bounding box dimensions.
   * Also sets the tool as active (isActive: true).
   */
  private updateToolState(
    toolId: "tool1" | "tool2" | "tool3",
    x: number,
    y: number,
    rotation: number,
    boundingBox?: { width: number; height: number; xOffset: number; yOffset: number }
  ): void {
    // Check if we need to update dimensions
    let needsDimensionUpdate = false;
    if (boundingBox) {
      const cached = this.cachedToolDimensions.get(toolId);
      if (
        !cached ||
        cached.width !== boundingBox.width ||
        cached.height !== boundingBox.height ||
        cached.xOffset !== boundingBox.xOffset ||
        cached.yOffset !== boundingBox.yOffset
      ) {
        this.cachedToolDimensions.set(toolId, boundingBox);
        needsDimensionUpdate = true;
      }
    }

    this.world
      .updateEntities((entities) =>
        entities.map((e) => {
          if (!e.tool || e.tool.id !== toolId || !e.transform || !e.collision) return e;

          // Transform position is the rotation center (centroid)
          const updatedEntity = {
            ...e,
            transform: {
              ...e.transform,
              x,
              y,
              rotation,
            },
            tool: {
              ...e.tool,
              isActive: true,
            },
          };

          // Update collision dimensions if needed
          if (needsDimensionUpdate && boundingBox) {
            updatedEntity.collision = {
              ...e.collision,
              width: boundingBox.width,
              height: boundingBox.height,
              xOffset: boundingBox.xOffset,
              yOffset: boundingBox.yOffset,
            };
          }

          return updatedEntity;
        })
      )
      .next();
  }

  /**
   * Deactivate a tool when touch is released.
   * Note: For tool3 (mover), the heldItemId is intentionally NOT cleared here.
   * The mover system handles the release logic when it detects isActive=false,
   * including proper item state transitions and potential score penalties.
   */
  private deactivateTool(toolId: "tool1" | "tool2" | "tool3"): void {
    this.world
      .updateEntities((entities) =>
        entities.map((e) => {
          if (!e.tool || e.tool.id !== toolId) return e;
          return {
            ...e,
            tool: {
              ...e.tool,
              isActive: false,
            },
          };
        })
      )
      .next();
  }

  /**
   * Start the conveyor belt and background music.
   */
  private startConveyor(): void {
    this.world
      .updateEntities((entities) => entities.map((e) => (e.conveyor && !e.conveyor.isActive ? { ...e, conveyor: { ...e.conveyor, isActive: true } } : e)))
      .next();
  }

  /**
   * Get current pointer state.
   */
  getPointerState(): PointerState {
    return { ...this.pointerState };
  }
}
