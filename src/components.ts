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
  result: string;
  effect: string;
}

export interface WithInteractions {
  interactions: {
    rules: InteractionRule[];
  };
}

export interface WithItemState {
  itemState: {
    state: "belt" | "falling" | "packed";
    fallScale: number;
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

export interface WithQuality {
  quality: {
    isBad: boolean;
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
    id: "tool1" | "tool2";
    isColliding: boolean;
  };
}

export interface WithGameState {
  gameState: {
    status: "playing" | "won" | "lost";
    totalItemsSpawned: number;
    itemsProcessed: number;
    durationMs: number;
    timeRemainingMs: number;
  };
}
