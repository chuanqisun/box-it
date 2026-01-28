import { fromEvent, merge, Observable } from "rxjs";
import { getCanonicalRotation, getCentroid as getGeoCentroid, getDistance, normalizeAngle, calculateSortedSides } from "./geometry";

export function getInputRawEvent$(targetArea: HTMLElement): Observable<TouchEvent> {
  const touchstart$ = fromEvent<TouchEvent>(targetArea, "touchstart");
  const touchmove$ = fromEvent<TouchEvent>(targetArea, "touchmove");
  const touchend$ = fromEvent<TouchEvent>(targetArea, "touchend");
  return merge(touchstart$, touchmove$, touchend$);
}

export interface ObjectTrackingContext {
  knownObjects: KnownObject[];
}

/**
 * Represents a registered object with its touch signature and bounding box properties.
 * The 3-point touch signature defines a triangle, and the bounding box is positioned
 * relative to that triangle.
 */
export interface KnownObject {
  id: string;
  /** Lengths of the 3 sides of the touch triangle, sorted in ascending order */
  sides: [number, number, number];
  /** Bounding box width (perpendicular to the primary axis) */
  boundingBox?: {
    width: number;
    height: number;
    /** X offset from centroid in local coordinates (applied in the rotated coordinate frame) */
    xOffset: number;
    /** Y offset from centroid in local coordinates (applied in the rotated coordinate frame) */
    yOffset: number;
    /** Rotation offset in radians from the longest edge of the triangle */
    orientationOffset: number;
  };
}

export interface ObjectUpdate {
  id: string;
  type: "down" | "move" | "up";
  position: { x: number; y: number };
  rotation: number;
  /** Confidence level: 1.0 = all 3 points, 0.67 = 2 points, 0.33 = 1 point */
  confidence: number;
  /** Number of currently active touch points for this object */
  activePoints: number;
  /** Bounding box configuration for this object */
  boundingBox?: {
    width: number;
    height: number;
    xOffset: number;
    yOffset: number;
    orientationOffset: number;
  };
}

interface TouchPoint {
  id: number;
  x: number;
  y: number;
}

/** Confidence levels for different contact point scenarios */
const CONFIDENCE = {
  THREE_POINTS: 1.0,
  TWO_POINTS: 0.67,
  ONE_POINT: 0.33,
  PRESERVED: 0.1,
} as const;

interface TrackedObjectState {
  id: string;
  signature: [number, number, number];
  /** The 3 reconstructed/tracked points (may include predicted positions) */
  points?: [TouchPoint, TouchPoint, TouchPoint];
  /** Which point indices are currently backed by real touches */
  activePointIndices: Set<number>;
  /** Last known touch IDs for each point position */
  touchIds: [number | null, number | null, number | null];
  position?: { x: number; y: number };
  rotation?: number;
  /** Velocity for motion prediction */
  velocity: { x: number; y: number; rotation: number };
  confidence: number;
  isActive: boolean;
  lastUpdateTime: number;
  /** Bounding box configuration */
  boundingBox?: KnownObject["boundingBox"];
}

const SIGNATURE_TOLERANCE_RATIO = 0.35; // avg relative error allowed for side length matching (soft cap)
const MATCH_DISTANCE_RATIO = 0.6; // max distance ratio for reusing missing touch points
const VELOCITY_DECAY = 0.85; // decay factor for velocity when points are lost
const PREDICTION_MAX_TIME_MS = 100; // max time in ms to predict position using velocity
const PREDICTION_MAX_TIME_S = PREDICTION_MAX_TIME_MS / 1000; // same threshold in seconds for dt comparison

