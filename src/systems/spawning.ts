import { share, take } from "rxjs";
import * as liveAI from "../ai/generate";
import * as mockAI from "../ai/generate-mock";
import { getSelectedTheme } from "../ai/themes";
import type { GameEntity, GameGlobal } from "../domain";
import type { System } from "../engine";

const ITEM_SPEED_BELT = 250;
const ITEM_SIZE = 80;
const GAME_DURATION_MS = 30_000;
const TARGET_ITEMS = 60;
const BASE_SPAWN_INTERVAL = GAME_DURATION_MS / TARGET_ITEMS;

const isLive = new URLSearchParams(window.location.search).get("live") === "true";
const { createItemStream$, simulateInteractions$ } = isLive ? liveAI : mockAI;
let generationStarted = false;

/**
 * Resets the internal generation state to allow a new theme to be used when restarting the game.
 * Should be called before showing the theme selection menu again.
 */
export function resetGenerationState(): void {
  generationStarted = false;
}

export const spawningSystem: System<GameEntity, GameGlobal> = (world, deltaTime) => {
  const gameStateEntity = world.entities.find((e) => e.gameState);
  if (gameStateEntity?.gameState?.status !== "playing") return world;

  const spawnerEntity = world.entities.find((e) => e.spawner);
  const spawner = spawnerEntity?.spawner;
  if (!spawner) return world;

  if (!generationStarted) {
    generationStarted = true;

    const currentTheme = getSelectedTheme();
    const items$ = createItemStream$({ theme: currentTheme, count: TARGET_ITEMS }).pipe(take(TARGET_ITEMS), share());

    items$.subscribe({
      next: (item) => {
        world.updateEntities((entities) => entities.map((e) => (e.spawner ? { ...e, spawner: { ...e.spawner, queue: [...e.spawner.queue, item] } } : e)));
      },
    });

    simulateInteractions$(items$, 30)
      .pipe(take(30))
      .subscribe({
        next: (interaction) => {
          world.updateEntities((entities) =>
            entities.map((e) =>
              e.interactions
                ? {
                    ...e,
                    interactions: {
                      ...e.interactions,
                      rules: [
                        ...e.interactions.rules,
                        {
                          itemOne: interaction.itemOneName,
                          itemTwo: interaction.itemTwoName,
                          result: interaction.resultEmoji,
                          effect: interaction.speechBubbleWord,
                        },
                      ],
                    },
                  }
                : e
            )
          );
        },
      });
  }

  const conveyorEntity = world.entities.find((e) => e.conveyor);
  const conveyor = conveyorEntity?.conveyor;
  if (!conveyor || !conveyor.isActive) return world;

  const newTimer = spawner.timer + deltaTime;

  if (newTimer > spawner.interval) {
    if (spawner.queue.length === 0) {
      return world.updateEntities((entities) => entities.map((e) => (e.conveyor && e.spawner ? { ...e, spawner: { ...e.spawner, timer: newTimer } } : e)));
    }

    const item = spawner.queue.shift();
    if (!item) return world;

    const emoji = item.emoji;
    const name = item.name;

    const beltLeft = (world.global.canvas.width - conveyor.width) / 2;
    const padding = 30;
    const x = beltLeft + padding + Math.random() * (conveyor.width - padding * 2);

    world.addEntity({
      transform: { x, y: -60, rotation: (Math.random() - 0.5) * 0.5, scale: 1 },
      velocity: { x: 0, y: ITEM_SPEED_BELT },
      render: { emoji },
      name: { value: name },
      collision: { width: ITEM_SIZE, height: ITEM_SIZE, type: "rectangle" },
      itemState: { state: "belt", fallScale: 1 },
      physical: { size: ITEM_SIZE },
    });

    // Update spawner timer and increment totalItemsSpawned in gameState
    world.updateEntities((entities) =>
      entities.map((e) => {
        if (e.conveyor && e.spawner) {
          return {
            ...e,
            spawner: {
              ...e.spawner,
              timer: 0,
              interval: BASE_SPAWN_INTERVAL + (Math.random() - 0.5) * 400,
            },
          };
        }
        if (e.gameState) {
          return { ...e, gameState: { ...e.gameState, totalItemsSpawned: e.gameState.totalItemsSpawned + 1 } };
        }
        return e;
      })
    );

    return world;
  }

  return world.updateEntities((entities) => entities.map((e) => (e.conveyor && e.spawner ? { ...e, spawner: { ...e.spawner, timer: newTimer } } : e)));
};
