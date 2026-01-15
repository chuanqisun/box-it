import type {
  WithBox,
  WithBoxAnchor,
  WithCollision,
  WithConveyor,
  WithItemState,
  WithPhysical,
  WithPointer,
  WithQuality,
  WithRender,
  WithScore,
  WithSpawner,
  WithTransform,
  WithVelocity,
  WithZone,
} from "./components";
import type { World } from "./engine";

export type GameEntity = {
  id: number;
} & Partial<
  WithTransform &
    WithVelocity &
    WithRender &
    WithCollision &
    WithScore &
    WithItemState &
    WithZone &
    WithBoxAnchor &
    WithQuality &
    WithPhysical &
    WithConveyor &
    WithBox &
    WithPointer &
    WithSpawner
>;

export interface GameGlobal {
  canvasEl: HTMLCanvasElement;
  canvas: {
    width: number;
    height: number;
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
