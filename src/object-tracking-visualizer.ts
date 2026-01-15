import "./object-tracking-visualizer.css";

type Vec2 = { x: number; y: number };

interface ObjectSignature {
  id: string;
  sides: [number, number, number];
}

interface TouchPoint {
  id: number;
  x: number;
  y: number;
  sx: number;
  sy: number;
  vx: number;
  vy: number;
  lastSeen: number;
}

interface TriangleDetection {
  id: number;
  pointIds: [number, number, number];
  points: [Vec2, Vec2, Vec2];
  sides: [number, number, number];
  centroid: Vec2;
  rotation: number;
  match?: {
    signatureId: string;
    score: number;
    scale: number;
  };
}

interface TrackState {
  id: number;
  signatureId: string;
  centroid: Vec2;
  rotation: number;
  confidence: number;
  lastSeen: number;
  detectionId: number;
}

const MAX_POINTS = 16;
const TRACK_TIMEOUT_MS = 600;
const DETECTION_SCORE_THRESHOLD = 0.08;
const MIN_EDGE_PX = 10;

const registeredSignatures: ObjectSignature[] = [
  { id: "tool-a", sides: [60, 85, 120] },
  { id: "tool-b", sides: [70, 95, 140] },
  { id: "tool-c", sides: [80, 110, 150] },
];

const state = {
  points: new Map<number, TouchPoint>(),
  detections: [] as TriangleDetection[],
  tracks: [] as TrackState[],
  nextDetectionId: 1,
  nextTrackId: 1,
  lastFrame: performance.now(),
  dimensions: { width: 0, height: 0 },
  calibration: {
    active: false,
    signatureId: "",
    startTime: 0,
    measurements: [[], [], []] as number[][],
  },
};

const canvas = document.getElementById("otv-canvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;

const sigList = document.getElementById("sig-list") as HTMLDivElement;
const pointsList = document.getElementById("points-list") as HTMLDivElement;
const trianglesList = document.getElementById("triangles-list") as HTMLDivElement;
const matchesList = document.getElementById("matches-list") as HTMLDivElement;
const tracksList = document.getElementById("tracks-list") as HTMLDivElement;

const clearButton = document.getElementById("clear-points") as HTMLButtonElement;
const addSigButton = document.getElementById("add-sig") as HTMLButtonElement;
const sigIdInput = document.getElementById("sig-id") as HTMLInputElement;
const sigAInput = document.getElementById("sig-a") as HTMLInputElement;
const sigBInput = document.getElementById("sig-b") as HTMLInputElement;
const sigCInput = document.getElementById("sig-c") as HTMLInputElement;

clearButton.addEventListener("click", () => {
  state.points.clear();
  state.tracks = [];
  state.calibration.active = false;
});

addSigButton.addEventListener("click", () => {
  const id = sigIdInput.value.trim();
  const a = Number(sigAInput.value);
  const b = Number(sigBInput.value);
  const c = Number(sigCInput.value);
  if (!id || !Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(c)) {
    return;
  }
  const sides = sortSides([a, b, c]);
  registeredSignatures.push({ id, sides });
  sigIdInput.value = "";
  sigAInput.value = "";
  sigBInput.value = "";
  sigCInput.value = "";
});

sigList.addEventListener("click", (e) => {
  const target = e.target as HTMLElement;
  if (target.classList.contains("btn-calibrate")) {
    const id = target.getAttribute("data-id");
    if (id) {
      if (state.calibration.active && state.calibration.signatureId === id) {
        state.calibration.active = false;
      } else {
        startCalibration(id);
      }
    }
  }
});

function startCalibration(id: string) {
  state.calibration.active = true;
  state.calibration.signatureId = id;
  state.calibration.startTime = 0; // Will be set when 3 points are detected
  state.calibration.measurements = [[], [], []];
}

function updateCalibration(now: number) {
  if (!state.calibration.active) return;

  const points = Array.from(state.points.values());
  if (points.length === 3) {
    if (state.calibration.startTime === 0) {
      state.calibration.startTime = now;
      state.calibration.measurements = [[], [], []];
    }

    const sides = sortSides([
      distance(points[0], points[1]),
      distance(points[1], points[2]),
      distance(points[2], points[0]),
    ]);

    state.calibration.measurements[0].push(sides[0]);
    state.calibration.measurements[1].push(sides[1]);
    state.calibration.measurements[2].push(sides[2]);

    if (now - state.calibration.startTime >= 2000) {
      finishCalibration();
    }
  } else {
    state.calibration.startTime = 0;
    state.calibration.measurements = [[], [], []];
  }
}

function finishCalibration() {
  const avgSides: [number, number, number] = [
    average(state.calibration.measurements[0]),
    average(state.calibration.measurements[1]),
    average(state.calibration.measurements[2]),
  ];

  const sig = registeredSignatures.find((s) => s.id === state.calibration.signatureId);
  if (sig) {
    sig.sides = avgSides;
  }

  state.calibration.active = false;
  state.calibration.signatureId = "";
}

function average(vals: number[]) {
  return vals.length === 0 ? 0 : vals.reduce((a, b) => a + b, 0) / vals.length;
}

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);

  state.dimensions.width = width;
  state.dimensions.height = height;

  ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

