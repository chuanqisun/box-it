import { fromEvent, merge, Observable } from "rxjs";
import { getCanonicalRotation, getCentroid, calculateSortedSides } from "./geometry";

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
  /** Bounding box properties */
  boundingBox?: {
    width: number;
    height: number;
    xOffset: number;
    yOffset: number;
    orientationOffset: number;
  };
}

export interface ObjectUpdate {
  id: string;
  type: "down" | "move" | "up";
  position: { x: number; y: number };
  rotation: number;
  /** Confidence level: 1.0 = matched, 0 = no match */
  confidence: number;
  /** Number of currently active touch points for this object (always 3 when matched) */
  activePoints: number;
  /** Bounding box configuration for this object */
  boundingBox?: KnownObject["boundingBox"];
}

interface TouchPoint {
  id: number;
  x: number;
  y: number;
}

interface TrackedObjectState {
  id: string;
  signature: [number, number, number];
  boundingBox?: KnownObject["boundingBox"];
  isActive: boolean;
  position?: { x: number; y: number };
  rotation?: number;
}

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
          boundingBox: obj.boundingBox,
          isActive: false,
        },
      ])
    );

    const subscription = rawEvents$.subscribe((event) => {
      event.preventDefault();
      const rect = targetElement.getBoundingClientRect();

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

      const updates = detectObjects(Array.from(touchPoints.values()), objectStates);
      updates.forEach((update) => subscriber.next(update));
    });

    return () => subscription.unsubscribe();
  });
}

/**
 * Simple object detection using triangle side matching.
 * 
 * Algorithm:
 * 1. Generate all 3-point combinations from touch points
 * 2. Calculate sorted side lengths for each combination
 * 3. Find the closest match to each known object's signature
 * 4. Ensure no touch point is used by multiple objects
 */
function detectObjects(
  touches: TouchPoint[],
  objectStates: Map<string, TrackedObjectState>
): ObjectUpdate[] {
  const updates: ObjectUpdate[] = [];

  if (touches.length < 3) {
    // Not enough touches for any object - emit "up" for any active objects
    for (const state of objectStates.values()) {
      if (state.isActive) {
        updates.push({
          id: state.id,
          type: "up",
          position: state.position ?? { x: 0, y: 0 },
          rotation: state.rotation ?? 0,
          confidence: 0,
          activePoints: 0,
          boundingBox: state.boundingBox,
        });
        state.isActive = false;
      }
    }
    return updates;
  }

  // Generate all 3-point combinations
  const combinations = generateCombinations(touches);
  
  // Score each combination against each object and find best matches
  const matches = findBestMatches(combinations, objectStates);

  // Process matches and emit updates
  const matchedStateIds = new Set<string>();
  
  for (const match of matches) {
    const state = objectStates.get(match.stateId)!;
    matchedStateIds.add(match.stateId);
    
    const position = getCentroid(match.points);
    const rotation = getCanonicalRotation(match.points, state.rotation);
    const type = state.isActive ? "move" : "down";
    
    state.position = position;
    state.rotation = rotation;
    state.isActive = true;
    
    updates.push({
      id: state.id,
      type,
      position,
      rotation,
      confidence: 1.0,
      activePoints: 3,
      boundingBox: state.boundingBox,
    });
  }

  // Emit "up" for objects that were active but no longer matched
  for (const state of objectStates.values()) {
    if (state.isActive && !matchedStateIds.has(state.id)) {
      updates.push({
        id: state.id,
        type: "up",
        position: state.position ?? { x: 0, y: 0 },
        rotation: state.rotation ?? 0,
        confidence: 0,
        activePoints: 0,
        boundingBox: state.boundingBox,
      });
      state.isActive = false;
    }
  }

  return updates;
}

/**
 * Generate all 3-point combinations from touch points
 */
function generateCombinations(touches: TouchPoint[]): TouchPoint[][] {
  const combinations: TouchPoint[][] = [];
  const n = touches.length;
  
  for (let i = 0; i < n - 2; i++) {
    for (let j = i + 1; j < n - 1; j++) {
      for (let k = j + 1; k < n; k++) {
        combinations.push([touches[i], touches[j], touches[k]]);
      }
    }
  }
  
  return combinations;
}

/**
 * Calculate the total error between measured sides and expected signature.
 * Lower is better.
 */
function getSideError(points: TouchPoint[], signature: [number, number, number]): number {
  const sides = calculateSortedSides(points);
  return (
    Math.abs(sides[0] - signature[0]) +
    Math.abs(sides[1] - signature[1]) +
    Math.abs(sides[2] - signature[2])
  );
}

/** Maximum allowed total error across all 3 sides (in pixels) */
const MAX_TOTAL_ERROR_PX = 45;

/**
 * Find the best non-overlapping matches between combinations and objects.
 * Uses a simple greedy approach: sort all possible matches by error,
 * then pick the best one for each object ensuring no touch reuse.
 */
function findBestMatches(
  combinations: TouchPoint[][],
  objectStates: Map<string, TrackedObjectState>
): Array<{ stateId: string; points: TouchPoint[]; error: number }> {
  // Build all candidate matches with their errors
  const candidates: Array<{
    stateId: string;
    points: TouchPoint[];
    touchIds: Set<number>;
    error: number;
  }> = [];

  for (const [stateId, state] of objectStates) {
    for (const combo of combinations) {
      const error = getSideError(combo, state.signature);
      if (error <= MAX_TOTAL_ERROR_PX) {
        candidates.push({
          stateId,
          points: combo,
          touchIds: new Set(combo.map((p) => p.id)),
          error,
        });
      }
    }
  }

  // Sort by error (best matches first)
  candidates.sort((a, b) => a.error - b.error);

  // Greedily select non-overlapping matches
  const result: Array<{ stateId: string; points: TouchPoint[]; error: number }> = [];
  const usedTouchIds = new Set<number>();
  const matchedStateIds = new Set<string>();

  for (const candidate of candidates) {
    // Skip if this object already has a match
    if (matchedStateIds.has(candidate.stateId)) continue;
    
    // Skip if any touch point is already used
    let hasOverlap = false;
    for (const id of candidate.touchIds) {
      if (usedTouchIds.has(id)) {
        hasOverlap = true;
        break;
      }
    }
    if (hasOverlap) continue;

    // Accept this match
    result.push({
      stateId: candidate.stateId,
      points: candidate.points,
      error: candidate.error,
    });
    
    for (const id of candidate.touchIds) {
      usedTouchIds.add(id);
    }
    matchedStateIds.add(candidate.stateId);
  }

  return result;
}