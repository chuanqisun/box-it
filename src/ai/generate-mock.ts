import { Observable, concatMap, delay, from, of, switchMap, toArray } from "rxjs";
import type { GeneratedItem, Interaction, ItemStreamProps } from "./generate";

const MOCK_EMOJIS = ["🍎", "🍌", "🍒", "🥑", "🍔", "🍕", "🍦", "🍩", "🍪", "🍺", "🏀", "⚽", "🚗", "🚀"];

export function createItemStream$(props: ItemStreamProps): Observable<GeneratedItem> {
  const items: GeneratedItem[] = Array.from({ length: props.count }, (_, i) => ({
    name: `${props.theme} Item ${i + 1}`,
    emoji: MOCK_EMOJIS[Math.floor(Math.random() * MOCK_EMOJIS.length)],
  }));

  return from(items).pipe(concatMap((item) => of(item).pipe(delay(50))));
}

export function simulateInteractions$(items$: Observable<GeneratedItem>, interactionCount?: number): Observable<Interaction> {
  return items$.pipe(
    toArray(),
    switchMap((items) => {
      if (items.length === 0) return from([]);

      const count = interactionCount ?? 5;
      const interactions: Interaction[] = Array.from({ length: count }, () => {
        const item1 = items[Math.floor(Math.random() * items.length)];
        const item2 = items[Math.floor(Math.random() * items.length)];

        const roll = Math.random();
        if (roll < 0.3) {
          return {
            itemOneName: item1.name,
            itemTwoName: item2.name,
            resultName: "Poop",
            resultEmoji: "💩",
            speechBubbleWord: "Eww!",
          };
        } else if (roll < 0.5) {
          return {
            itemOneName: item1.name,
            itemTwoName: item2.name,
            resultName: "Death",
            resultEmoji: "💀",
            speechBubbleWord: "Oh no!",
          };
        } else {
          return {
            itemOneName: item1.name,
            itemTwoName: item2.name,
            resultName: "Success",
            resultEmoji: "🎉",
            speechBubbleWord: "Yay!",
          };
        }
      });

      return from(interactions).pipe(concatMap((interaction) => of(interaction).pipe(delay(100))));
    })
  );
}