export function getObjectEvents(
  rawEvents$: Observable<TouchEvent>,
  context: ObjectTrackingContext,
  targetElement: HTMLElement
): Observable<ObjectUpdate> {
  return new Observable<ObjectUpdate>((subscriber) => {
    const touchPoints = new Map<number, TouchPoint>();
    const objectStates = new Map<string, TrackedObjectState>(
      context.knownObjects.map((obj) => [
        obj.id,
        {
          id: obj.id,
          signature: obj.sides,
          isActive: false,
          activePointIndices: new Set(),
          touchIds: [null, null, null],
          velocity: { x: 0, y: 0, rotation: 0 },
          confidence: 0,
          lastUpdateTime: 0,
          boundingBox: obj.boundingBox,
        },
      ])
    );

    const subscription = rawEvents$.subscribe((event) => {
      event.preventDefault();
      // Use the explicitly provided target element for consistent coordinate calculation
      // This ensures we always use the same reference element (e.g., the canvas)
      // rather than event.target which could be a child element
      const rect = targetElement.getBoundingClientRect();
      const now = performance.now();

      if (event.type === "touchstart" || event.type === "touchmove") {
        for (let i = 0; i < event.touches.length; i++) {
          const touch = event.touches[i];
          touchPoints.set(touch.identifier, {
            id: touch.identifier,
            x: touch.clientX - rect.left,
            y: touch.clientY - rect.top,
          });
        }
      }

      if (event.type === "touchend") {
        for (let i = 0; i < event.changedTouches.length; i++) {
          const touch = event.changedTouches[i];
          touchPoints.delete(touch.identifier);
        }
      }

      const updates = computeObjectUpdates(Array.from(touchPoints.values()), objectStates, now);
      updates.forEach((update) => subscriber.next(update));
    });

    return () => subscription.unsubscribe();
  });
}

function computeObjectUpdates(
  touches: TouchPoint[],
  objectStates: Map<string, TrackedObjectState>,
  now: number
): ObjectUpdate[] {
  const updates: ObjectUpdate[] = [];
  const usedTouchIds = new Set<number>();

  // Sort states by confidence to give priority to high-confidence objects
  const sortedStates = Array.from(objectStates.values()).sort((a, b) => b.confidence - a.confidence);

  for (const state of sortedStates) {
    const result = updateObjectState(state, touches, usedTouchIds, now);

    if (result) {
      updates.push(result);
    } else if (state.isActive) {
      // Object was active but now has no input - preserve last state with low confidence
      updates.push({
        id: state.id,
        type: "up",
        position: state.position ?? { x: 0, y: 0 },
        rotation: state.rotation ?? 0,
        confidence: CONFIDENCE.PRESERVED,
        activePoints: 0,
        boundingBox: state.boundingBox,
      });
      state.isActive = false;
      state.confidence = CONFIDENCE.PRESERVED;
    }
  }

  return updates;
}

