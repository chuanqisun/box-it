/**
 * Pixel art emoji renderer.
 * Converts emoji characters to pixel art with customizable resolution and white outline.
 * Based on technique from https://github.com/chuanqisun/code/blob/master/emoji-to-pixel-art/index.html
 */

const DEFAULT_GRID_SIZE = 16;
const DEFAULT_OUTLINE_COLOR = "#ffffff";
const DEFAULT_SAMPLE_SIZE = 128;
const ALPHA_THRESHOLD = 128;
const COVERAGE_THRESHOLD = 0.25;

interface PixelArtOptions {
  /** Grid resolution (e.g., 16 for 16x16 pixels). Default: 16 */
  gridSize?: number;
  /** Whether to add an outline. Default: true */
  outline?: boolean;
  /** Outline color (CSS color string). Default: "#ffffff" */
  outlineColor?: string;
}

interface PixelData {
  r: number;
  g: number;
  b: number;
}

type PixelGrid = (PixelData | null)[][];

// Cache for rendered pixel art canvases
const pixelArtCache = new Map<string, HTMLCanvasElement>();

// Create offscreen canvas for processing
let processCanvas: HTMLCanvasElement | null = null;
let processCtx: CanvasRenderingContext2D | null = null;

function getProcessingContext(): CanvasRenderingContext2D {
  if (!processCanvas || !processCtx) {
    processCanvas = document.createElement("canvas");
    processCtx = processCanvas.getContext("2d", { willReadFrequently: true });
  }
  if (!processCtx) {
    throw new Error("Failed to get 2D context for pixel art processing");
  }
  return processCtx;
}

/**
 * Generate cache key for a pixel art configuration
 */
function getCacheKey(emoji: string, size: number, options: PixelArtOptions): string {
  const gridSize = options.gridSize ?? DEFAULT_GRID_SIZE;
  const outline = options.outline ?? true;
  const outlineColor = options.outlineColor ?? DEFAULT_OUTLINE_COLOR;
  return `${emoji}:${size}:${gridSize}:${outline}:${outlineColor}`;
}

/**
 * Convert an emoji character to a pixel art canvas.
 * @param emoji The emoji character(s) to convert
 * @param size The output size of the pixel art image (width and height)
 * @param options Pixel art rendering options
 * @returns A canvas containing the pixel art
 */
export function emojiToPixelArt(
  emoji: string,
  size: number,
  options: PixelArtOptions = {}
): HTMLCanvasElement {
  const cacheKey = getCacheKey(emoji, size, options);
  const cached = pixelArtCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const gridSize = options.gridSize ?? DEFAULT_GRID_SIZE;
  const outline = options.outline ?? true;
  const outlineColor = options.outlineColor ?? DEFAULT_OUTLINE_COLOR;

  const processCtx = getProcessingContext();
  const sampleSize = DEFAULT_SAMPLE_SIZE;

  processCanvas!.width = sampleSize;
  processCanvas!.height = sampleSize;

  // Render the emoji at high resolution
  processCtx.clearRect(0, 0, sampleSize, sampleSize);
  processCtx.filter = "none";
  processCtx.font = `${sampleSize * 0.9}px "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji", sans-serif`;
  processCtx.textAlign = "center";
  processCtx.textBaseline = "middle";
  processCtx.fillText(emoji, sampleSize / 2, sampleSize / 2 + sampleSize * 0.05);

  const pixelsOriginal = processCtx.getImageData(0, 0, sampleSize, sampleSize).data;

  // Smart downsampling to create the pixel grid
  const coreGrid = createPixelGrid(pixelsOriginal, sampleSize, gridSize);

  // Handle grid expansion for outline
  let finalGrid: PixelGrid;
  let finalGridSize: number;

  if (outline) {
    finalGridSize = gridSize + 2;
    finalGrid = createEmptyGrid(finalGridSize);

    // Copy core grid to center (offset by 1)
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        finalGrid[y + 1][x + 1] = coreGrid[y][x];
      }
    }
  } else {
    finalGrid = coreGrid;
    finalGridSize = gridSize;
  }

  // Render to output canvas
  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = size;
  outputCanvas.height = size;
  const outputCtx = outputCanvas.getContext("2d");

  if (!outputCtx) {
    throw new Error("Failed to get 2D context for pixel art output");
  }

  outputCtx.imageSmoothingEnabled = false;

  const pixelScale = size / finalGridSize;

  const isOpaque = (x: number, y: number): boolean => {
    if (x < 0 || x >= finalGridSize || y < 0 || y >= finalGridSize) return false;
    return finalGrid[y][x] !== null;
  };

  // Pass 1: Outline
  if (outline) {
    outputCtx.fillStyle = outlineColor;
    for (let y = 0; y < finalGridSize; y++) {
      for (let x = 0; x < finalGridSize; x++) {
        if (!isOpaque(x, y)) {
          // Check neighbors (4-directional)
          if (isOpaque(x + 1, y) || isOpaque(x - 1, y) || isOpaque(x, y + 1) || isOpaque(x, y - 1)) {
            outputCtx.fillRect(
              Math.floor(x * pixelScale),
              Math.floor(y * pixelScale),
              Math.ceil(pixelScale),
              Math.ceil(pixelScale)
            );
          }
        }
      }
    }
  }

  // Pass 2: Colors
  for (let y = 0; y < finalGridSize; y++) {
    for (let x = 0; x < finalGridSize; x++) {
      const p = finalGrid[y][x];
      if (p) {
        outputCtx.fillStyle = `rgb(${p.r},${p.g},${p.b})`;
        outputCtx.fillRect(
          Math.floor(x * pixelScale),
          Math.floor(y * pixelScale),
          Math.ceil(pixelScale),
          Math.ceil(pixelScale)
        );
      }
    }
  }

  pixelArtCache.set(cacheKey, outputCanvas);
  return outputCanvas;
}

