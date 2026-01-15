import { fromEvent, merge, Observable } from "rxjs";

export function getInputRawEvent$(targetArea: HTMLElement): Observable<TouchEvent> {
  const touchstart$ = fromEvent<TouchEvent>(targetArea, "touchstart");
  const touchmove$ = fromEvent<TouchEvent>(targetArea, "touchmove");
  const touchend$ = fromEvent<TouchEvent>(targetArea, "touchend");
  return merge(touchstart$, touchmove$, touchend$);
}

export interface ObjectTrackingContext {
  knownObjects: KnownObject[];
}

export interface KnownObject {
  id: string;
  sides: [number, number, number]; // lengths of the 3 sides, incrementally sorted
}

export interface ObjectUpdate {
  id: string;
  type: "down" | "move" | "up";
  position: { x: number; y: number };
  rotation: number;
}

interface TouchPoint {
  id: number;
  x: number;
  y: number;
}

interface TrackedObjectState {
  id: string;
  signature: [number, number, number];
  points?: [TouchPoint, TouchPoint, TouchPoint];
  position?: { x: number; y: number };
  rotation?: number;
  isActive: boolean;
}

const SIGNATURE_TOLERANCE_RATIO = 0.3;
const MATCH_DISTANCE_RATIO = 0.6;

export function getObjectEvents(rawEvents$: Observable<TouchEvent>, context: ObjectTrackingContext): Observable<ObjectUpdate> {
  return new Observable<ObjectUpdate>((subscriber) => {
    const touchPoints = new Map<number, TouchPoint>();
    const objectStates = new Map<string, TrackedObjectState>(
      context.knownObjects.map((obj) => [obj.id, { id: obj.id, signature: obj.sides, isActive: false }])
    );

    const subscription = rawEvents$.subscribe((event) => {
      event.preventDefault();
      const target = event.target as HTMLElement | null;
      const rect = target?.getBoundingClientRect();

      if (event.type === "touchstart" || event.type === "touchmove") {
        for (let i = 0; i < event.touches.length; i++) {
          const touch = event.touches[i];
          touchPoints.set(touch.identifier, {
            id: touch.identifier,
            x: rect ? touch.clientX - rect.left : touch.clientX,
            y: rect ? touch.clientY - rect.top : touch.clientY,
          });
        }
      }

      if (event.type === "touchend") {
        for (let i = 0; i < event.changedTouches.length; i++) {
          const touch = event.changedTouches[i];
          touchPoints.delete(touch.identifier);
        }
      }

      const updates = computeObjectUpdates(Array.from(touchPoints.values()), objectStates);
      updates.forEach((update) => subscriber.next(update));
    });

    return () => subscription.unsubscribe();
  });
}

function computeObjectUpdates(touches: TouchPoint[], objectStates: Map<string, TrackedObjectState>): ObjectUpdate[] {
  const updates: ObjectUpdate[] = [];
  const usedTouchIds = new Set<number>();
  const assignments = assignTouchesToObjects(touches, objectStates, usedTouchIds);

  for (const state of objectStates.values()) {
    const assignedTouches = assignments.get(state.id);
    let nextPoints = state.points;
    let hasMatch = false;

    if (assignedTouches) {
      nextPoints = state.points
        ? mergeTouchesWithPoints(state.points, assignedTouches)
        : (assignedTouches.map((touch) => ({ ...touch })) as [TouchPoint, TouchPoint, TouchPoint]);
      hasMatch = true;
    } else if (state.points) {
      const { points, matchedIds } = updatePointsFromNearbyTouches(state, touches, usedTouchIds);
      if (matchedIds.size > 0) {
        matchedIds.forEach((id) => usedTouchIds.add(id));
        nextPoints = points;
        hasMatch = true;
      }
    }

    if (hasMatch && nextPoints) {
      const position = getCentroid(nextPoints);
      const rotation = getRotation(nextPoints, state.rotation);
      const type = state.isActive ? "move" : "down";

      state.points = nextPoints;
      state.position = position;
      state.rotation = rotation;
      state.isActive = true;

      updates.push({
        id: state.id,
        type,
        position,
        rotation,
      });
      continue;
    }

    if (state.isActive) {
      updates.push({
        id: state.id,
        type: "up",
        position: state.position ?? { x: 0, y: 0 },
        rotation: state.rotation ?? 0,
      });
    }

    state.isActive = false;
  }

  return updates;
}