function updateObjectState(
  state: TrackedObjectState,
  touches: TouchPoint[],
  usedTouchIds: Set<number>,
  now: number
): ObjectUpdate | null {
  const dt = state.lastUpdateTime > 0 ? (now - state.lastUpdateTime) / 1000 : 0;

  // Try to find a 3-point match first (highest confidence)
  const threePointMatch = findThreePointMatch(state, touches, usedTouchIds);
  if (threePointMatch) {
    const { points, touchIds } = threePointMatch;

    // Mark touches as used
    touchIds.forEach((id) => usedTouchIds.add(id));

    // Calculate new position and rotation
    const newPosition = getCentroid(points);
    const newRotation = getRotation(points, state.rotation);

    // Update velocity based on position change
    if (state.position && dt > 0) {
      state.velocity = {
        x: (newPosition.x - state.position.x) / dt,
        y: (newPosition.y - state.position.y) / dt,
        rotation: normalizeAngle(newRotation - (state.rotation ?? newRotation)) / dt,
      };
    }

    const type = state.isActive ? "move" : "down";

    state.points = points;
    state.touchIds = [touchIds[0], touchIds[1], touchIds[2]];
    state.activePointIndices = new Set([0, 1, 2]);
    state.position = newPosition;
    state.rotation = newRotation;
    state.confidence = CONFIDENCE.THREE_POINTS;
    state.isActive = true;
    state.lastUpdateTime = now;

    return {
      id: state.id,
      type,
      position: newPosition,
      rotation: newRotation,
      confidence: CONFIDENCE.THREE_POINTS,
      activePoints: 3,
      boundingBox: state.boundingBox,
    };
  }

  // If we have previous state, try to match with fewer points
  if (state.points && state.isActive) {
    const partialMatch = findPartialMatch(state, touches, usedTouchIds);

    if (partialMatch && partialMatch.matchedCount > 0) {
      const { updatedPoints, matchedIndices, matchedTouchIds } = partialMatch;

      // Mark touches as used
      matchedTouchIds.forEach((id) => usedTouchIds.add(id));

      // Update the matched points, keep others predicted
      const predictedPoints = predictUnmatchedPoints(
        updatedPoints,
        matchedIndices,
        state.velocity,
        dt
      );

      const newPosition = getCentroid(predictedPoints);
      const newRotation = getRotation(predictedPoints, state.rotation);

      // Decay velocity when using prediction
      state.velocity = {
        x: state.velocity.x * VELOCITY_DECAY,
        y: state.velocity.y * VELOCITY_DECAY,
        rotation: state.velocity.rotation * VELOCITY_DECAY,
      };

      const confidence =
        partialMatch.matchedCount === 2 ? CONFIDENCE.TWO_POINTS : CONFIDENCE.ONE_POINT;

      state.points = predictedPoints;
      state.activePointIndices = matchedIndices;
      state.position = newPosition;
      state.rotation = newRotation;
      state.confidence = confidence;
      state.lastUpdateTime = now;

      return {
        id: state.id,
        type: "move",
        position: newPosition,
        rotation: newRotation,
        confidence,
        activePoints: partialMatch.matchedCount,
        boundingBox: state.boundingBox,
      };
    }

    // No points matched - use pure prediction for a limited time
    if (dt > 0 && dt < PREDICTION_MAX_TIME_S) {
      const predictedPosition = {
        x: state.position!.x + state.velocity.x * dt,
        y: state.position!.y + state.velocity.y * dt,
      };
      const predictedRotation = state.rotation! + state.velocity.rotation * dt;

      // Decay velocity
      state.velocity = {
        x: state.velocity.x * VELOCITY_DECAY,
        y: state.velocity.y * VELOCITY_DECAY,
        rotation: state.velocity.rotation * VELOCITY_DECAY,
      };

      state.position = predictedPosition;
      state.rotation = predictedRotation;
      state.confidence = CONFIDENCE.PRESERVED;
      state.activePointIndices = new Set();
      state.lastUpdateTime = now;

      return {
        id: state.id,
        type: "move",
        position: predictedPosition,
        rotation: predictedRotation,
        confidence: CONFIDENCE.PRESERVED,
        activePoints: 0,
        boundingBox: state.boundingBox,
      };
    }
  }

  return null;
}

function findThreePointMatch(
  state: TrackedObjectState,
  touches: TouchPoint[],
  usedTouchIds: Set<number>
): { points: [TouchPoint, TouchPoint, TouchPoint]; touchIds: [number, number, number] } | null {
  if (touches.length < 3) return null;

  const availableTouches = touches.filter((t) => !usedTouchIds.has(t.id));
  if (availableTouches.length < 3) return null;

  const combinations = buildTouchCombinations(availableTouches);
  let bestMatch: {
    points: [TouchPoint, TouchPoint, TouchPoint];
    touchIds: [number, number, number];
    score: number;
  } | null = null;

  for (const combo of combinations) {
    const signatureScore = getSignatureScore(combo, state.signature);
    if (signatureScore > SIGNATURE_TOLERANCE_RATIO) continue;

    // Add distance penalty if we have a previous position
    const center = getCentroid(combo);
    const distancePenalty = state.position
      ? getDistance(center, state.position) / Math.max(...state.signature)
      : 0;
    const totalScore = signatureScore + distancePenalty * 0.35;

    if (!bestMatch || totalScore < bestMatch.score) {
      bestMatch = {
        points: combo as [TouchPoint, TouchPoint, TouchPoint],
        touchIds: [combo[0].id, combo[1].id, combo[2].id],
        score: totalScore,
      };
    }
  }

  return bestMatch;
}

