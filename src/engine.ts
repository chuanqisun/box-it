import { animationFrameScheduler, BehaviorSubject, fromEvent, interval, Observable } from "rxjs";
import { distinctUntilChanged, map, startWith } from "rxjs/operators";

export type EntityId = number;

export interface BaseEntity {
  id: EntityId;
}

export interface WorldState<E extends BaseEntity, G> {
  entities: E[];
  nextId: EntityId;
  global: G;
}

export type System<E extends BaseEntity, G> = (world: WorldState<E, G>, deltaTime: number) => WorldState<E, G>;

export class World<E extends BaseEntity, G> {
  private _entities: E[] = [];
  private _nextId: EntityId = 1;
  private _global: G;
  private readonly _subject$: BehaviorSubject<this>;

  constructor(initialGlobal: G) {
    this._global = initialGlobal;
    this._subject$ = new BehaviorSubject<this>(this);
  }

  get entities(): E[] {
    return this._entities;
  }

  get nextId(): EntityId {
    return this._nextId;
  }

  get global(): G {
    return this._global;
  }

  get value(): this {
    return this;
  }

  asObservable(): Observable<this> {
    return this._subject$.asObservable();
  }

  subscribe(observer: (world: this) => void) {
    return this._subject$.subscribe(observer);
  }

  next(): this {
    this._subject$.next(this);
    return this;
  }

  addEntity(entityData: Omit<E, "id">): this {
    const newEntity = { ...entityData, id: this._nextId } as E;
    this._entities = [...this._entities, newEntity];
    this._nextId++;
    return this;
  }

  removeEntity(id: EntityId): this {
    this._entities = this._entities.filter((e) => e.id !== id);
    return this;
  }

  updateEntity(id: EntityId, updater: (entity: E) => E): this {
    this._entities = this._entities.map((e) => (e.id === id ? updater(e) : e));
    return this;
  }

  updateEntities(updater: (entities: E[]) => E[]): this {
    this._entities = updater(this._entities);
    return this;
  }

  updateGlobal(updater: (global: G) => G): this {
    this._global = updater(this._global);
    return this;
  }

  setGlobal(global: G): this {
    this._global = global;
    return this;
  }

  getEntities<K extends keyof E>(...components: K[]): E[] {
    return this._entities.filter((e) => components.every((c) => c in e));
  }

  runSystems(deltaTime: number, systems: System<E, G>[]): this {
    let state: WorldState<E, G> = {
      entities: this._entities,
      nextId: this._nextId,
      global: this._global,
    };

    state = systems.reduce((currentState, system) => system(currentState, deltaTime), state);

    this._entities = state.entities;
    this._nextId = state.nextId;
    this._global = state.global;

    return this;
  }
}

// Standalone helper functions for use within systems (operate on WorldState)
export function removeEntity<E extends BaseEntity, G>(world: WorldState<E, G>, id: EntityId): WorldState<E, G> {
  return {
    ...world,
    entities: world.entities.filter((e) => e.id !== id),
  };
}

export function addEntity<E extends BaseEntity, G>(world: WorldState<E, G>, entityData: Omit<E, "id">): WorldState<E, G> {
  const newEntity = { ...entityData, id: world.nextId } as E;
  return {
    ...world,
    entities: [...world.entities, newEntity],
    nextId: world.nextId + 1,
  };
}

export function updateEntity<E extends BaseEntity, G>(world: WorldState<E, G>, id: EntityId, updater: (entity: E) => E): WorldState<E, G> {
  return {
    ...world,
    entities: world.entities.map((e) => (e.id === id ? updater(e) : e)),
  };
}

export function getEntities<E extends BaseEntity, G, K extends keyof E>(world: WorldState<E, G>, ...components: K[]): E[] {
  return world.entities.filter((e) => components.every((c) => c in e));
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

export function createResizeObserver$() {
  return fromEvent(window, "resize").pipe(
    startWith(0),
    map(() => ({ width: window.innerWidth, height: window.innerHeight })),
    distinctUntilChanged((a, b) => a.width === b.width && a.height === b.height)
  );
}
