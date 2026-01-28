import { del, set } from "idb-keyval";
import { html, render } from "lit-html";
import { Subscription, distinctUntilChanged, exhaustMap, filter, finalize, map, share, takeUntil, tap, timer } from "rxjs";
import { getInputRawEvent$ } from "./input";
import { getCentroid as getGeoCentroid, getCanonicalRotation } from "./geometry";

/**
 * Extended object signature with bounding box properties.
 * Supports customizable width, height, offset, and orientation for the visual/collision representation.
 */
export interface ObjectSignature {
  id: string;
  /** Lengths of the 3 sides of the touch triangle, sorted in ascending order */
  sides: [number, number, number];
  /** Bounding box dimensions and orientation (optional, for visual/collision purposes) */
  boundingBox?: {
    /** Width of the bounding box (in pixels or arbitrary units) */
    width: number;
    /** Height (length) of the bounding box */
    height: number;
    /** X offset from centroid in local coordinates (applied in the rotated coordinate frame) */
    xOffset: number;
    /** Y offset from centroid in local coordinates (applied in the rotated coordinate frame) */
    yOffset: number;
    /** Rotation offset in radians from the longest edge of the triangle */
    orientationOffset: number;
  };
}

interface TouchPoint {
  id: number;
  x: number;
  y: number;
}

export const CALIBRATION_OBJECT_IDS = ["box", "tool1", "tool2"];

const OBJECT_DISPLAY_NAMES: Record<string, string> = {
  box: "box",
  tool1: "tape",
  tool2: "iron",
};

/** Get display name for an object ID */
function getObjectDisplayName(objectId: string): string {
  return OBJECT_DISPLAY_NAMES[objectId] || objectId;
}

/**
 * Default calibration presets for each object.
 * These are used when there is no calibration data and at the beginning of calibration.
 * Sides are the lengths of the 3 sides of the touch triangle in ascending order.
 */
export interface CalibrationPreset {
  sides: [number, number, number];
  width: number;
  height: number;
  orientationDegrees: number;
  xOffset: number;
  yOffset: number;
}

export const DEFAULT_CALIBRATION_PRESETS: Record<string, CalibrationPreset> = {
  box: { sides: [230, 384, 450], width: 400, height: 280, orientationDegrees: 32, xOffset: -63, yOffset: -39 },
  tool1: { sides: [85, 181, 209], width: 270, height: 130, orientationDegrees: 171, xOffset: -24, yOffset: 7 },
  tool2: { sides: [100, 150, 200], width: 200, height: 200, orientationDegrees: 0, xOffset: 0, yOffset: 0 },
};

/** Get default bounding box config for a specific object */
function getDefaultBoundingBoxConfig(objectId: string) {
  const preset = DEFAULT_CALIBRATION_PRESETS[objectId];
  if (preset) {
    return {
      width: preset.width,
      height: preset.height,
      xOffset: preset.xOffset,
      yOffset: preset.yOffset,
      orientationDegrees: preset.orientationDegrees,
    };
  }
  // Fallback defaults
  return { width: 180, height: 130, xOffset: 0, yOffset: 0, orientationDegrees: 0 };
}

export class CalibrationElement extends HTMLElement {
  static define() {
    if (customElements.get("calibration-element")) return;
    customElements.define("calibration-element", CalibrationElement);
  }

  private objectIds = CALIBRATION_OBJECT_IDS;
  private currentObjectIndex = 0;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private touchPoints: Map<number, TouchPoint> = new Map();
  private isCalibrating = false;
  private calibrationStartTime = 0;
  private sidesMeasurements: number[][] = [[], [], []]; // [side1[], side2[], side3[]]
  private subscription?: Subscription;
  private waitingForClear = false; // waiting for all touches to be removed before next calibration
  /** Current phase of calibration: 'preview' for real-time preview, 'touch' for 3-point calibration, 'boundingBox' for dimensions */
  private calibrationPhase: "preview" | "touch" | "boundingBox" = "preview";
  /** Temporary storage for current object's touch signature before bounding box configuration */
  private currentSignature: ObjectSignature | null = null;
  /** Current bounding box values being configured - initialized with first object defaults */
  private boundingBoxConfig = getDefaultBoundingBoxConfig(CALIBRATION_OBJECT_IDS[0]);

