import type { GameEntity, GameGlobal } from "../domain";
import type { System } from "../engine";

export const gameStateSystem: System<GameEntity, GameGlobal> = (world, deltaTime) => {
  const gameStateEntity = world.entities.find((e) => e.gameState);
  const gameState = gameStateEntity?.gameState;
  if (!gameState || gameState.status !== "playing") return world;

  // Only decrement timer if it has been started (user grabbed the box)
  if (!gameState.timerStarted) return world;

  const nextTimeRemaining = Math.max(0, gameState.timeRemainingMs - deltaTime);

  if (nextTimeRemaining <= 0) {
    return world.updateEntities((entities) =>
      entities.map((e) =>
        e.gameState
          ? {
              ...e,
              gameState: {
                ...e.gameState,
                timeRemainingMs: 0,
                status: "won" as const,
              },
            }
          : e
      )
    );
  }

  return world.updateEntities((entities) =>
    entities.map((e) =>
      e.gameState
        ? {
            ...e,
            gameState: {
              ...e.gameState,
              timeRemainingMs: nextTimeRemaining,
            },
          }
        : e
    )
  );
};