function getAreaOffset(el: HTMLElement) {
  let x = 0;
  let y = 0;
  let curr: HTMLElement | null = el;
  while (curr) {
    x += curr.offsetLeft;
    y += curr.offsetTop;
    curr = curr.offsetParent as HTMLElement;
  }
  return { x, y };
}

canvas.addEventListener("touchstart", (event) => {
  event.preventDefault();
  const area = event.currentTarget as HTMLElement;
  const offset = getAreaOffset(area);
  for (let i = 0; i < event.changedTouches.length; i++) {
    const touch = event.changedTouches[i];
    addOrUpdatePoint(touch.identifier, touch.pageX - offset.x, touch.pageY - offset.y);
  }
});

canvas.addEventListener("touchmove", (event) => {
  event.preventDefault();
  const area = event.currentTarget as HTMLElement;
  const offset = getAreaOffset(area);
  for (let i = 0; i < event.touches.length; i++) {
    const touch = event.touches[i];
    addOrUpdatePoint(touch.identifier, touch.pageX - offset.x, touch.pageY - offset.y);
  }
});

canvas.addEventListener("touchend", (event) => {
  event.preventDefault();
  for (let i = 0; i < event.changedTouches.length; i++) {
    const touch = event.changedTouches[i];
    state.points.delete(touch.identifier);
  }
});

canvas.addEventListener("touchcancel", (event) => {
  event.preventDefault();
  for (let i = 0; i < event.changedTouches.length; i++) {
    const touch = event.changedTouches[i];
    state.points.delete(touch.identifier);
  }
});

function addOrUpdatePoint(id: number, x: number, y: number) {
  const now = performance.now();
  const existing = state.points.get(id);
  if (!existing) {
    state.points.set(id, {
      id,
      x,
      y,
      sx: x,
      sy: y,
      vx: 0,
      vy: 0,
      lastSeen: now,
    });
    return;
  }
  const dt = Math.max(1, now - existing.lastSeen);
  const vx = (x - existing.x) / dt;
  const vy = (y - existing.y) / dt;
  existing.vx = vx;
  existing.vy = vy;
  existing.x = x;
  existing.y = y;
  existing.sx = x;
  existing.sy = y;
  existing.lastSeen = now;
}

function loop(now: number) {
  const dt = now - state.lastFrame;
  state.lastFrame = now;
  if (state.points.size > MAX_POINTS) {
    const ids = Array.from(state.points.keys());
    ids.slice(0, state.points.size - MAX_POINTS).forEach((id) => state.points.delete(id));
  }
  updateCalibration(now);
  updateDetections();
  updateTracks(now);
  render(dt);
  updateLists();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);

function updateDetections() {
  const points = Array.from(state.points.values());
  const candidates: TriangleDetection[] = [];
  for (let i = 0; i < points.length - 2; i++) {
    for (let j = i + 1; j < points.length - 1; j++) {
      for (let k = j + 1; k < points.length; k++) {
        const p1 = points[i];
        const p2 = points[j];
        const p3 = points[k];
        const sides = sortSides([distance(p1, p2), distance(p2, p3), distance(p1, p3)]);
        if (sides[0] < MIN_EDGE_PX) continue;
        const centroid = {
          x: (p1.sx + p2.sx + p3.sx) / 3,
          y: (p1.sy + p2.sy + p3.sy) / 3,
        };
        const rotation = computeRotation(centroid, [p1, p2, p3]);
        const detection: TriangleDetection = {
          id: state.nextDetectionId++,
          pointIds: [p1.id, p2.id, p3.id],
          points: [p1, p2, p3].map((p) => ({ x: p.sx, y: p.sy })) as [Vec2, Vec2, Vec2],
          sides,
          centroid,
          rotation,
        };
        detection.match = matchSignature(detection);
        candidates.push(detection);
      }
    }
  }
  state.detections = selectNonOverlapping(candidates);
}

