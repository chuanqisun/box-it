/**
 * High Scores Module
 *
 * Manages high scores persistence using IndexedDB via idb-keyval.
 * Stores top 3 scores with player names and timestamps.
 */

import { get, set } from "idb-keyval";

const HIGH_SCORES_KEY = "high-scores";
const MAX_HIGH_SCORES = 3;

export interface HighScoreEntry {
  name: string;
  score: number;
  timestamp: number;
}

/**
 * Get all high scores from IndexedDB, sorted by score descending.
 * Returns an empty array if there are no scores or on error.
 */
export async function getHighScores(): Promise<HighScoreEntry[]> {
  try {
    const scores = await get<HighScoreEntry[]>(HIGH_SCORES_KEY);
    // Sort to ensure consistency even if data was modified externally
    return (scores ?? []).sort((a, b) => b.score - a.score);
  } catch (error) {
    console.error("Failed to load high scores:", error);
    return [];
  }
}

/**
 * Check if a score qualifies for the high score list (top 3).
 */
export async function isHighScore(score: number): Promise<boolean> {
  const scores = await getHighScores();
  if (scores.length < MAX_HIGH_SCORES) {
    return true;
  }
  // Check if score beats the lowest high score
  const lowestHighScore = scores[scores.length - 1]?.score ?? 0;
  return score > lowestHighScore;
}

/**
 * Save a new high score entry to IndexedDB.
 * Maintains only the top 3 scores.
 */
export async function saveHighScore(name: string, score: number): Promise<HighScoreEntry[]> {
  try {
    const scores = await getHighScores();

    const newEntry: HighScoreEntry = {
      name: name.trim() || "Anonymous",
      score,
      timestamp: Date.now(),
    };

    // Add new entry and sort by score descending
    scores.push(newEntry);
    scores.sort((a, b) => b.score - a.score);

    // Keep only top 3
    const topScores = scores.slice(0, MAX_HIGH_SCORES);

    await set(HIGH_SCORES_KEY, topScores);
    return topScores;
  } catch (error) {
    console.error("Failed to save high score:", error);
    // Return empty array on error
    return [];
  }
}