/**
 * Create a pixel grid from high-resolution emoji pixel data
 */
function createPixelGrid(
  pixels: Uint8ClampedArray,
  sampleSize: number,
  gridSize: number
): PixelGrid {
  const blockSize = sampleSize / gridSize;
  const grid: PixelGrid = [];

  for (let y = 0; y < gridSize; y++) {
    grid[y] = [];
    for (let x = 0; x < gridSize; x++) {
      const colorCounts: Record<string, { count: number; sumR: number; sumG: number; sumB: number }> = {};
      let opaqueCount = 0;
      let totalPixels = 0;

      const startX = Math.floor(x * blockSize);
      const startY = Math.floor(y * blockSize);
      const endX = Math.floor((x + 1) * blockSize);
      const endY = Math.floor((y + 1) * blockSize);

      for (let py = startY; py < endY; py++) {
        for (let px = startX; px < endX; px++) {
          const i = (py * sampleSize + px) * 4;
          const a = pixels[i + 3];

          if (a > ALPHA_THRESHOLD) {
            opaqueCount++;

            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];

            // Quantize colors for grouping
            const key = `${Math.round(r / 10) * 10},${Math.round(g / 10) * 10},${Math.round(b / 10) * 10}`;

            if (!colorCounts[key]) {
              colorCounts[key] = { count: 0, sumR: 0, sumG: 0, sumB: 0 };
            }
            colorCounts[key].count++;
            colorCounts[key].sumR += r;
            colorCounts[key].sumG += g;
            colorCounts[key].sumB += b;
          }
          totalPixels++;
        }
      }

      // Check if this cell has enough coverage
      if (opaqueCount < totalPixels * COVERAGE_THRESHOLD) {
        grid[y][x] = null;
        continue;
      }

      // Find dominant color
      const candidates = Object.values(colorCounts).sort((a, b) => b.count - a.count);

      if (candidates.length > 0) {
        const bestColor = candidates[0];

        // Feature preservation: prefer darker colors for features (eyes, mouths)
        if (candidates.length > 1) {
          const second = candidates[1];
          const first = candidates[0];

          if (second.count > totalPixels * 0.15) {
            const lum1 = 0.299 * (first.sumR / first.count) + 0.587 * (first.sumG / first.count) + 0.114 * (first.sumB / first.count);
            const lum2 = 0.299 * (second.sumR / second.count) + 0.587 * (second.sumG / second.count) + 0.114 * (second.sumB / second.count);

            // If second is significantly darker (e.g., eye on face), pick it
            if (lum1 - lum2 > 40) {
              grid[y][x] = {
                r: Math.round(second.sumR / second.count),
                g: Math.round(second.sumG / second.count),
                b: Math.round(second.sumB / second.count),
              };
              continue;
            }
          }
        }

        grid[y][x] = {
          r: Math.round(bestColor.sumR / bestColor.count),
          g: Math.round(bestColor.sumG / bestColor.count),
          b: Math.round(bestColor.sumB / bestColor.count),
        };
      } else {
        grid[y][x] = null;
      }
    }
  }

  return grid;
}

/**
 * Create an empty pixel grid filled with nulls
 */
function createEmptyGrid(size: number): PixelGrid {
  const grid: PixelGrid = [];
  for (let y = 0; y < size; y++) {
    grid[y] = new Array(size).fill(null);
  }
  return grid;
}

/**
 * Clear the pixel art cache. Useful when memory needs to be freed.
 */
export function clearPixelArtCache(): void {
  pixelArtCache.clear();
}

/**
 * Get the number of cached pixel art images.
 */
export function getPixelArtCacheSize(): number {
  return pixelArtCache.size;
}
