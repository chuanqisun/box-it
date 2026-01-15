import { del, set } from "idb-keyval";
import { html, render } from "lit-html";
import { Subscription } from "rxjs";
import { getInputRawEvent$ } from "../input";

interface ObjectSignature {
  id: string;
  sides: [number, number, number]; // lengths of the 3 sides, incrementally sorted
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
    this.ctx = this.canvas.getContext("2d")!;

    // Set canvas size to match viewport
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;

    // Start rendering loop
    this.#renderLoop();
  }

  #setupInput() {
    this.subscription = getInputRawEvent$(this.canvas!).subscribe((event) => {
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

      this.#updateCalibrationState();
    });
  }

  #updateCalibrationState() {
    const numTouches = this.touchPoints.size;

    if (numTouches === 3 && !this.isCalibrating) {
      // Start calibration
      this.isCalibrating = true;
      this.calibrationStartTime = Date.now();
      this.sidesMeasurements = [[], [], []];
    } else if (numTouches === 3 && this.isCalibrating) {
      // Continue calibration - measure sides
      const points = Array.from(this.touchPoints.values());
      const sides = this.#calculateSides(points);

      this.sidesMeasurements[0].push(sides[0]);
      this.sidesMeasurements[1].push(sides[1]);
      this.sidesMeasurements[2].push(sides[2]);

      // Check if 3 seconds have passed
      const elapsed = Date.now() - this.calibrationStartTime;
      if (elapsed >= 3000) {
        this.#finishCalibration();
      }
    } else if (numTouches !== 3 && this.isCalibrating) {
      // Reset calibration if touch count changes
      this.isCalibrating = false;
      this.sidesMeasurements = [[], [], []];
    }
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

  async #finishCalibration() {
    // Calculate average for each side
    const avgSides: [number, number, number] = [
      this.#calculateAverage(this.sidesMeasurements[0]),
      this.#calculateAverage(this.sidesMeasurements[1]),
      this.#calculateAverage(this.sidesMeasurements[2]),
    ];

    const signature: ObjectSignature = {
      id: this.objectIds[this.currentObjectIndex],
      sides: avgSides,
    };

    // Store in idb-keyval
    await set(`object-signature-${signature.id}`, signature);

    console.log(`Calibrated ${signature.id}:`, signature);

    // Reset state
    this.isCalibrating = false;
    this.touchPoints.clear();
    this.sidesMeasurements = [[], [], []];

    // Move to next object
    this.currentObjectIndex++;
    if (this.currentObjectIndex < this.objectIds.length) {
      this.#render();
    } else {
      this.#showComplete();
    }
  }

  #renderLoop = () => {
    if (!this.ctx || !this.canvas) return;

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
      const progress = Math.min(elapsed / 3000, 1);

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
