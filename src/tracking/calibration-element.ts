import { del, set } from "idb-keyval";
import { html, render } from "lit-html";
import { Subscription, distinctUntilChanged, exhaustMap, filter, finalize, map, share, takeUntil, tap, timer } from "rxjs";
import { getInputRawEvent$ } from "./input";

/**
 * Extended object signature with bounding box properties.
 * Supports customizable width, height, and orientation for the visual/collision representation.
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
  /** Current phase of calibration: 'touch' for 3-point calibration, 'boundingBox' for dimensions */
  private calibrationPhase: "touch" | "boundingBox" = "touch";
  /** Temporary storage for current object's touch signature before bounding box configuration */
  private currentSignature: ObjectSignature | null = null;
  /** Current bounding box values being configured */
  private boundingBoxConfig = { width: 100, height: 100, orientationDegrees: 0 };

  connectedCallback() {
    this.#clearPreviousResults();
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
          // Update all current touches
          for (let i = 0; i < event.touches.length; i++) {
            const touch = event.touches[i];
            this.touchPoints.set(touch.identifier, {
              id: touch.identifier,
              x: touch.clientX - rect.left,
              y: touch.clientY - rect.top,
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

  /** Called after 3-point touch calibration is complete - transitions to bounding box config */
  #finishTouchCalibration() {
    // Calculate average for each side
    const avgSides: [number, number, number] = [
      this.#calculateAverage(this.sidesMeasurements[0]),
      this.#calculateAverage(this.sidesMeasurements[1]),
      this.#calculateAverage(this.sidesMeasurements[2]),
    ];

    // Store temporarily
    this.currentSignature = {
      id: this.objectIds[this.currentObjectIndex],
      sides: avgSides,
    };

    console.log(`Touch calibration complete for ${this.currentSignature.id}:`, avgSides);

    // Reset state
    this.isCalibrating = false;
    this.sidesMeasurements = [[], [], []];

    // Use default bounding box values based on the triangle size
    const longestSide = avgSides[2];
    this.boundingBoxConfig = {
      width: Math.round(longestSide * 0.8),
      height: Math.round(longestSide * 1.2),
      orientationDegrees: 0,
    };

    // Show bounding box configuration UI
    this.calibrationPhase = "boundingBox";
    this.#renderBoundingBoxConfig();
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
        orientationOffset: (this.boundingBoxConfig.orientationDegrees * Math.PI) / 180,
      },
    };

    // Store in idb-keyval
    await set(`object-signature-${signature.id}`, signature);

    console.log(`Calibrated ${signature.id}:`, signature);

    // Reset for next object
    this.currentSignature = null;
    this.calibrationPhase = "touch";
    this.currentObjectIndex++;

    if (this.currentObjectIndex < this.objectIds.length) {
      this.#render();
      this.#setupCanvas();
      this.#setupInput();
    } else {
      this.#showComplete();
    }
  }

  /** Skip bounding box configuration and use defaults */
  async #skipBoundingBox() {
    if (!this.currentSignature) return;

    // Save without bounding box (will use defaults)
    await set(`object-signature-${this.currentSignature.id}`, this.currentSignature);

    console.log(`Calibrated ${this.currentSignature.id} (no bounding box):`, this.currentSignature);

    // Reset for next object
    this.currentSignature = null;
    this.calibrationPhase = "touch";
    this.currentObjectIndex++;

    if (this.currentObjectIndex < this.objectIds.length) {
      this.#render();
      this.#setupCanvas();
      this.#setupInput();
    } else {
      this.#showComplete();
    }
  }

  #renderLoop = () => {
    if (!this.ctx || !this.canvas) return;
    if (this.calibrationPhase !== "touch") return; // Don't render when showing bounding box config

    const ctx = this.ctx;
    const canvas = this.canvas;

    // Clear canvas
    ctx.fillStyle = this.isCalibrating ? "#2a5a2a" : "#222222";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

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

  #render() {
    render(
      html`
        <div class="calibration-header">
          <h2>Place the ${this.objectIds[this.currentObjectIndex]} in the area</h2>
          <button class="close-button" @click=${() => this.dispatchEvent(new CustomEvent("calibration-cancel"))}>✕</button>
        </div>
        <canvas></canvas>
      `,
      this
    );
  }

  /** Render the bounding box configuration UI */
  #renderBoundingBoxConfig() {
    const objectId = this.currentSignature?.id ?? "object";
    const sidesInfo = this.currentSignature?.sides
      ? `Triangle sides: ${this.currentSignature.sides.map((s) => Math.round(s)).join(", ")} px`
      : "";

    render(
      html`
        <div class="calibration-header">
          <h2>Configure bounding box for ${objectId}</h2>
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
    const angleAtC = Math.acos((sa * sa + sb * sb - sc * sc) / (2 * sa * sb));

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
