# System Architecture

- Functional Reactive Programming (FRP) for input stream handling and asynchronous asset generation
- Entity-Component-System (ECS) for game object management and world simulation
- Configuration System: dynamic settings for game controller

## Input system

- 9-point touch screen + mouse
- The raw input will be the browser touch/mouse events
- Custom fabricated 3-point touch object, up to 3 objects on the touch screen at once
- The relative position of the 3 touch points determine the identity and orientation of the object

### Input processing pipeline

```
Raw input events -> object states
```

### Object Update Message Contract

```ts
interface ObjectUpdate {
  id: string;
  type: "down" | "move" | "up";
  position: { x: number; y: number };
  rotation: number; // in degrees
}
```