  connectedCallback() {
    this.#clearPreviousResults();
    // Start with preview phase for all objects
    this.calibrationPhase = "preview";
    this.#render();
    this.#setupCanvas();
    this.#setupInput();
  }

  async #clearPreviousResults() {
    for (const id of this.objectIds) {
      await del(`object-signature-${id}`);
    }
  }

  disconnectedCallback() {
    this.subscription?.unsubscribe();
  }

  #setupCanvas() {
    this.canvas = this.querySelector("canvas")!;
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext("2d")!;

    // Set canvas size to match viewport
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;

    // Start rendering loop
    this.#renderLoop();
  }

  #setupInput() {
    if (!this.canvas) return;
    const input$ = getInputRawEvent$(this.canvas);

    const touchCount$ = input$.pipe(
      tap((event) => {
        event.preventDefault();

        const rect = this.canvas!.getBoundingClientRect();

        if (event.type === "touchstart" || event.type === "touchmove") {
          // Calculate scale factors to convert CSS coordinates to canvas internal coordinates
          const scaleX = this.canvas!.width / rect.width;
          const scaleY = this.canvas!.height / rect.height;

          // Update all current touches
          for (let i = 0; i < event.touches.length; i++) {
            const touch = event.touches[i];
            this.touchPoints.set(touch.identifier, {
              id: touch.identifier,
              x: (touch.clientX - rect.left) * scaleX,
              y: (touch.clientY - rect.top) * scaleY,
            });
          }
        } else if (event.type === "touchend") {
          // Remove ended touches
          for (let i = 0; i < event.changedTouches.length; i++) {
            const touch = event.changedTouches[i];
            this.touchPoints.delete(touch.identifier);
          }
        }

        if (this.isCalibrating && this.touchPoints.size === 3 && this.calibrationPhase === "touch") {
          this.#recordMeasurement();
        }

        // Reset waitingForClear when all touches are removed
        if (this.waitingForClear && this.touchPoints.size === 0) {
          this.waitingForClear = false;
        }
      }),
      map(() => this.touchPoints.size),
      distinctUntilChanged(),
      share()
    );

    this.subscription = touchCount$
      .pipe(
        filter((count) => count === 3 && !this.waitingForClear && this.calibrationPhase === "touch"),
        exhaustMap(() => {
          this.#startCalibration();

          const touchCountChanged$ = touchCount$.pipe(filter((count) => count !== 3));

          return timer(2000).pipe(
            takeUntil(touchCountChanged$),
            tap(() => {
              this.waitingForClear = true;
              this.#finishTouchCalibration();
            }),
            finalize(() => {
              if (this.isCalibrating) {
                this.isCalibrating = false;
                this.sidesMeasurements = [[], [], []];
              }
            })
          );
        })
      )
      .subscribe();
  }

  #startCalibration() {
    this.isCalibrating = true;
    this.calibrationStartTime = Date.now();
    this.sidesMeasurements = [[], [], []];
  }

  #recordMeasurement() {
    const points = Array.from(this.touchPoints.values());
    const sides = this.#calculateSides(points);

    this.sidesMeasurements[0].push(sides[0]);
    this.sidesMeasurements[1].push(sides[1]);
    this.sidesMeasurements[2].push(sides[2]);
  }

  #calculateSides(points: TouchPoint[]): [number, number, number] {
    // Calculate distances between all pairs
    const d01 = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
    const d12 = Math.hypot(points[1].x - points[2].x, points[1].y - points[2].y);
    const d20 = Math.hypot(points[2].x - points[0].x, points[2].y - points[0].y);

    // Sort sides in ascending order
    const sides = [d01, d12, d20].sort((a, b) => a - b);
    return [sides[0], sides[1], sides[2]];
  }

  #calculateAverage(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /** Called after 3-point touch calibration is complete - transitions to bounding box config or saves directly */
  async #finishTouchCalibration() {
    // Calculate average for each side
    const avgSides: [number, number, number] = [
      this.#calculateAverage(this.sidesMeasurements[0]),
      this.#calculateAverage(this.sidesMeasurements[1]),
      this.#calculateAverage(this.sidesMeasurements[2]),
    ];

    const currentObjectId = this.objectIds[this.currentObjectIndex];

    // Store temporarily
    this.currentSignature = {
      id: currentObjectId,
      sides: avgSides,
    };

    console.log(`Touch calibration complete for ${this.currentSignature.id}:`, avgSides);

    // Reset state
    this.isCalibrating = false;
    this.sidesMeasurements = [[], [], []];

    // Save with bounding box configuration for all objects
    const signature: ObjectSignature = {
      ...this.currentSignature,
      boundingBox: {
        width: this.boundingBoxConfig.width,
        height: this.boundingBoxConfig.height,
        xOffset: this.boundingBoxConfig.xOffset,
        yOffset: this.boundingBoxConfig.yOffset,
        orientationOffset: (this.boundingBoxConfig.orientationDegrees * Math.PI) / 180,
      },
    };
    await set(`object-signature-${signature.id}`, signature);
    console.log(`Calibrated ${signature.id}:`, signature);
    this.#moveToNextObject();
  }

  /** Move to the next object in calibration sequence */
  #moveToNextObject() {
    this.currentSignature = null;
    this.currentObjectIndex++;

    // Clean up previous subscription to avoid memory leaks
    this.subscription?.unsubscribe();

    if (this.currentObjectIndex < this.objectIds.length) {
      // Reset bounding box config with object-specific defaults for the next object
      const nextObjectId = this.objectIds[this.currentObjectIndex];
      this.boundingBoxConfig = getDefaultBoundingBoxConfig(nextObjectId);
      // Start with preview phase for all objects
      this.calibrationPhase = "preview";
      this.#render();
      this.#setupCanvas();
      this.#setupInput();
    } else {
      this.#showComplete();
    }
  }

  /** Handle changes to bounding box configuration */
  #onBoundingBoxChange(field: "width" | "height" | "orientationDegrees", value: number) {
    this.boundingBoxConfig[field] = value;
    this.#renderBoundingBoxConfig();
  }

  /** Confirm bounding box configuration and save the complete signature */
  async #confirmBoundingBox() {
    if (!this.currentSignature) return;

    // Add bounding box to signature
    const signature: ObjectSignature = {
      ...this.currentSignature,
      boundingBox: {
        width: this.boundingBoxConfig.width,
        height: this.boundingBoxConfig.height,
        xOffset: this.boundingBoxConfig.xOffset,
        yOffset: this.boundingBoxConfig.yOffset,
        orientationOffset: (this.boundingBoxConfig.orientationDegrees * Math.PI) / 180,
      },
    };

    // Store in idb-keyval
    await set(`object-signature-${signature.id}`, signature);

    console.log(`Calibrated ${signature.id}:`, signature);

    this.#moveToNextObject();
  }

  /** Skip bounding box configuration and use defaults */
  async #skipBoundingBox() {
    if (!this.currentSignature) return;

    // Save without bounding box (will use defaults)
    await set(`object-signature-${this.currentSignature.id}`, this.currentSignature);

    console.log(`Calibrated ${this.currentSignature.id} (no bounding box):`, this.currentSignature);

    this.#moveToNextObject();
  }

  #renderLoop = () => {
    if (!this.ctx || !this.canvas) return;
    // Render during both preview and touch phases, but not boundingBox config
    if (this.calibrationPhase !== "touch" && this.calibrationPhase !== "preview") return;

    const ctx = this.ctx;
    const canvas = this.canvas;
    const currentObjectId = this.objectIds[this.currentObjectIndex];

    // Clear canvas
    ctx.fillStyle = this.isCalibrating ? "#2a5a2a" : "#222222";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw based on current object type and phase
    if (this.touchPoints.size === 3) {
      const points = Array.from(this.touchPoints.values());
      const centroid = this.#getCentroid(points);
      const rotation = this.#getRotation(points) + (this.boundingBoxConfig.orientationDegrees * Math.PI) / 180;

      if (currentObjectId === "box") {
        this.#drawBoxPreview(ctx, centroid.x, centroid.y, rotation);
      } else if (currentObjectId === "tool1" || currentObjectId === "tool2") {
        this.#drawToolPreview(ctx, currentObjectId, centroid.x, centroid.y, rotation);
      }
    }

    // Draw crosshairs for each touch point
    ctx.strokeStyle = "#f1c40f";
    ctx.lineWidth = 2;

    for (const point of this.touchPoints.values()) {
      // Horizontal line
      ctx.beginPath();
      ctx.moveTo(0, point.y);
      ctx.lineTo(canvas.width, point.y);
      ctx.stroke();

      // Vertical line
      ctx.beginPath();
      ctx.moveTo(point.x, 0);
      ctx.lineTo(point.x, canvas.height);
      ctx.stroke();

      // Draw circle at touch point
      ctx.beginPath();
      ctx.arc(point.x, point.y, 10, 0, 2 * Math.PI);
      ctx.fillStyle = "#f1c40f";
      ctx.fill();
    }

    // Draw calibration progress
    if (this.isCalibrating) {
      const elapsed = Date.now() - this.calibrationStartTime;
      const progress = Math.min(elapsed / 2000, 1);

      ctx.fillStyle = "#f1c40f";
      ctx.font = "24px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`Calibrating... ${(progress * 100).toFixed(0)}%`, canvas.width / 2, 50);
    }

    requestAnimationFrame(this.#renderLoop);
  };

  /** Calculate centroid of touch points */
  #getCentroid(points: TouchPoint[]): { x: number; y: number } {
    return getGeoCentroid(points);
  }

  /** Calculate rotation based on longest edge of the triangle (order-invariant) */
  #getRotation(points: TouchPoint[]): number {
    return getCanonicalRotation(points);
  }

  /** Draw box preview at the given position (x, y is the rotation center/centroid) */
  #drawBoxPreview(ctx: CanvasRenderingContext2D, x: number, y: number, rotation: number) {
    // Get values with fallback to defaults if NaN or invalid
    const width = Number.isFinite(this.boundingBoxConfig.width) ? this.boundingBoxConfig.width : 180;
    const height = Number.isFinite(this.boundingBoxConfig.height) ? this.boundingBoxConfig.height : 130;
    const xOffset = Number.isFinite(this.boundingBoxConfig.xOffset) ? this.boundingBoxConfig.xOffset : 0;
    const yOffset = Number.isFinite(this.boundingBoxConfig.yOffset) ? this.boundingBoxConfig.yOffset : 0;
    
    // Skip drawing if dimensions are invalid
    if (width <= 0 || height <= 0) return;
    
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    const wall = 8;

    // Draw rotation center indicator (red crosshair at centroid)
    ctx.save();
    ctx.strokeStyle = "#e74c3c";
    ctx.lineWidth = 2;
    const crossSize = 15;
    ctx.beginPath();
    ctx.moveTo(x - crossSize, y);
    ctx.lineTo(x + crossSize, y);
    ctx.moveTo(x, y - crossSize);
    ctx.lineTo(x, y + crossSize);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Apply rotation first, then offset in local (rotated) coordinates
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    
    // Now apply offset in local coordinates (after rotation)
    // This means the offset moves the box relative to the rotation center
    const boxCenterX = xOffset;
    const boxCenterY = yOffset;
    const left = boxCenterX - halfWidth;
    const top = boxCenterY - halfHeight;

    // Box shadow (approximate position)
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(boxCenterX + 10, boxCenterY + halfHeight + 10, halfWidth * 0.9, 15, 0, 0, Math.PI * 2);
    ctx.fill();

    // Box main color
    ctx.fillStyle = "#d2b48c";
    ctx.fillRect(left, top, width, height);

    // Box inner shadow
    ctx.fillStyle = "#8b5a2b";
    ctx.fillRect(left + wall, top + wall, width - wall * 2, height - wall * 2);

    // Box border
    ctx.strokeStyle = "#a07040";
    ctx.lineWidth = 4;
    ctx.strokeRect(left, top, width, height);

    // Corner decorations
    const cornerSize = 25;
    ctx.beginPath();
    ctx.moveTo(left, top);
    ctx.lineTo(left + cornerSize, top + cornerSize);
    ctx.moveTo(left + width, top);
    ctx.lineTo(left + width - cornerSize, top + cornerSize);
    ctx.moveTo(left, top + height);
    ctx.lineTo(left + cornerSize, top + height - cornerSize);
    ctx.moveTo(left + width, top + height);
    ctx.lineTo(left + width - cornerSize, top + height - cornerSize);
    ctx.stroke();

    ctx.restore();
  }

  /** Draw tool preview at the given position */
  #drawToolPreview(ctx: CanvasRenderingContext2D, toolId: string, x: number, y: number, rotation: number) {
    // Get values with fallback to defaults if NaN or invalid
    const width = Number.isFinite(this.boundingBoxConfig.width) ? this.boundingBoxConfig.width : 80;
    const height = Number.isFinite(this.boundingBoxConfig.height) ? this.boundingBoxConfig.height : 80;
    const xOffset = Number.isFinite(this.boundingBoxConfig.xOffset) ? this.boundingBoxConfig.xOffset : 0;
    const yOffset = Number.isFinite(this.boundingBoxConfig.yOffset) ? this.boundingBoxConfig.yOffset : 0;
    
    // Skip drawing if dimensions are invalid
    if (width <= 0 || height <= 0) return;
    
    const halfWidth = width / 2;
    const halfHeight = height / 2;

    // Draw rotation center indicator (red crosshair at centroid)
    ctx.save();
    ctx.strokeStyle = "#e74c3c";
    ctx.lineWidth = 2;
    const crossSize = 15;
    ctx.beginPath();
    ctx.moveTo(x - crossSize, y);
    ctx.lineTo(x + crossSize, y);
    ctx.moveTo(x, y - crossSize);
    ctx.lineTo(x, y + crossSize);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Apply rotation first, then offset in local (rotated) coordinates
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    
    // Apply offset in local coordinates
    const boxCenterX = xOffset;
    const boxCenterY = yOffset;
    const left = boxCenterX - halfWidth;
    const top = boxCenterY - halfHeight;

    // Tool background
    ctx.fillStyle = "rgba(52, 152, 219, 0.35)";
    ctx.strokeStyle = "#3498db";
    ctx.lineWidth = 3;
    ctx.fillRect(left, top, width, height);
    ctx.strokeRect(left, top, width, height);

    // Tool label
    ctx.fillStyle = "#fff";
    ctx.font = "bold 16px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(getObjectDisplayName(toolId).toUpperCase(), boxCenterX, boxCenterY);

    ctx.restore();
  }

  #render() {
    const currentObjectId = this.objectIds[this.currentObjectIndex];
    const currentObjectDisplayName = getObjectDisplayName(currentObjectId);
    const isPreviewPhase = this.calibrationPhase === "preview";

    render(
      html`
        <div class="calibration-header">
          <h2>${isPreviewPhase ? `Preview and adjust ${currentObjectDisplayName}` : `Place the ${currentObjectDisplayName} in the area`}</h2>
          <button class="close-button" @click=${() => this.dispatchEvent(new CustomEvent("calibration-cancel"))}>✕</button>
        </div>
        <canvas></canvas>
        ${isPreviewPhase
          ? html`
              <div class="preview-controls" @touchstart=${(e: Event) => e.stopPropagation()} @touchmove=${(e: Event) => e.stopPropagation()} @touchend=${(e: Event) => e.stopPropagation()}>
                <div class="preview-instructions">
                  Move the ${currentObjectDisplayName} around to see the preview. The red crosshair shows the rotation center. Adjust dimensions, offset, and rotation below.
                </div>
                <div class="preview-fields-row">
                  <div class="preview-field">
                    <label for="preview-width">Width</label>
                    <input
                      id="preview-width"
                      type="number"
                      min="50"
                      max="400"
                      .value=${String(this.boundingBoxConfig.width)}
                      @input=${(e: Event) => {
                        this.boundingBoxConfig.width = Number((e.target as HTMLInputElement).value);
                      }}
                    />
                  </div>
                  <div class="preview-field">
                    <label for="preview-height">Height</label>
                    <input
                      id="preview-height"
                      type="number"
                      min="50"
                      max="400"
                      .value=${String(this.boundingBoxConfig.height)}
                      @input=${(e: Event) => {
                        this.boundingBoxConfig.height = Number((e.target as HTMLInputElement).value);
                      }}
                    />
                  </div>
                  <div class="preview-field">
                    <label for="preview-rotation">Rotation (°)</label>
                    <input
                      id="preview-rotation"
                      type="number"
                      min="-180"
                      max="180"
                      .value=${String(this.boundingBoxConfig.orientationDegrees)}
                      @input=${(e: Event) => {
                        this.boundingBoxConfig.orientationDegrees = Number((e.target as HTMLInputElement).value);
                      }}
                    />
                  </div>
                </div>
                <div class="preview-fields-row">
                  <div class="preview-field">
                    <label for="preview-x-offset">X Offset</label>
                    <input
                      id="preview-x-offset"
                      type="number"
                      min="-200"
                      max="200"
                      .value=${String(this.boundingBoxConfig.xOffset)}
                      @input=${(e: Event) => {
                        this.boundingBoxConfig.xOffset = Number((e.target as HTMLInputElement).value);
                      }}
                    />
                  </div>
                  <div class="preview-field">
                    <label for="preview-y-offset">Y Offset</label>
                    <input
                      id="preview-y-offset"
                      type="number"
                      min="-200"
                      max="200"
                      .value=${String(this.boundingBoxConfig.yOffset)}
                      @input=${(e: Event) => {
                        this.boundingBoxConfig.yOffset = Number((e.target as HTMLInputElement).value);
                      }}
                    />
                  </div>
                </div>
                <button class="btn-done" @click=${() => this.#startTouchCalibrationPhase()}>Done - Start Calibration</button>
              </div>
            `
          : null}
      `,
      this
    );
  }

  /** Transition from preview phase to touch calibration phase */
  #startTouchCalibrationPhase() {
    this.calibrationPhase = "touch";
    this.#render();
  }

  /** Render the bounding box configuration UI */
  #renderBoundingBoxConfig() {
    const objectId = this.currentSignature?.id ?? "object";
    const objectDisplayName = getObjectDisplayName(objectId);
    const sidesInfo = this.currentSignature?.sides
      ? `Triangle sides: ${this.currentSignature.sides.map((s) => Math.round(s)).join(", ")} px`
      : "";

    render(
      html`
        <div class="calibration-header">
          <h2>Configure bounding box for ${objectDisplayName}</h2>
          <button class="close-button" @click=${() => this.dispatchEvent(new CustomEvent("calibration-cancel"))}>✕</button>
        </div>
        <div class="bounding-box-config">
          <p class="sides-info">${sidesInfo}</p>
          <p class="config-description">
            Set the bounding box dimensions and orientation for the visual representation and collision detection.
          </p>

          <div class="bounding-box-preview">
            <svg viewBox="0 0 200 200" class="preview-svg">
              <!-- Triangle representing touch points -->
              <polygon
                points="${this.#getTrianglePoints()}"
                fill="rgba(241, 196, 15, 0.3)"
                stroke="#f1c40f"
                stroke-width="2"
              />
              <!-- Bounding box -->
              <g transform="translate(100, 100) rotate(${this.boundingBoxConfig.orientationDegrees})">
                <rect
                  x="${-this.boundingBoxConfig.width / 4}"
                  y="${-this.boundingBoxConfig.height / 4}"
                  width="${this.boundingBoxConfig.width / 2}"
                  height="${this.boundingBoxConfig.height / 2}"
                  fill="rgba(52, 152, 219, 0.3)"
                  stroke="#3498db"
                  stroke-width="2"
                  stroke-dasharray="5,3"
                />
                <!-- Orientation indicator -->
                <line x1="0" y1="0" x2="${this.boundingBoxConfig.width / 4}" y2="0" stroke="#2ecc71" stroke-width="3" />
              </g>
              <!-- Center point -->
              <circle cx="100" cy="100" r="4" fill="#e74c3c" />
            </svg>
          </div>

          <div class="config-fields">
            <div class="config-field">
              <label for="bbox-width">Width (px)</label>
              <input
                id="bbox-width"
                type="number"
                min="10"
                max="500"
                .value=${String(this.boundingBoxConfig.width)}
                @input=${(e: Event) => this.#onBoundingBoxChange("width", Number((e.target as HTMLInputElement).value))}
              />
            </div>
            <div class="config-field">
              <label for="bbox-height">Height (px)</label>
              <input
                id="bbox-height"
                type="number"
                min="10"
                max="500"
                .value=${String(this.boundingBoxConfig.height)}
                @input=${(e: Event) => this.#onBoundingBoxChange("height", Number((e.target as HTMLInputElement).value))}
              />
            </div>
            <div class="config-field">
              <label for="bbox-orientation">Orientation (°)</label>
              <input
                id="bbox-orientation"
                type="number"
                min="-180"
                max="180"
                .value=${String(this.boundingBoxConfig.orientationDegrees)}
                @input=${(e: Event) => this.#onBoundingBoxChange("orientationDegrees", Number((e.target as HTMLInputElement).value))}
              />
            </div>
          </div>

          <div class="config-actions">
            <button class="btn-skip" @click=${() => this.#skipBoundingBox()}>Skip (Use Defaults)</button>
            <button class="btn-confirm" @click=${() => this.#confirmBoundingBox()}>Confirm</button>
          </div>
        </div>
      `,
      this
    );
  }

  /** Generate SVG triangle points from the calibrated sides for preview */
  #getTrianglePoints(): string {
    if (!this.currentSignature?.sides) return "100,70 70,130 130,130";

    // Normalize sides to fit in the preview (roughly 60px max dimension)
    const [a, b, c] = this.currentSignature.sides;
    const maxSide = Math.max(a, b, c);
    const scale = 50 / maxSide;

    // Create a triangle centered at (100, 100)
    // Place first point at top, second at bottom-left, third at bottom-right
    const sa = a * scale;
    const sb = b * scale;
    const sc = c * scale;

    // Use law of cosines to find angles
    // Clamp the argument to [-1, 1] to handle floating point errors and invalid triangles
    const cosArg = (sa * sa + sb * sb - sc * sc) / (2 * sa * sb);
    const clampedCosArg = Math.max(-1, Math.min(1, cosArg));
    const angleAtC = Math.acos(clampedCosArg);

    // Position vertices
    const p1 = { x: 100, y: 70 };
    const p2 = { x: 100 - sa * 0.5, y: 70 + sb * Math.sin(angleAtC) };
    const p3 = { x: 100 + sa * 0.5, y: 70 + sb * Math.sin(angleAtC) };

    return `${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`;
  }

  #showComplete() {
    render(
      html`
        <div class="calibration-header">
          <h2>Calibration Complete!</h2>
          <button class="close-button" @click=${() => this.dispatchEvent(new CustomEvent("calibration-cancel"))}>✕</button>
        </div>
        <p>All objects have been calibrated.</p>
        <button @click=${() => this.dispatchEvent(new CustomEvent("calibration-done"))}>Done</button>
      `,
      this
    );
  }
}
