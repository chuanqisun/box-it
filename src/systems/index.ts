/**
 * Systems Index
 *
 * This file exports all available systems for the ECS game engine.
 * Systems are organized by category:
 *
 * - Input: Process player input
 * - Spawning: Create new entities
 * - Physics: Movement
 * - State: Entity state management
 * - Interaction: Entity-entity interactions
 * - Feedback: Visual feedback effects
 * - Audio: Sound and music systems
 * - Game: Game state management
 */

// Input Systems
export { inputSystem } from "./input";

// Spawning Systems
export { spawningSystem } from "./spawning";

// Physics Systems
export { movementSystem } from "./movement";

// State Systems
export { itemStateSystem } from "./item-state";
export { boxPackingSystem } from "./box-packing";

// Interaction Systems
export { interactionSystem } from "./interaction";
export { zoneSystem } from "./zone";
export { toolSystem } from "./tool";

// Feedback Systems
export { feedbackSystem } from "./feedback";

// Audio Systems
export { musicSystem } from "./music";

// Game State Systems
export { gameStateSystem } from "./game-state";
export { resizeSystem } from "./resize";
