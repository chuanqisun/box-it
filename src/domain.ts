import type {
  WithBoxAnchor,
  WithCollision,
  WithItemState,
  WithPhysical,
  WithQuality,
  WithRender,
  WithScore,
  WithTransform,
  WithVelocity,
  WithZone,
} from "./components";
import type { World } from "./engine";

export type EntityKind = "item" | "box" | "packed-item" | "zone";

export type GameEntity = {
  id: number;
  kind: EntityKind;
} & Partial<WithTransform & WithVelocity & WithRender & WithCollision & WithScore & WithItemState & WithZone & WithBoxAnchor & WithQuality & WithPhysical>;

export interface GameGlobal {
  score: number;
  hasBox: boolean;
  spawnTimer: number;
  spawnInterval: number;
  packedCount: number;
  mouseX: number;
  mouseY: number;
  resizePending: boolean;
  resizeWidth: number;
  resizeHeight: number;
  canvasEl: HTMLCanvasElement;
  canvas: {
    width: number;
    height: number;
  };
  conveyor: {
    width: number;
    length: number;
  };
  feedbackEffects: Array<{
    text: string;
    x: number;
    y: number;
    color: string;
    size: number;
    life: number;
    velocityY: number;
  }>;
}

export type GameWorld = World<GameEntity, GameGlobal>;
