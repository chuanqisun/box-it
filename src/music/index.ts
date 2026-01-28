/**
 * Music Module
 *
 * Simple background music playback.
 * Call preloadMusic() at startup, then playBackgroundMusic() when conveyor starts.
 */

// Import music file using Vite module import
import backgroundMusicUrl from "./packing-line-panic.mp3";

// Background music audio element
let backgroundMusic: HTMLAudioElement | null = null;

/**
 * Preload the background music file.
 * Call this at application startup.
 */
export function preloadMusic(): Promise<void> {
  return new Promise<void>((resolve) => {
    backgroundMusic = new Audio(backgroundMusicUrl);
    backgroundMusic.preload = "auto";
    backgroundMusic.loop = true;

    backgroundMusic.addEventListener("canplaythrough", () => {
      resolve();
    }, { once: true });

    backgroundMusic.addEventListener("error", () => {
      console.warn("Failed to preload background music");
      resolve();
    }, { once: true });

    backgroundMusic.load();
  });
}

/**
 * Start playing the background music.
 * Music will loop forever once started.
 */
export function playBackgroundMusic(): void {
  if (!backgroundMusic) {
    console.warn("Background music not loaded");
    return;
  }

  // Don't restart if already playing
  if (!backgroundMusic.paused) {
    return;
  }

  backgroundMusic.play().catch((error) => {
    console.debug("Background music playback blocked:", error);
  });
}
