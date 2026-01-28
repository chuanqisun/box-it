import type { GameEntity, GameGlobal } from "../domain";
import type { System } from "../engine";

const BOX_COST = 200;

export const gameStateSystem: System<GameEntity, GameGlobal> = (world, _deltaTime) => {
  const gameStateEntity = world.entities.find((e) => e.gameState);
  const gameState = gameStateEntity?.gameState;
  if (!gameState || gameState.status !== "playing") return world;

  const scoreEntity = world.entities.find((e) => e.score);
  const boxEntity = world.entities.find((e) => e.box);
  const spawnerEntity = world.entities.find((e) => e.spawner);

  if (!scoreEntity?.score || !boxEntity?.box || !spawnerEntity?.spawner) return world;

  const score = scoreEntity.score.value;
  const hasBox = boxEntity.box.hasBox;
  const queueEmpty = spawnerEntity.spawner.queue.length === 0;
  const allItemsGenerated = spawnerEntity.spawner.allItemsGenerated;

  // Count items still on belt or falling (not packed)
  const activeItems = world.entities.filter(
    (e) => e.itemState && (e.itemState.state === "belt" || e.itemState.state === "falling") && !e.boxAnchor
  );

  // Count items packed in boxes (with boxAnchor)
  const packedItems = world.entities.filter((e) => e.boxAnchor);

  // Lose condition: Can't afford a box and don't have one
  if (score < BOX_COST && !hasBox) {
    return world.updateEntities((entities) =>
      entities.map((e) =>
        e.gameState
          ? { ...e, gameState: { ...e.gameState, status: "lost" as const } }
          : e
      )
    );
  }

  // Win condition: All items generated and spawned, no items on belt/falling, no packed items, queue is empty
  // The spawner must have started (totalItemsSpawned > 0) to prevent winning immediately
  // Must also wait for all items to be generated from the stream (allItemsGenerated)
  if (
    allItemsGenerated &&
    queueEmpty &&
    activeItems.length === 0 &&
    packedItems.length === 0 &&
    gameState.totalItemsSpawned > 0 &&
    gameState.itemsProcessed >= gameState.totalItemsSpawned
  ) {
    return world.updateEntities((entities) =>
      entities.map((e) =>
        e.gameState
          ? { ...e, gameState: { ...e.gameState, status: "won" as const } }
          : e
      )
    );
  }

  return world;
};
