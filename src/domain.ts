import type {
  WithBox,
  WithBoxAnchor,
  WithCollision,
  WithConveyor,
  WithFeedback,
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
    WithFeedback &
    WithSpawner
>;

export interface GameGlobal {
  canvasEl: HTMLCanvasElement;
  canvas: {
    width: number;
    height: number;
  };
}

export type GameWorld = World<GameEntity, GameGlobal>;
