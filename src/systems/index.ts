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
export { moverSystem } from "./mover";

// Feedback Systems
export { feedbackSystem } from "./feedback";

// Game State Systems
export { gameStateSystem } from "./game-state";
export { resizeSystem } from "./resize";