function matchSignature(detection: TriangleDetection) {
  let best: { signatureId: string; score: number; scale: number } | undefined;
  for (const signature of registeredSignatures) {
    const { score, scale } = compareSides(detection.sides, signature.sides);
    if (score <= DETECTION_SCORE_THRESHOLD && (!best || score < best.score)) {
      best = { signatureId: signature.id, score, scale };
    }
  }
  return best;
}

function selectNonOverlapping(detections: TriangleDetection[]) {
  const chosen: TriangleDetection[] = [];
  const usedPoints = new Set<number>();
  const sorted = detections.slice().sort((a, b) => {
    const sa = a.match?.score ?? Infinity;
    const sb = b.match?.score ?? Infinity;
    if (sa !== sb) return sa - sb;
    return b.sides[2] - a.sides[2];
  });
  for (const detection of sorted) {
    if (!detection.match) continue;
    if (detection.pointIds.some((id) => usedPoints.has(id))) continue;
    detection.pointIds.forEach((id) => usedPoints.add(id));
    chosen.push(detection);
  }
  return chosen;
}

function updateTracks(now: number) {
  const assignedDetections = new Set<number>();
  const pairings: Array<{ track: TrackState; detection: TriangleDetection; distance: number }> = [];
  for (const track of state.tracks) {
    for (const detection of state.detections) {
      if (!detection.match || detection.match.signatureId !== track.signatureId) continue;
      const dist = distance(track.centroid, detection.centroid);
      pairings.push({ track, detection, distance: dist });
    }
  }
  pairings.sort((a, b) => a.distance - b.distance);
  const usedTracks = new Set<number>();
  for (const pairing of pairings) {
    if (usedTracks.has(pairing.track.id)) continue;
    if (assignedDetections.has(pairing.detection.id)) continue;
    if (pairing.distance > 120) continue;
    usedTracks.add(pairing.track.id);
    assignedDetections.add(pairing.detection.id);
    pairing.track.centroid = { ...pairing.detection.centroid };
    pairing.track.rotation = pairing.detection.rotation;
    pairing.track.confidence = Math.min(1, pairing.track.confidence + 0.15);
    pairing.track.lastSeen = now;
    pairing.track.detectionId = pairing.detection.id;
  }
  for (const detection of state.detections) {
    if (!detection.match) continue;
    if (assignedDetections.has(detection.id)) continue;
    state.tracks.push({
      id: state.nextTrackId++,
      signatureId: detection.match.signatureId,
      centroid: { ...detection.centroid },
      rotation: detection.rotation,
      confidence: 0.6,
      lastSeen: now,
      detectionId: detection.id,
    });
  }
  state.tracks = state.tracks.filter((track) => now - track.lastSeen < TRACK_TIMEOUT_MS);
}

