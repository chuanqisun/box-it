import { get } from "idb-keyval";
import { CALIBRATION_OBJECT_IDS, CalibrationElement, DEFAULT_CALIBRATION_PRESETS, type ObjectSignature } from "./calibration-element";
import "./calibration-element.css";
import { getInputRawEvent$, getObjectEvents, type ObjectUpdate } from "./input";

const OBJECT_DISPLAY_NAMES: Record<string, string> = {
  box: "box",
  tool1: "tape",
  tool2: "iron",
  tool3: "mover",
};

function getObjectDisplayName(id: string): string {
  return OBJECT_DISPLAY_NAMES[id] || id;
}

/** Get default signature for an object when no calibration data exists */
function getDefaultSignature(id: string): ObjectSignature | null {
  const preset = DEFAULT_CALIBRATION_PRESETS[id];
  if (!preset) return null;
  return {
    id,
    sides: preset.sides,
    boundingBox: {
      width: preset.width,
      height: preset.height,
      xOffset: preset.xOffset,
      yOffset: preset.yOffset,
      orientationOffset: (preset.orientationDegrees * Math.PI) / 180,
    },
  };
}

export async function loadCalibratedObjects(container: HTMLElement) {
  const items = await Promise.all(
    CALIBRATION_OBJECT_IDS.map(async (id) => {
      const signature = await get<ObjectSignature>(`object-signature-${id}`);
      const displayName = getObjectDisplayName(id);
      const item = document.createElement("div");
      item.className = "calibrated-object-item";

      if (signature && signature.sides) {
        const sidesStr = signature.sides.map((s: number) => Math.round(s)).join(", ");
        let info = `[${sidesStr}]`;

        // Show bounding box info if available (condensed format with all parameters)
        if (signature.boundingBox) {
          const { width, height, xOffset, yOffset, orientationOffset } = signature.boundingBox;
          const orientDeg = Math.round((orientationOffset * 180) / Math.PI);
          info += ` ${width}×${height} @${orientDeg}° xy(${xOffset},${yOffset})`;
        }

        item.innerHTML = `<span class="object-id">${displayName}</span><span class="object-sides">${info}</span>`;
        item.classList.add("calibrated");
      } else {
        item.innerHTML = `<span class="object-id">${displayName}</span><span class="object-sides">Not calibrated</span>`;
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

export async function initObjectTracking(
  canvas: HTMLCanvasElement,
  onUpdate: (id: string, x: number, y: number, rotation: number, confidence: number, activePoints: number, boundingBox?: ObjectUpdate["boundingBox"], eventType?: "down" | "move" | "up") => void
) {
  try {
    const signatures = await Promise.all(
      ["box", "tool1", "tool2", "tool3"].map(async (id) => ({
        id,
        signature: await get<ObjectSignature>(`object-signature-${id}`),
      }))
    );

    const knownObjects = signatures
      .map((entry) => {
        // Use calibrated signature if available with both sides and boundingBox, otherwise use default
        const signature = entry.signature?.sides && entry.signature?.boundingBox 
          ? entry.signature 
          : getDefaultSignature(entry.id);
        if (!signature?.sides) return null;
        return {
          id: entry.id,
          sides: signature.sides,
          boundingBox: signature.boundingBox,
        };
      })
      .filter((obj): obj is NonNullable<typeof obj> => obj !== null);

    if (knownObjects.length === 0) return;

    const rawEvents$ = getInputRawEvent$(canvas);
    // Pass canvas as target element to ensure consistent coordinate system
    getObjectEvents(rawEvents$, { knownObjects }, canvas).subscribe((update: ObjectUpdate) => {
      onUpdate(update.id, update.position.x, update.position.y, update.rotation, update.confidence, update.activePoints, update.boundingBox, update.type);
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Object tracking unavailable: calibration data could not be loaded (${message}).`, error);
  }
}
