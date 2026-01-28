```js
/**
 * Touch Tracking Module
 * Handles capacitive touch-based 3-point object tracking for mentor objects
 * Replaces ArUco marker tracking with direct touch input
 */

// ============================================================
// CONFIGURATION & OBJECT DEFINITIONS
// ============================================================

/**
 * Object definitions for the two puck types.
 * Each puck has 3 conductive legs. We store the 3 leg-to-leg distances
 * sorted from smallest to largest: [short, medium, long]
 * Orientation is based on the longest edge (front direction).
 */
const TOUCH_OBJECT_DEFS = {
  blue: {
    name: "Blue",
    legDistances: [26.5, 37.1, 49.7], // [short, medium, long] distances in mm
    color: "blue",
  },
  red: {
    name: "Red",
    legDistances: [22.4, 44.7, 53.3], // [short, medium, long] distances in mm
    color: "red",
  },
};

/**
 * Load calibrated object definitions from localStorage.
 * Calibration data is saved by the calibration.html interface.
 * This allows custom leg distances to persist across sessions.
 */
const CALIBRATION_STORAGE_KEY = "touch_object_calibration";

function loadCalibratedObjectDefs() {
  try {
    const stored = localStorage.getItem(CALIBRATION_STORAGE_KEY);
    if (stored) {
      const calibration = JSON.parse(stored);
      // Merge calibrated legDistances into defaults
      for (const [key, values] of Object.entries(calibration)) {
        if (TOUCH_OBJECT_DEFS[key] && values.legDistances) {
          TOUCH_OBJECT_DEFS[key].legDistances = values.legDistances;
          console.log(`Loaded calibration for ${key}:`, values.legDistances);
        }
      }
    }
  } catch (e) {
    console.warn("Could not load calibration from localStorage:", e);
  }
}

// Load calibration on script initialization
loadCalibratedObjectDefs();

/**
 * Runtime configuration
 */
const TOUCH_CONFIG = {
  pxPerMm: 3,
  distanceToleranceMm: 2,
  legCenterJitterMm: 2.5,
  gatingRadiusMm: 20,
  smoothingCenterAlpha: 0.35,
  smoothingOriAlpha: 0.25,
  angleDeadbandDeg: 5,
  quantizationStepMm: 0.5,
  scoreThreshold: 1,
  ambiguityMargin: 0.15,
  minLegDistMm: 5,
  maxLegDistMm: 70,
};

// ============================================================
// GLOBAL STATE
// ============================================================

// Active touches map: touchId -> {x, y, id}
const activeTouches = new Map();

// Tracked objects: trackId -> trackState
const trackedObjects = new Map();
let nextTrackId = 1;

// Timing
let lastFrameTime = performance.now();

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/** Euclidean distance between two points */
function dist(p1, p2) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Distance in mm */
function distMm(p1, p2) {
  return dist(p1, p2) / TOUCH_CONFIG.pxPerMm;
}

/** Quantize a value to nearest step (if step > 0) */
function quantize(value, step) {
  if (step <= 0) return value;
  return Math.round(value / step) * step;
}

/** Linear interpolation */
function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Lerp for 2D points */
function lerpPoint(p1, p2, t) {
  return {
    x: lerp(p1.x, p2.x, t),
    y: lerp(p1.y, p2.y, t),
  };
}

/** Normalize a 2D vector */
function normalize(v) {
  const len = Math.sqrt(v.x * v.x + v.y * v.y);
  if (len < 0.0001) return { x: 1, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

/** Angle between two unit vectors in degrees */
function angleBetween(v1, v2) {
  const dot = v1.x * v2.x + v1.y * v2.y;
  const clampedDot = Math.max(-1, Math.min(1, dot));
  return (Math.acos(clampedDot) * 180) / Math.PI;
}

/** Midpoint of two points */
function midpoint(p1, p2) {
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
  };
}

/** Compute effective tolerance including jitter */
function getEffectiveTolerance() {
  return TOUCH_CONFIG.distanceToleranceMm + 2 * TOUCH_CONFIG.legCenterJitterMm;
}

// ============================================================
// TOUCH EVENT HANDLING
// ============================================================

/**
 * Handle touch start event
 */
function handleTouchStart(e) {
  for (const touch of e.changedTouches) {
    activeTouches.set(touch.identifier, {
      x: touch.clientX,
      y: touch.clientY,
      id: touch.identifier,
    });
  }
}

/**
 * Handle touch move event
 */
function handleTouchMove(e) {
  for (const touch of e.changedTouches) {
    if (activeTouches.has(touch.identifier)) {
      activeTouches.set(touch.identifier, {
        x: touch.clientX,
        y: touch.clientY,
        id: touch.identifier,
      });
    }
  }
}

/**
 * Handle touch end event
 */
function handleTouchEnd(e) {
  for (const touch of e.changedTouches) {
    activeTouches.delete(touch.identifier);
  }
}

/**
 * Check if target is a UI element that should receive normal touch behavior
 * Note: We want to TRACK touches on calibration canvas, so don't include the whole overlay
 */
function isUIElement(target) {
  if (!target) return false;
  // Check for interactive elements
  if (target.tagName === "BUTTON" || target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
    return true;
  }
  // Check for UI containers (but NOT the calibration canvas area - we want to track touches there)
  if (
    target.closest(".controls") ||
    target.closest(".toolbar") ||
    target.closest(".prompt-modal") ||
    target.closest(".calibration-panel") ||
    target.closest(".calibration-side-panel")
  ) {
    return true;
  }
  return false;
}

/**
 * Initialize touch event listeners on a target element
 * Uses Pointer Events API for better gesture control on Windows touch
 */
function initTouchListeners(targetElement) {
  // === POINTER EVENTS (better Windows touch support) ===
  // Using pointer events with setPointerCapture to prevent browser gestures

  targetElement.addEventListener(
    "pointerdown",
    (e) => {
      if (isUIElement(e.target)) return;
      if (e.pointerType !== "touch") return; // Only handle touch, not mouse

      e.preventDefault();

      // Capture pointer to this element - this is the key to preventing browser gestures
      try {
        targetElement.setPointerCapture(e.pointerId);
      } catch (err) {}

      // Store in activeTouches (same format as touch events)
      activeTouches.set(e.pointerId, {
        x: e.clientX,
        y: e.clientY,
        id: e.pointerId,
      });
    },
    { passive: false }
  );

  targetElement.addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType !== "touch") return;
      if (!activeTouches.has(e.pointerId)) return;

      e.preventDefault();

      // Update position
      activeTouches.set(e.pointerId, {
        x: e.clientX,
        y: e.clientY,
        id: e.pointerId,
      });
    },
    { passive: false }
  );

  targetElement.addEventListener(
    "pointerup",
    (e) => {
      if (e.pointerType !== "touch") return;

      activeTouches.delete(e.pointerId);
      try {
        targetElement.releasePointerCapture(e.pointerId);
      } catch (err) {}
    },
    { passive: false }
  );

  targetElement.addEventListener(
    "pointercancel",
    (e) => {
      if (e.pointerType !== "touch") return;

      activeTouches.delete(e.pointerId);
      try {
        targetElement.releasePointerCapture(e.pointerId);
      } catch (err) {}
    },
    { passive: false }
  );

  // Also handle "lost pointer capture" which can happen if browser takes over
  targetElement.addEventListener(
    "lostpointercapture",
    (e) => {
      if (e.pointerType !== "touch") return;
      // Re-capture if we still want this pointer
      if (activeTouches.has(e.pointerId)) {
        try {
          targetElement.setPointerCapture(e.pointerId);
        } catch (err) {}
      }
    },
    { passive: false }
  );

  // Backup: prevent default on touch events too
  targetElement.addEventListener(
    "touchstart",
    (e) => {
      if (!isUIElement(e.target)) e.preventDefault();
    },
    { passive: false }
  );

  targetElement.addEventListener(
    "touchmove",
    (e) => {
      if (!isUIElement(e.target)) e.preventDefault();
    },
    { passive: false }
  );

  targetElement.addEventListener(
    "touchend",
    (e) => {
      if (!isUIElement(e.target)) e.preventDefault();
    },
    { passive: false }
  );

  // Prevent gestures and zoom
  document.addEventListener("gesturestart", (e) => e.preventDefault(), { passive: false });
  document.addEventListener("gesturechange", (e) => e.preventDefault(), { passive: false });
  document.addEventListener(
    "wheel",
    (e) => {
      if (e.ctrlKey) e.preventDefault();
    },
    { passive: false }
  );
}

// ============================================================
// OBJECT CLASSIFICATION
// ============================================================

/**
 * Classify a triple of points to determine object type.
 * Uses leg-to-leg distances sorted [short, medium, long] for matching.
 * Orientation is along the longest edge.
 *
 * @param {Object[]} triple - Array of 3 points [{x, y, id}, ...]
 * @returns {Object|null} Classification result or null if no match
 */
function classifyTriple(triple) {
  const [p1, p2, p3] = triple;
  const effectiveTol = getEffectiveTolerance();

  // Calculate all three leg-to-leg distances
  let d12 = distMm(p1, p2);
  let d13 = distMm(p1, p3);
  let d23 = distMm(p2, p3);

  // Quantize if enabled
  if (TOUCH_CONFIG.quantizationStepMm > 0) {
    d12 = quantize(d12, TOUCH_CONFIG.quantizationStepMm);
    d13 = quantize(d13, TOUCH_CONFIG.quantizationStepMm);
    d23 = quantize(d23, TOUCH_CONFIG.quantizationStepMm);
  }

  // Create array of distances with their edge info
  const edges = [
    { dist: d12, p1: p1, p2: p2, other: p3 },
    { dist: d13, p1: p1, p2: p3, other: p2 },
    { dist: d23, p1: p2, p2: p3, other: p1 },
  ];

  // Sort edges by distance (smallest to largest)
  edges.sort((a, b) => a.dist - b.dist);
  const sortedDistances = edges.map((e) => e.dist);
  const longestEdge = edges[2]; // The longest edge for orientation

  let bestResult = null;
  let bestScore = Infinity;
  let secondBestScore = Infinity;
  let secondBestType = null;

  // Compare to each object type
  for (const [type, def] of Object.entries(TOUCH_OBJECT_DEFS)) {
    const expected = def.legDistances; // [short, medium, long]

    // Calculate total error across all three distances
    const rawError = Math.abs(sortedDistances[0] - expected[0]) + Math.abs(sortedDistances[1] - expected[1]) + Math.abs(sortedDistances[2] - expected[2]);
    const normalizedScore = rawError / effectiveTol;

    if (normalizedScore < bestScore) {
      secondBestScore = bestScore;
      secondBestType = bestResult ? bestResult.type : null;

      bestScore = normalizedScore;
      bestResult = {
        type,
        sortedDistances,
        edges,
        longestEdge,
        normalizedScore,
        triple,
      };
    } else if (normalizedScore < secondBestScore) {
      secondBestScore = normalizedScore;
      secondBestType = type;
    }
  }

  if (!bestResult) return null;

  // Check if score is acceptable
  if (bestResult.normalizedScore > TOUCH_CONFIG.scoreThreshold) {
    return null;
  }

  // Check for ambiguity (two types too close in score)
  const isAmbiguous = secondBestScore - bestScore < TOUCH_CONFIG.ambiguityMargin && secondBestType !== bestResult.type;

  bestResult.isAmbiguous = isAmbiguous;

  // Compute object center (centroid of the three legs)
  bestResult.center = {
    x: (p1.x + p2.x + p3.x) / 3,
    y: (p1.y + p2.y + p3.y) / 3,
  };

  // Compute orientation along the longest edge
  // Direction is from one end to the other, consistent based on the third point
  const edgeP1 = longestEdge.p1;
  const edgeP2 = longestEdge.p2;
  const otherPoint = longestEdge.other;

  // Get edge direction vector
  let edgeDir = { x: edgeP2.x - edgeP1.x, y: edgeP2.y - edgeP1.y };

  // Use cross product to ensure consistent direction:
  // Front should point "away" from the third point (other)
  // Cross product tells us which side the other point is on
  const edgeMidpoint = midpoint(edgeP1, edgeP2);
  const toOther = { x: otherPoint.x - edgeMidpoint.x, y: otherPoint.y - edgeMidpoint.y };

  // 2D cross product: if negative, flip the direction
  const cross = edgeDir.x * toOther.y - edgeDir.y * toOther.x;
  if (cross < 0) {
    edgeDir = { x: -edgeDir.x, y: -edgeDir.y };
  }

  // Rotate 90 degrees to get perpendicular "front" direction (away from other point)
  // Perpendicular to edge, pointing away from the third leg
  const perpDir = { x: -edgeDir.y, y: edgeDir.x };
  const toOtherDot = perpDir.x * toOther.x + perpDir.y * toOther.y;

  // If perpDir points toward other, flip it
  let frontDir = perpDir;
  if (toOtherDot > 0) {
    frontDir = { x: -perpDir.x, y: -perpDir.y };
  }

  bestResult.orientation = normalize(frontDir);

  return bestResult;
}

// ============================================================
// TRIPLE GROUPING & SELECTION
// ============================================================

/**
 * Generate all valid candidate triples from touch points.
 *
 * @param {Object[]} points - Array of touch points
 * @returns {Object[][]} Array of valid triples
 */
function generateCandidateTriples(points) {
  const candidates = [];
  const n = points.length;

  if (n < 3) return candidates;

  const minDistPx = TOUCH_CONFIG.minLegDistMm * TOUCH_CONFIG.pxPerMm;
  const maxDistPx = TOUCH_CONFIG.maxLegDistMm * TOUCH_CONFIG.pxPerMm;

  // Generate all combinations of 3 points
  for (let i = 0; i < n - 2; i++) {
    for (let j = i + 1; j < n - 1; j++) {
      for (let k = j + 1; k < n; k++) {
        const triple = [points[i], points[j], points[k]];

        // Check all pairwise distances
        const d12 = dist(points[i], points[j]);
        const d13 = dist(points[i], points[k]);
        const d23 = dist(points[j], points[k]);

        // All distances must be within bounds
        if (d12 >= minDistPx && d12 <= maxDistPx && d13 >= minDistPx && d13 <= maxDistPx && d23 >= minDistPx && d23 <= maxDistPx) {
          candidates.push(triple);
        }
      }
    }
  }

  return candidates;
}

/**
 * Select non-overlapping triples that minimize total score.
 *
 * @param {Object[]} classifications - Array of classification results
 * @returns {Object[]} Selected non-overlapping classifications
 */
function selectNonOverlappingTriples(classifications) {
  const selected = [];
  const usedTouchIds = new Set();

  // Calculate how many touches each classification shares with existing tracks
  for (const cls of classifications) {
    const touchIds = cls.triple.map((p) => p.id);
    let bestTrackMatch = 0;
    let matchedTrackType = null;

    for (const track of trackedObjects.values()) {
      const sharedCount = touchIds.filter((id) => track.touchIds.has(id)).length;
      if (sharedCount > bestTrackMatch) {
        bestTrackMatch = sharedCount;
        matchedTrackType = track.objectType;
      }
    }

    cls.trackMatchCount = bestTrackMatch;
    cls.matchedTrackType = matchedTrackType;

    // Bonus if detection type matches the track it's associated with
    cls.typeMatchBonus = matchedTrackType === cls.type ? 1 : 0;
  }

  // Sort by: 1) track match count (desc), 2) type match bonus (desc), 3) score (asc)
  const sorted = [...classifications].sort((a, b) => {
    if (b.trackMatchCount !== a.trackMatchCount) {
      return b.trackMatchCount - a.trackMatchCount;
    }
    if (b.typeMatchBonus !== a.typeMatchBonus) {
      return b.typeMatchBonus - a.typeMatchBonus;
    }
    return a.normalizedScore - b.normalizedScore;
  });

  for (const cls of sorted) {
    const touchIds = cls.triple.map((p) => p.id);
    const hasOverlap = touchIds.some((id) => usedTouchIds.has(id));

    if (!hasOverlap) {
      selected.push(cls);
      touchIds.forEach((id) => usedTouchIds.add(id));
    }
  }

  return selected;
}

// ============================================================
// TRACKING SYSTEM
// ============================================================

/**
 * Associate detected objects with existing tracks.
 *
 * @param {Object[]} detections - Current frame detections
 * @param {number} dt - Time delta in seconds
 */
function updateTracks(detections, dt) {
  const now = performance.now();
  const gatingRadiusPx = TOUCH_CONFIG.gatingRadiusMm * TOUCH_CONFIG.pxPerMm;

  // Predict track positions
  for (const track of trackedObjects.values()) {
    track.predictedCenter = {
      x: track.center.x + track.velocity.x * dt,
      y: track.center.y + track.velocity.y * dt,
    };
  }

  // Match detections to tracks
  const matchedTrackIds = new Set();
  const matchedDetectionIndices = new Set();

  // First pass: try to match existing tracks
  for (const [trackId, track] of trackedObjects) {
    let bestMatchIdx = -1;
    let bestMatchScore = Infinity;

    for (let i = 0; i < detections.length; i++) {
      if (matchedDetectionIndices.has(i)) continue;

      const det = detections[i];
      const d = dist(track.predictedCenter, det.center);

      if (d > gatingRadiusPx) continue;

      const detTouchIds = det.triple.map((p) => p.id);
      const sharedTouches = detTouchIds.filter((id) => track.touchIds.has(id)).length;

      let score = d;
      const touchBonus = 1 - sharedTouches * 0.3;
      score *= touchBonus;

      if (det.type !== track.objectType) {
        score *= 1.5;
      }

      if (score < bestMatchScore) {
        bestMatchScore = score;
        bestMatchIdx = i;
      }
    }

    if (bestMatchIdx >= 0) {
      const det = detections[bestMatchIdx];
      updateTrackFromDetection(track, det, dt, now);
      matchedTrackIds.add(trackId);
      matchedDetectionIndices.add(bestMatchIdx);
    }
  }

  // Update unmatched tracks
  for (const [trackId, track] of trackedObjects) {
    if (!matchedTrackIds.has(trackId)) {
      track.missedFrames++;

      const timeSinceSeen = now - track.lastSeenTime;
      if (timeSinceSeen > 200 || track.missedFrames > 5) {
        trackedObjects.delete(trackId);
      }
    }
  }

  // Create new tracks for unmatched detections
  for (let i = 0; i < detections.length; i++) {
    if (matchedDetectionIndices.has(i)) continue;

    const det = detections[i];
    // Allow ambiguous detections to create tracks with lower confidence
    createTrack(det, now, det.isAmbiguous);
  }
}

/**
 * Update an existing track with new detection data.
 */
function updateTrackFromDetection(track, det, dt, now) {
  const newVelocity = {
    x: (det.center.x - track.center.x) / dt,
    y: (det.center.y - track.center.y) / dt,
  };
  track.velocity = {
    x: lerp(track.velocity.x, newVelocity.x, 0.3),
    y: lerp(track.velocity.y, newVelocity.y, 0.3),
  };

  track.center = det.center;
  track.orientation = det.orientation;
  track.lastSeenTime = now;
  track.lastScore = det.normalizedScore;
  track.missedFrames = 0;
  track.touchIds = new Set(det.triple.map((p) => p.id));
  track.detection = det;

  // Smooth center
  track.smoothedCenter = lerpPoint(track.smoothedCenter, det.center, TOUCH_CONFIG.smoothingCenterAlpha);

  // Smooth orientation with deadband
  const angleDiff = angleBetween(track.smoothedOrientation, det.orientation);
  if (angleDiff > TOUCH_CONFIG.angleDeadbandDeg) {
    const newOri = {
      x: lerp(track.smoothedOrientation.x, det.orientation.x, TOUCH_CONFIG.smoothingOriAlpha),
      y: lerp(track.smoothedOrientation.y, det.orientation.y, TOUCH_CONFIG.smoothingOriAlpha),
    };
    track.smoothedOrientation = normalize(newOri);
  }

  // Track type confidence
  if (det.type === track.objectType) {
    track.typeConfidence = Math.min(track.typeConfidence + 1, 30);
  } else {
    track.typeConfidence--;
    if (track.typeConfidence <= 0) {
      track.objectType = det.type;
      track.typeConfidence = 5;
    }
  }
}

/**
 * Create a new track from a detection.
 */
function createTrack(det, now, isAmbiguous = false) {
  const track = {
    trackId: nextTrackId++,
    objectType: det.type,
    center: { ...det.center },
    velocity: { x: 0, y: 0 },
    orientation: { ...det.orientation },
    lastSeenTime: now,
    lastScore: det.normalizedScore,
    missedFrames: 0,
    touchIds: new Set(det.triple.map((p) => p.id)),
    smoothedCenter: { ...det.center },
    smoothedOrientation: { ...det.orientation },
    typeConfidence: isAmbiguous ? 3 : 10, // Lower confidence for ambiguous initial detection
    detection: det,
  };

  trackedObjects.set(track.trackId, track);
}

// ============================================================
// MAIN DETECTION PIPELINE
// ============================================================

/**
 * Run the detection pipeline for the current frame
 * @param {number} dt - Time delta in seconds
 * @returns {Object} Detection results
 */
function runDetectionPipeline(dt) {
  const points = [...activeTouches.values()];

  // Debug: log touch count periodically
  if (points.length >= 3 && Math.random() < 0.02) {
    console.log(`[TouchTracking] ${points.length} touches detected`);
  }

  // Generate candidate triples
  const candidateTriples = generateCandidateTriples(points);

  // Classify each triple
  const classifications = [];
  for (const triple of candidateTriples) {
    const cls = classifyTriple(triple);
    if (cls) {
      classifications.push(cls);
      // Debug: log successful classification
      if (Math.random() < 0.05) {
        console.log(
          `[TouchTracking] Classified as ${cls.type}, score: ${cls.normalizedScore.toFixed(2)}, distances: [${cls.sortedDistances
            .map((d) => d.toFixed(1))
            .join(", ")}]`
        );
      }
    }
  }

  // Debug: log if we have 3 touches but no classification
  if (points.length === 3 && classifications.length === 0 && Math.random() < 0.02) {
    const [p1, p2, p3] = points;
    const d12 = distMm(p1, p2);
    const d13 = distMm(p1, p3);
    const d23 = distMm(p2, p3);
    const sorted = [d12, d13, d23].sort((a, b) => a - b);
    console.log(`[TouchTracking] 3 touches but NO MATCH. Measured distances: [${sorted.map((d) => d.toFixed(1)).join(", ")}] mm`);
    console.log(
      `[TouchTracking] Expected - Red: [${TOUCH_OBJECT_DEFS.red.legDistances.join(", ")}], Blue: [${TOUCH_OBJECT_DEFS.blue.legDistances.join(", ")}]`
    );
    console.log(`[TouchTracking] Tolerance: ${getEffectiveTolerance().toFixed(1)} mm, Score threshold: ${TOUCH_CONFIG.scoreThreshold}`);
  }

  // Select non-overlapping triples
  const selectedDetections = selectNonOverlappingTriples(classifications);

  // Update tracking
  updateTracks(selectedDetections, dt);

  return { points, selectedDetections };
}

/**
 * Process frame - call this in the animation loop
 */
function processFrame() {
  const now = performance.now();
  const dt = Math.min((now - lastFrameTime) / 1000, 0.1);
  lastFrameTime = now;

  return runDetectionPipeline(dt);
}

// ============================================================
// PUBLIC API - Compatible with existing mentor system
// ============================================================

/**
 * Get tracked position for a specific color/mentor
 * @param {string} color - 'red' or 'blue'
 * @returns {Object|null} Position {x, y} or null if not tracked
 */
function getTrackedPosition(color) {
  for (const track of trackedObjects.values()) {
    if (track.objectType === color) {
      return { ...track.smoothedCenter };
    }
  }
  return null;
}

/**
 * Get tracked orientation angle for a specific color/mentor
 * @param {string} color - 'red' or 'blue'
 * @returns {number|null} Angle in radians or null if not tracked
 */
function getTrackedOrientation(color) {
  for (const track of trackedObjects.values()) {
    if (track.objectType === color) {
      // Convert unit vector to angle in radians
      return Math.atan2(track.smoothedOrientation.y, track.smoothedOrientation.x);
    }
  }
  return null;
}

/**
 * Check if a specific color object is currently tracked
 * @param {string} color - 'red' or 'blue'
 * @returns {boolean} True if tracked
 */
function isTracked(color) {
  for (const track of trackedObjects.values()) {
    if (track.objectType === color) {
      return true;
    }
  }
  return false;
}

/**
 * Get all tracked objects
 * @returns {Map} Map of trackId -> trackState
 */
function getTrackedObjects() {
  return trackedObjects;
}

/**
 * Get active touch points
 * @returns {Object[]} Array of touch points
 */
function getActiveTouches() {
  return [...activeTouches.values()];
}

/**
 * Get the current configuration
 */
function getConfig() {
  return { ...TOUCH_CONFIG };
}

/**
 * Update configuration values
 * @param {Object} newConfig - Configuration values to update
 */
function updateConfig(newConfig) {
  Object.assign(TOUCH_CONFIG, newConfig);
}

/**
 * Clear all tracking state
 */
function clearTracking() {
  trackedObjects.clear();
  activeTouches.clear();
  nextTrackId = 1;
}

// Export for use in main app
window.TouchTracking = {
  CONFIG: TOUCH_CONFIG,
  OBJECT_DEFS: TOUCH_OBJECT_DEFS,
  // Initialization
  initTouchListeners,
  // Processing
  processFrame,
  // Position/Orientation access (compatible with existing mentor system)
  getTrackedPosition,
  getTrackedOrientation,
  isTracked,
  // Additional access
  getTrackedObjects,
  getActiveTouches,
  // Configuration
  getConfig,
  updateConfig,
  // State management
  clearTracking,
};
```
