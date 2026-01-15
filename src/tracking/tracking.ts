import { get } from "idb-keyval";
import { CALIBRATION_OBJECT_IDS, CalibrationElement } from "./calibration-element";
import "./calibration-element.css";
import { getInputRawEvent$, getObjectEvents, type ObjectUpdate } from "./input";

export async function loadCalibratedObjects(container: HTMLElement) {
  const items = await Promise.all(
    CALIBRATION_OBJECT_IDS.map(async (id) => {
      const signature = await get(`object-signature-${id}`);
      const item = document.createElement("div");
      item.className = "calibrated-object-item";

      if (signature && (signature as any).sides) {
        const sidesStr = (signature as any).sides.map((s: number) => Math.round(s)).join(", ");
        item.innerHTML = `<span class="object-id">${id}</span><span class="object-sides">[${sidesStr}]</span>`;
        item.classList.add("calibrated");
      } else {
        item.innerHTML = `<span class="object-id">${id}</span><span class="object-sides">Not calibrated</span>`;
        item.classList.add("not-calibrated");
      }
      return item;
    })
  );

  container.replaceChildren(...items);
}

export function initCalibrationLifecycle() {
  const settingsMenu = document.getElementById("settingsMenu") as HTMLDialogElement;
  const calibrateBtn = document.getElementById("calibrateButton") as HTMLButtonElement;
  const calibratedObjectsEl = document.getElementById("calibratedObjects") as HTMLDivElement;

  if (!settingsMenu || !calibrateBtn || !calibratedObjectsEl) {
    return;
  }

  CalibrationElement.define();

  settingsMenu.addEventListener("toggle", (e) => {
    if ((e as ToggleEvent).newState === "open") {
      loadCalibratedObjects(calibratedObjectsEl);
    }
  });

  calibrateBtn.addEventListener("click", () => {
    settingsMenu.close();

    // Create calibration element with padding
    const calibrationEl = document.createElement("calibration-element") as CalibrationElement;
    calibrationEl.style.padding = "40px";
    document.body.appendChild(calibrationEl);

    // Listen for calibration done event
    calibrationEl.addEventListener("calibration-done", async () => {
      // Retrieve and log the calibrated objects
      const signatures = await Promise.all(CALIBRATION_OBJECT_IDS.map(async (id) => ({ id, signature: await get(`object-signature-${id}`) })));

      console.log(
        "Calibrated Objects:",
        signatures.reduce((acc, { id, signature }) => ({ ...acc, [id]: signature }), {})
      );

      // Remove calibration element and reopen settings menu
      calibrationEl.remove();
      settingsMenu.showModal();
      loadCalibratedObjects(calibratedObjectsEl);
    });

    // Listen for calibration cancel event
    calibrationEl.addEventListener("calibration-cancel", () => {
      // Remove calibration element and reopen settings menu
      calibrationEl.remove();
      settingsMenu.showModal();
    });
  });
}

export async function initObjectTracking(canvas: HTMLCanvasElement, onUpdate: (x: number, y: number, rotation: number) => void) {
  try {
    const signature = await get<{ id: string; sides: [number, number, number] }>("object-signature-box");
    if (!signature?.sides) return;

    const rawEvents$ = getInputRawEvent$(canvas);
    getObjectEvents(rawEvents$, { knownObjects: [{ id: signature.id, sides: signature.sides }] }).subscribe((update: ObjectUpdate) => {
      if (update.id !== "box") return;
      if (update.type === "down" || update.type === "move") {
        onUpdate(update.position.x, update.position.y, update.rotation);
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Object tracking unavailable: calibration data could not be loaded (${message}).`, error);
  }
}
