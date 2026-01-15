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
  };
}
