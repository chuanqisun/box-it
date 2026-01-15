import { animationFrameScheduler, BehaviorSubject, fromEvent, interval, Observable } from "rxjs";
import { distinctUntilChanged, map, startWith } from "rxjs/operators";

export type EntityId = number;

export interface BaseEntity {
  id: EntityId;
}

export type System<E extends BaseEntity, G> = (world: World<E, G>, deltaTime: number) => World<E, G>;

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
    systems.reduce((world, system) => system(world, deltaTime), this as World<E, G>);
    return this;
  }
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
