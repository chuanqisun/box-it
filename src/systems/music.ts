/**
 * Music System
 *
 * This system handles background music playback based on the music component.
 * It reads the music component state and controls audio playback accordingly.
 * This ECS-based approach allows for future event-triggered music changes.
 */

import type { GameEntity, GameGlobal } from "../domain";
import type { System } from "../engine";
import { playBackgroundMusic, stopBackgroundMusic, isMusicPlaying } from "../music";

export const musicSystem: System<GameEntity, GameGlobal> = (world, _deltaTime) => {
  const musicEntity = world.entities.find((e) => e.music);
  if (!musicEntity?.music) return world;

  const { track, shouldPlay } = musicEntity.music;

  // Handle background music based on component state
  if (track === "background") {
    if (shouldPlay && !isMusicPlaying()) {
      playBackgroundMusic();
    } else if (!shouldPlay && isMusicPlaying()) {
      stopBackgroundMusic();
    }
  } else if (track === "none") {
    if (isMusicPlaying()) {
      stopBackgroundMusic();
    }
  }

  return world;
};
