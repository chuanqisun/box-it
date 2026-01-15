import { animationFrameScheduler, interval } from "rxjs";
import { map } from "rxjs/operators";

export type EntityId = number;

export interface BaseEntity {
  id: EntityId;
  kind: string;
}

export interface World<E extends BaseEntity, G> {
  entities: E[];
  nextId: EntityId;
  global: G;
}

export type System<E extends BaseEntity, G> = (world: World<E, G>, deltaTime: number) => World<E, G>;

export function createWorld<E extends BaseEntity, G>(initialGlobal: G): World<E, G> {
  return {
    entities: [],
    nextId: 1,
    global: initialGlobal,
  };
}

export function addEntity<E extends BaseEntity, G>(world: World<E, G>, entityData: Omit<E, "id">): World<E, G> {
  const newEntity = { ...entityData, id: world.nextId } as E;
  return {
    ...world,
    entities: [...world.entities, newEntity],
    nextId: world.nextId + 1,
  };
}

export function removeEntity<E extends BaseEntity, G>(world: World<E, G>, id: EntityId): World<E, G> {
  return {
    ...world,
    entities: world.entities.filter((e) => e.id !== id),
  };
}

export function updateEntity<E extends BaseEntity, G>(world: World<E, G>, id: EntityId, updater: (entity: E) => E): World<E, G> {
  return {
    ...world,
    entities: world.entities.map((e) => (e.id === id ? updater(e) : e)),
  };
}

export function getEntities<E extends BaseEntity, G, K extends keyof E>(world: World<E, G>, ...components: K[]): E[] {
  return world.entities.filter((e) => components.every((c) => c in e));
}

export function runSystems<E extends BaseEntity, G>(world: World<E, G>, deltaTime: number, systems: System<E, G>[]): World<E, G> {
  return systems.reduce((currentWorld, system) => system(currentWorld, deltaTime), world);
}

export function createAnimationFrameDelta$() {
  let lastTime = performance.now();
  return interval(0, animationFrameScheduler).pipe(
    map(() => {
      const now = performance.now();
      const dt = now - lastTime;
      lastTime = now;
      return dt;
    })
  );
}