function findPartialMatch(
  state: TrackedObjectState,
  touches: TouchPoint[],
  usedTouchIds: Set<number>
): {
  updatedPoints: [TouchPoint, TouchPoint, TouchPoint];
  matchedIndices: Set<number>;
  matchedTouchIds: Set<number>;
  matchedCount: number;
} | null {
  if (!state.points) return null;

  const availableTouches = touches.filter((t) => !usedTouchIds.has(t.id));
  if (availableTouches.length === 0) return null;

  const maxDistance = Math.max(...state.signature) * MATCH_DISTANCE_RATIO;
  const updatedPoints = state.points.map((p) => ({ ...p })) as [TouchPoint, TouchPoint, TouchPoint];
  const matchedIndices = new Set<number>();
  const matchedTouchIds = new Set<number>();
  const usedIndices = new Set<number>();

  // Sort touches by proximity to any of the existing points
  const touchWithBestMatch = availableTouches
    .map((touch) => {
      let bestDist = Infinity;
      let bestIndex = -1;
      for (let i = 0; i < state.points!.length; i++) {
        if (usedIndices.has(i)) continue;
        const dist = getDistance(touch, state.points![i]);
        if (dist < bestDist) {
          bestDist = dist;
          bestIndex = i;
        }
      }
      return { touch, bestDist, bestIndex };
    })
    .filter((m) => m.bestDist <= maxDistance)
    .sort((a, b) => a.bestDist - b.bestDist);

  for (const match of touchWithBestMatch) {
    if (usedIndices.has(match.bestIndex)) continue;

    updatedPoints[match.bestIndex] = { ...match.touch };
    matchedIndices.add(match.bestIndex);
    matchedTouchIds.add(match.touch.id);
    usedIndices.add(match.bestIndex);
  }

  if (matchedIndices.size === 0) return null;

  return {
    updatedPoints,
    matchedIndices,
    matchedTouchIds,
    matchedCount: matchedIndices.size,
  };
}

function predictUnmatchedPoints(
  points: [TouchPoint, TouchPoint, TouchPoint],
  matchedIndices: Set<number>,
  velocity: { x: number; y: number },
  dt: number
): [TouchPoint, TouchPoint, TouchPoint] {
  // For unmatched points, apply the same translation as the matched points would suggest
  // This keeps the triangle shape consistent
  const result = points.map((p, i) => {
    if (matchedIndices.has(i)) {
      return p; // Already updated with real touch
    }
    // Apply velocity-based prediction
    return {
      ...p,
      x: p.x + velocity.x * dt,
      y: p.y + velocity.y * dt,
    };
  }) as [TouchPoint, TouchPoint, TouchPoint];

  return result;
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

function getSignatureScore(points: TouchPoint[], signature: [number, number, number]): number {
  const sides = calculateSortedSides(points);
  const dx = sides[0] - signature[0];
  const dy = sides[1] - signature[1];
  const dz = sides[2] - signature[2];
  const distance = Math.hypot(dx, dy, dz);
  const normalization = Math.hypot(signature[0], signature[1], signature[2]) || 1;
  return distance / normalization;
}

// Re-export geometry functions for use within this module
// These are now imported from the geometry module for order-invariant behavior
function getCentroid(points: TouchPoint[]): { x: number; y: number } {
  return getGeoCentroid(points);
}

function getRotation(points: TouchPoint[], previousRotation?: number): number {
  return getCanonicalRotation(points, previousRotation);
}

// Note: calculateSides and getDistance are imported from geometry module
// and used directly via getSignatureScore
