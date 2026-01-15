# Game design

## Idea

- User plays the role of a fulfillment center worker.
- Pack items into boxes to maximize space and minimize damage
- Apply tools to facilitate packing
- AI generates items and simulates multi-item interactions that may cause damage
- Game processes to increase speed and conflict among items
- Fun factor in chaos
- Blend genre of tetris, logic puzzle, and real-time strategy

## System Architecture

- Functional Reactive Programming (FRP) for input stream handling and asynchronous asset generation
- Entity-Component-System (ECS) for game object management and world simulation
- Configuration System: dynamic settings for game controller

## Input system

- 9-point touch screen + mouse
- The raw input will be the browser touch/mouse events
- Custom fabricated 3-point touch object, multiple objects on screen at once
- The relative position of the 3 touch points determine the identity and orientation of the object

### Input processing pipeline

```
Raw input events -> Object updates
```

Raw input events are touchstart, touchmove, touchend. At any point, we may have 0, 1, 2, .... number of touch points. The physical hardware may limit the number of simultaneous touch points. But our system should handle arbitrary number of touch points.

We register the "signature" of the 3-point touch object in the configuration system. The object identity is represented by the length of the 3 sides of the triangle, sorted from small to large. The (a,b,c) triple is the identity of the object and we will use nearest match to identify the object.

It's possible that the points are added/removed in any order, with delays and noise. We need to design a robust and cheap algorithm to identify the objects on screen.

We also have a redundant input mechanism to help debug the program: the user can use mouse to drag objects on the screen and use scroll wheel to rotate the object.

### Object Update Message Contract

```ts
interface ObjectUpdate {
  id: string;
  type: "down" | "move" | "up";
  position: { x: number; y: number };
  rotation: number; // in degrees
}
```

## World simulation

On the high level, the game has three areas: staging, transportation, packing. Each area has different interaction mechanisms.

### Staging

- Off the screen
- AI to generate a series of objects
- Each object has visual, collision box, and dynamic interaction properties

### Transportation

- Object appears from top of screen, move along conveyor belt to the bottom
- User may process the object with tools (3-point touch objects)
- Tools may transform object properties (e.g. add container, fold, flatten, disassemble)

### Packing

- User manipulates the position and location of a box to catch the object as they fall off the end of conveyor belt
- Object collides inside the box
- Overlapping object will deduct points
- Certain types of objects may not be packed together (e.g. live animals and food)
- When fully packed, user need to move box to delivery zone and receive new box from supply zone.