function render(dt: number) {
  const { width, height } = state.dimensions;
  if (width === 0 || height === 0) return;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#0f141b";
  ctx.fillRect(0, 0, width, height);

  ctx.lineWidth = 2;
  for (const detection of state.detections) {
    const points = detection.points;
    ctx.strokeStyle = detection.match ? "#80ed99" : "#f4a261";
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    ctx.lineTo(points[1].x, points[1].y);
    ctx.lineTo(points[2].x, points[2].y);
    ctx.closePath();
    ctx.stroke();
  }

  for (const point of state.points.values()) {
    ctx.fillStyle = "#4ea8de";
    ctx.beginPath();
    ctx.arc(point.sx, point.sy, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#d8e2dc";
    ctx.font = "12px Inter, sans-serif";
    ctx.fillText(String(point.id), point.sx + 10, point.sy - 8);
  }

  for (const track of state.tracks) {
    ctx.strokeStyle = "#ffd166";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(track.centroid.x, track.centroid.y, 10, 0, Math.PI * 2);
    ctx.stroke();
    const arrow = {
      x: track.centroid.x + Math.cos(track.rotation) * 16,
      y: track.centroid.y + Math.sin(track.rotation) * 16,
    };
    ctx.beginPath();
    ctx.moveTo(track.centroid.x, track.centroid.y);
    ctx.lineTo(arrow.x, arrow.y);
    ctx.stroke();
    ctx.fillStyle = "#ffd166";
    ctx.fillText(`T${track.id}`, track.centroid.x + 12, track.centroid.y + 4);
  }

  if (state.calibration.active) {
    const now = performance.now();
    const progress = state.calibration.startTime === 0 ? 0 : Math.min(1, (now - state.calibration.startTime) / 2000);
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(0, 0, width, height);

    ctx.textAlign = "center";
    ctx.font = "600 14px Inter, sans-serif";
    ctx.fillStyle = "#e6edf3";
    ctx.fillText(`Calibrating: ${state.calibration.signatureId}`, width / 2, height / 2 - 25);

    const bW = 240;
    const bH = 8;
    ctx.fillStyle = "#161b22";
    ctx.roundRect(width / 2 - bW / 2, height / 2 - bH / 2, bW, bH, 4);
    ctx.fill();

    ctx.fillStyle = "#3a86ff";
    ctx.roundRect(width / 2 - bW / 2, height / 2 - bH / 2, bW * progress, bH, 4);
    ctx.fill();

    if (state.points.size !== 3) {
      ctx.fillStyle = "#f85149";
      ctx.font = "11px Inter, sans-serif";
      ctx.fillText("Place Exactly 3 Points to Calibrate", width / 2, height / 2 + 25);
    } else {
      ctx.fillStyle = "#8b949e";
      ctx.font = "11px Inter, sans-serif";
      ctx.fillText("Hold steady...", width / 2, height / 2 + 25);
    }
    ctx.textAlign = "left";
  }

  ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
  ctx.textAlign = "right";
  ctx.fillText(`Δt ${dt.toFixed(1)} ms`, width - 12, height - 12);
  ctx.textAlign = "left";
}

function updateLists() {
  sigList.innerHTML = registeredSignatures
    .map((sig) => {
      const isActive = state.calibration.active && state.calibration.signatureId === sig.id;
      return renderItem(
        `<strong>${sig.id}</strong> → (${sig.sides.map((v) => v.toFixed(1)).join(", ")}) <button class="btn-calibrate ${
          isActive ? "active" : ""
        }" data-id="${sig.id}">${isActive ? "Calibrating..." : "Calibrate"}</button>`
      );
    })
    .join("");

  pointsList.innerHTML = Array.from(state.points.values())
    .map((point) => renderItem(`#${point.id} → (${point.sx.toFixed(1)}, ${point.sy.toFixed(1)}) v=(${point.vx.toFixed(3)}, ${point.vy.toFixed(3)})`))
    .join("");

  trianglesList.innerHTML = state.detections
    .map((det) => renderItem(`Δ${det.id} points [${det.pointIds.join(", ")}] → (${det.sides.map((v) => v.toFixed(1)).join(", ")})`))
    .join("");

  matchesList.innerHTML = state.detections
    .map((det) => {
      if (!det.match) {
        return renderItem(`Δ${det.id} → no match`);
      }
      return renderItem(`Δ${det.id} → <strong>${det.match.signatureId}</strong> score=${det.match.score.toFixed(4)} scale=${det.match.scale.toFixed(3)}`);
    })
    .join("");

  tracksList.innerHTML = state.tracks
    .map((track) =>
      renderItem(
        `T${track.id} (${track.signatureId}) @ (${track.centroid.x.toFixed(1)}, ${track.centroid.y.toFixed(1)}) rot=${toDegrees(track.rotation).toFixed(
          1
        )}° conf=${track.confidence.toFixed(2)}`
      )
    )
    .join("");
}

function renderItem(content: string) {
  return `<div class="otv-item">${content}</div>`;
}

function distance(a: Vec2, b: Vec2) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function sortSides(sides: [number, number, number] | number[]) {
  const sorted = [...sides].sort((a, b) => a - b) as [number, number, number];
  return sorted;
}

function compareSides(candidate: [number, number, number], signature: [number, number, number]) {
  const ratios = candidate.map((value, index) => value / signature[index]);
  const scale = median(ratios);
  const errors = candidate.map((value, index) => Math.abs(value - signature[index] * scale) / (signature[index] * scale));
  const score = (errors[0] + errors[1] + errors[2]) / 3;
  return { score, scale };
}

function median(values: number[]) {
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function computeRotation(centroid: Vec2, points: Array<Vec2 & { id: number }>) {
  const anchor = points.slice().sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x))[0];
  return Math.atan2(anchor.y - centroid.y, anchor.x - centroid.x);
}

function toDegrees(rad: number) {
  return (rad * 180) / Math.PI;
}
