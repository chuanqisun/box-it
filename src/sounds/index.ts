/**
 * Sound Module
 *
 * This module handles preloading and playing sound effects.
 * Sounds are preloaded at startup to reduce playback latency.
 * Multiple sounds can overlap by using cloned audio nodes.
 */

// Import sound files using Vite module import
import fallIntoBoxUrl from "./fall-into-box.mp3";
import getBoxUrl from "./get-box.mp3";
import shippedUrl from "./shipped.mp3";
import tool1Url from "./tool-1.mp3";
import tool2Url from "./tool-2.mp3";

// Sound effect types
export type SoundEffect =
  | "tool1"
  | "tool2"
  | "fallIntoBox"
  | "getBox"
  | "shipped";

// Map of sound effect names to their URLs
const soundUrls: Record<SoundEffect, string> = {
  tool1: tool1Url,
  tool2: tool2Url,
  fallIntoBox: fallIntoBoxUrl,
  getBox: getBoxUrl,
  shipped: shippedUrl,
};

// Cache of preloaded audio elements
const audioCache: Map<SoundEffect, HTMLAudioElement> = new Map();

/**
 * Preload all sound files to reduce playback latency.
 * Call this at application startup.
 */
export function preloadSounds(): Promise<void[]> {
  const loadPromises = Object.entries(soundUrls).map(([name, url]) => {
    return new Promise<void>((resolve) => {
      const audio = new Audio(url);
      audio.preload = "auto";

      audio.addEventListener("canplaythrough", () => {
        audioCache.set(name as SoundEffect, audio);
        resolve();
      }, { once: true });

      audio.addEventListener("error", () => {
        console.warn(`Failed to preload sound: ${name}`);
        // Still resolve to not block game startup
        resolve();
      }, { once: true });

      // Start loading
      audio.load();
    });
  });

  return Promise.all(loadPromises);
}

/**
 * Play a sound effect.
 * Creates a clone of the cached audio element to allow overlapping sounds.
 */
export function playSound(effect: SoundEffect): void {
  const cachedAudio = audioCache.get(effect);

  if (!cachedAudio) {
    console.warn(`Sound not loaded: ${effect}`);
    return;
  }

  // Clone the audio element to allow overlapping playback
  const audio = cachedAudio.cloneNode() as HTMLAudioElement;
  audio.currentTime = 0;
  audio.play().catch((error) => {
    // Silently handle autoplay restrictions
    console.debug(`Sound playback blocked: ${effect}`, error);
  });
}

/**
 * Check if sounds have been preloaded.
 */
export function areSoundsLoaded(): boolean {
  return audioCache.size > 0;
}
