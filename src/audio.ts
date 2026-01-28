/**
 * Audio Manager Module
 *
 * This module handles:
 * - Preloading sound effects and music
 * - Playing sound effects (multiple can overlap)
 * - Playing background music in a loop
 */

// Import sound effect files
import fallIntoBoxUrl from "./sounds/fall-into-box.mp3";
import getBoxUrl from "./sounds/get-box.mp3";
import shippedUrl from "./sounds/shipped.mp3";
import tool1Url from "./sounds/tool-1.mp3";
import tool2Url from "./sounds/tool-2.mp3";

// Import music file
import backgroundMusicUrl from "./music/packing-line-panic.mp3";

// Sound effect types
export type SoundEffect = "tool1" | "tool2" | "fallIntoBox" | "getBox" | "shipped";

// Sound effect URL mapping
const soundEffectUrls: Record<SoundEffect, string> = {
  tool1: tool1Url,
  tool2: tool2Url,
  fallIntoBox: fallIntoBoxUrl,
  getBox: getBoxUrl,
  shipped: shippedUrl,
};

// Preloaded audio buffers for sound effects
const audioBuffers: Map<SoundEffect, AudioBuffer> = new Map();

// Audio context (created lazily on first user interaction)
let audioContext: AudioContext | null = null;

// Background music element
let backgroundMusic: HTMLAudioElement | null = null;
let isMusicPlaying = false;

/**
 * Get or create the audio context.
 * Must be called after user interaction due to browser autoplay policies.
 */
function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

/**
 * Preload all sound effects into audio buffers for low-latency playback.
 */
export async function preloadSounds(): Promise<void> {
  const context = getAudioContext();

  const loadPromises = Object.entries(soundEffectUrls).map(async ([key, url]) => {
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await context.decodeAudioData(arrayBuffer);
      audioBuffers.set(key as SoundEffect, audioBuffer);
    } catch (error) {
      console.warn(`Failed to load sound effect: ${key}`, error);
    }
  });

  await Promise.all(loadPromises);

  // Preload background music
  backgroundMusic = new Audio(backgroundMusicUrl);
  backgroundMusic.loop = true;
  backgroundMusic.preload = "auto";
}

/**
 * Play a sound effect. Multiple sounds can overlap.
 */
export function playSound(effect: SoundEffect): void {
  const buffer = audioBuffers.get(effect);
  if (!buffer) {
    console.warn(`Sound effect not loaded: ${effect}`);
    return;
  }

  try {
    const context = getAudioContext();

    // Resume context if suspended (browser autoplay policy)
    if (context.state === "suspended") {
      context.resume();
    }

    // Create a new buffer source for each playback (allows overlapping)
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.start(0);
  } catch (error) {
    console.warn(`Failed to play sound effect: ${effect}`, error);
  }
}

/**
 * Start playing the background music in an infinite loop.
 * Does nothing if music is already playing.
 */
export function startBackgroundMusic(): void {
  if (isMusicPlaying || !backgroundMusic) return;

  try {
    // Resume audio context if needed
    if (audioContext?.state === "suspended") {
      audioContext.resume();
    }

    backgroundMusic.play().catch((error) => {
      console.warn("Failed to start background music:", error);
    });
    isMusicPlaying = true;
  } catch (error) {
    console.warn("Failed to start background music:", error);
  }
}

/**
 * Stop the background music.
 */
export function stopBackgroundMusic(): void {
  if (!isMusicPlaying || !backgroundMusic) return;

  backgroundMusic.pause();
  backgroundMusic.currentTime = 0;
  isMusicPlaying = false;
}

/**
 * Check if background music is currently playing.
 */
export function isMusicCurrentlyPlaying(): boolean {
  return isMusicPlaying;
}