function assignTouchesToObjects(
  touches: TouchPoint[],
  objectStates: Map<string, TrackedObjectState>,
  usedTouchIds: Set<number>
): Map<string, TouchPoint[]> {
  const assignments = new Map<string, TouchPoint[]>();
  if (touches.length < 3) return assignments;

  const candidates: Array<{ objectId: string; points: TouchPoint[]; score: number }> = [];
  const combinations = buildTouchCombinations(touches);

  for (const state of objectStates.values()) {
    for (const combo of combinations) {
      const signatureScore = getSignatureScore(combo, state.signature);
      if (signatureScore > SIGNATURE_TOLERANCE_RATIO) continue;
      const center = getCentroid(combo);
      const distancePenalty = state.position ? getDistance(center, state.position) / Math.max(...state.signature) : 0;
      const score = signatureScore + distancePenalty * 0.35;
      candidates.push({ objectId: state.id, points: combo, score });
    }
  }

  candidates.sort((a, b) => a.score - b.score);

  for (const candidate of candidates) {
    if (assignments.has(candidate.objectId)) continue;
    if (candidate.points.some((point) => usedTouchIds.has(point.id))) continue;
    assignments.set(candidate.objectId, candidate.points);
    candidate.points.forEach((point) => usedTouchIds.add(point.id));
  }

  return assignments;
}

function buildTouchCombinations(touches: TouchPoint[]): TouchPoint[][] {
  const combinations: TouchPoint[][] = [];
  for (let i = 0; i < touches.length - 2; i++) {
    for (let j = i + 1; j < touches.length - 1; j++) {
      for (let k = j + 1; k < touches.length; k++) {
        combinations.push([touches[i], touches[j], touches[k]]);
      }
    }
  }
  return combinations;
}

function mergeTouchesWithPoints(previous: [TouchPoint, TouchPoint, TouchPoint], touches: TouchPoint[]): [TouchPoint, TouchPoint, TouchPoint] {
  const updated = previous.map((point) => ({ ...point })) as [TouchPoint, TouchPoint, TouchPoint];
  const usedIndices = new Set<number>();

  for (const touch of touches) {
    let bestIndex = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let i = 0; i < updated.length; i++) {
      if (usedIndices.has(i)) continue;
      const distance = getDistance(touch, updated[i]);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = i;
      }
    }
    if (bestIndex >= 0) {
      updated[bestIndex] = { ...touch };
      usedIndices.add(bestIndex);
    }
  }

  return updated;
}

function updatePointsFromNearbyTouches(
  state: TrackedObjectState,
  touches: TouchPoint[],
  usedTouchIds: Set<number>
): { points: [TouchPoint, TouchPoint, TouchPoint]; matchedIds: Set<number> } {
  const points = (state.points ?? []) as [TouchPoint, TouchPoint, TouchPoint];
  const matchedIds = new Set<number>();
  const updated = points.map((point) => ({ ...point })) as [TouchPoint, TouchPoint, TouchPoint];
  const maxDistance = Math.max(...state.signature) * MATCH_DISTANCE_RATIO;
  const availableTouches = touches.filter((touch) => !usedTouchIds.has(touch.id));
  const usedIndices = new Set<number>();

  for (const touch of availableTouches) {
    let bestIndex = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let i = 0; i < updated.length; i++) {
      if (usedIndices.has(i)) continue;
      const distance = getDistance(touch, updated[i]);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = i;
      }
    }

    if (bestIndex >= 0 && bestDistance <= maxDistance) {
      updated[bestIndex] = { ...touch };
      matchedIds.add(touch.id);
      usedIndices.add(bestIndex);
    }
  }

  return { points: updated, matchedIds };
}

function getSignatureScore(points: TouchPoint[], signature: [number, number, number]): number {
  const sides = calculateSides(points);
  const diffs = sides.map((side, index) => Math.abs(side - signature[index]) / signature[index]);
  return diffs.reduce((sum, value) => sum + value, 0) / diffs.length;
}

function calculateSides(points: TouchPoint[]): [number, number, number] {
  const d01 = getDistance(points[0], points[1]);
  const d12 = getDistance(points[1], points[2]);
  const d20 = getDistance(points[2], points[0]);
  const sides = [d01, d12, d20].sort((a, b) => a - b);
  return [sides[0], sides[1], sides[2]];
}

function getCentroid(points: TouchPoint[]): { x: number; y: number } {
  const sum = points.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
}

function getRotation(points: TouchPoint[], previousRotation?: number): number {
  const distances = [
    { i: 0, j: 1, dist: getDistance(points[0], points[1]) },
    { i: 1, j: 2, dist: getDistance(points[1], points[2]) },
    { i: 2, j: 0, dist: getDistance(points[2], points[0]) },
  ];
  distances.sort((a, b) => b.dist - a.dist);
  const { i, j } = distances[0];
  const baseAngle = Math.atan2(points[j].y - points[i].y, points[j].x - points[i].x);
  if (previousRotation === undefined) return baseAngle;

  // Avoid sudden 180° flips by choosing the angle closest to the previous rotation.
  const flipped = normalizeAngle(baseAngle + Math.PI);
  const baseDelta = Math.abs(normalizeAngle(baseAngle - previousRotation));
  const flippedDelta = Math.abs(normalizeAngle(flipped - previousRotation));
  return flippedDelta < baseDelta ? flipped : baseAngle;
}

function getDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function normalizeAngle(angle: number): number {
  let normalized = angle;
  while (normalized > Math.PI) normalized -= Math.PI * 2;
  while (normalized < -Math.PI) normalized += Math.PI * 2;
  return normalized;
}
