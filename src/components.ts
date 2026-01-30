// --- ECS COMPONENTS ---

export interface WithTransform {
  transform: {
    x: number;
    y: number;
    rotation: number;
    scale: number;
  };
}

export interface WithVelocity {
  velocity: {
    x: number;
    y: number;
  };
}

export interface WithRender {
  render: {
    emoji: string;
  };
}

export interface ItemDescriptor {
  name: string;
  emoji: string;
}

export interface WithName {
  name: {
    value: string;
  };
}

export interface WithCollision {
  collision: {
    width: number;
    height: number;
    type: "rectangle" | "circle";
    radius?: number;
    /** X offset from the transform center in local coordinates */
    xOffset?: number;
    /** Y offset from the transform center in local coordinates */
    yOffset?: number;
  };
}

export interface WithScore {
  score: {
    value: number;
    packedCount: number;
  };
}

export interface WithBox {
  box: {
    hasBox: boolean;
  };
}

export interface WithPointer {
  pointer: {
    x: number;
    y: number;
    rotation: number;
  };
}

export interface WithSpawner {
  spawner: {
    timer: number;
    interval: number;
    queue: ItemDescriptor[];
  };
}

export interface InteractionRule {
  itemOne: string;
  itemTwo: string;
  result?: string;
  effect: string;
}

export interface WithInteractions {
  interactions: {
    rules: InteractionRule[];
  };
}

export interface WithItemState {
  itemState: {
    state: "belt" | "falling" | "packed" | "held";
    fallScale: number;
    /** Scale when item is raised/held by mover tool */
    raisedScale?: number;
  };
}

export interface WithZone {
  zone: {
    type: "restock" | "shipping";
  };
}

export interface WithBoxAnchor {
  boxAnchor: {
    relX: number;
    relY: number;
  };
}

export interface WithPhysical {
  physical: {
    size: number;
  };
}

export interface WithConveyor {
  conveyor: {
    isActive: boolean;
    offset: number;
    speed: number;
    width: number;
    length: number;
  };
}

export interface FeedbackEffect {
  text: string;
  x: number;
  y: number;
  color: string;
  size: number;
  life: number;
  velocityY: number;
}

export interface WithFeedback {
  feedback: {
    effects: FeedbackEffect[];
  };
}

export interface WithTool {
  tool: {
    id: "tool1" | "tool2" | "tool3";
    isColliding: boolean;
    isActive: boolean;
    /** ID of the item being held by tool3 (mover) */
    heldItemId?: number;
    /** Timestamp of last active state (for debouncing mover release) */
    lastActiveTime?: number;
  };
}

export interface WithGameState {
  gameState: {
    status: "playing" | "won" | "lost";
    /** Whether the timer has started (set to true when user grabs the first box) */
    timerStarted: boolean;
    totalItemsSpawned: number;
    itemsProcessed: number;
    durationMs: number;
    timeRemainingMs: number;
  };
}

export interface WithIronable {
  ironable: {
    /** Whether this item has already been ironed */
    ironed: boolean;
  };
}
