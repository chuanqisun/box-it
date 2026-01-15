import { EMPTY, fromEvent, merge, type Observable } from "rxjs";

export function getInputRawEvent$(targetArea: HTMLElement): Observable<TouchEvent> {
  const touchstart$ = fromEvent<TouchEvent>(targetArea, "touchstart");
  const touchmove$ = fromEvent<TouchEvent>(targetArea, "touchmove");
  const touchend$ = fromEvent<TouchEvent>(targetArea, "touchend");
  return merge(touchstart$, touchmove$, touchend$);
}

export interface ObjectTrackingContext {
  knownObjects: KnownObject[];
}

export interface KnownObject {
  id: string;
  sides: [number, number, number]; // lengths of the 3 sides, incrementally sorted
}

export function getObjectEvents(rawEvents$: Observable<TouchEvent>, context: ObjectTrackingContext): Observable<any> {
  return EMPTY;
}
