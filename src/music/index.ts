/**
 * Music Module
 *
 * This module handles background music audio operations.
 * It is used by the music system to control playback based on ECS state.
 */

// Import music file using Vite module import
import backgroundMusicUrl from "./packing-line-panic.mp3";

// Background music audio element
let backgroundMusic: HTMLAudioElement | null = null;
let isCurrentlyPlaying = false;

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
      // Still resolve to not block game startup
      resolve();
    }, { once: true });

    // Start loading
    backgroundMusic.load();
  });
}

/**
 * Start playing the background music.
 * Music will loop forever once started.
 * Called by the music system when music component indicates it should play.
 */
export function playBackgroundMusic(): void {
  if (!backgroundMusic) {
    console.warn("Background music not loaded");
    return;
  }

  if (isCurrentlyPlaying) {
    return; // Already playing
  }

  backgroundMusic.play()
    .then(() => {
      isCurrentlyPlaying = true;
    })
    .catch((error) => {
      // Handle autoplay restrictions - will retry on next system tick
      console.debug("Background music playback blocked:", error);
      isCurrentlyPlaying = false;
    });
}

/**
 * Stop the background music.
 * Called by the music system when music component indicates it should stop.
 */
export function stopBackgroundMusic(): void {
  if (!backgroundMusic) {
    return;
  }

  backgroundMusic.pause();
  backgroundMusic.currentTime = 0;
  isCurrentlyPlaying = false;
}

/**
 * Check if background music is currently playing.
 */
export function isMusicPlaying(): boolean {
  return isCurrentlyPlaying && backgroundMusic !== null && !backgroundMusic.paused;
}
