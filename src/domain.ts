import type {
  WithBox,
  WithBoxAnchor,
  WithCollision,
  WithConveyor,
  WithFeedback,
  WithInteractions,
  WithItemState,
  WithName,
  WithPhysical,
  WithPointer,
  WithQuality,
  WithRender,
  WithScore,
  WithSpawner,
  WithTool,
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
    WithName &
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
    WithInteractions &
    WithSpawner &
    WithTool
>;

/**
 * Avoid adding data to GameGlobal. They are only used for DOM references
 * Model all the data as Components and behavior as Systems
 */
export interface GameGlobal {
  canvasEl: HTMLCanvasElement;
  canvas: {
    width: number;
    height: number;
  };
}

export type GameWorld = World<GameEntity, GameGlobal>;
