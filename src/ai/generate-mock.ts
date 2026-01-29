import { Observable, concatMap, delay, from, of, switchMap, toArray } from "rxjs";
import type { GeneratedItem, Interaction, ItemStreamProps } from "./generate";

interface MockItem {
  name: string;
  emoji: string;
}

const THEME_MOCK_ITEMS: Record<string, MockItem[]> = {
  "Black Friday Sale": [
    { name: "TV", emoji: "📺" },
    { name: "Laptop", emoji: "💻" },
    { name: "Headphones", emoji: "🎧" },
    { name: "Smartphone", emoji: "📱" },
    { name: "Gaming Console", emoji: "🎮" },
    { name: "Sneakers", emoji: "👟" },
    { name: "Watch", emoji: "⌚" },
    { name: "Camera", emoji: "📷" },
    { name: "Tablet", emoji: "📲" },
    { name: "Blender", emoji: "🧊" },
    { name: "Coffee Maker", emoji: "☕" },
    { name: "Vacuum", emoji: "🧹" },
    { name: "Jacket", emoji: "🧥" },
    { name: "Handbag", emoji: "👜" },
  ],
  "Disaster Relief Donation": [
    { name: "Water Bottles", emoji: "🧴" },
    { name: "Canned Food", emoji: "🥫" },
    { name: "First Aid Kit", emoji: "🩹" },
    { name: "Blanket", emoji: "🛏️" },
    { name: "Flashlight", emoji: "🔦" },
    { name: "Batteries", emoji: "🔋" },
    { name: "Medicine", emoji: "💊" },
    { name: "Diapers", emoji: "🧷" },
    { name: "Hygiene Kit", emoji: "🧼" },
    { name: "Tent", emoji: "⛺" },
    { name: "Sleeping Bag", emoji: "🛌" },
    { name: "Radio", emoji: "📻" },
    { name: "Clothes", emoji: "👕" },
    { name: "Baby Formula", emoji: "🍼" },
  ],
  "Back to School": [
    { name: "Backpack", emoji: "🎒" },
    { name: "Notebook", emoji: "📓" },
    { name: "Pencils", emoji: "✏️" },
    { name: "Calculator", emoji: "🖩" },
    { name: "Scissors", emoji: "✂️" },
    { name: "Ruler", emoji: "📏" },
    { name: "Glue", emoji: "📎" },
    { name: "Lunchbox", emoji: "🍱" },
    { name: "Crayons", emoji: "🖍️" },
    { name: "Textbook", emoji: "📚" },
    { name: "Eraser", emoji: "🧽" },
    { name: "Highlighter", emoji: "🖊️" },
    { name: "Folder", emoji: "📂" },
    { name: "Markers", emoji: "🖌️" },
  ],
};

const DEFAULT_MOCK_ITEMS: MockItem[] = [
  { name: "Apple", emoji: "🍎" },
  { name: "Banana", emoji: "🍌" },
  { name: "Cherry", emoji: "🍒" },
  { name: "Avocado", emoji: "🥑" },
  { name: "Burger", emoji: "🍔" },
  { name: "Pizza", emoji: "🍕" },
  { name: "Ice Cream", emoji: "🍦" },
  { name: "Donut", emoji: "🍩" },
  { name: "Cookie", emoji: "🍪" },
  { name: "Beer", emoji: "🍺" },
  { name: "Basketball", emoji: "🏀" },
  { name: "Soccer Ball", emoji: "⚽" },
  { name: "Car", emoji: "🚗" },
  { name: "Rocket", emoji: "🚀" },
];

function getMockItemsForTheme(theme: string): MockItem[] {
  return THEME_MOCK_ITEMS[theme] ?? DEFAULT_MOCK_ITEMS;
}

export function createItemStream$(props: ItemStreamProps): Observable<GeneratedItem> {
  const themeMockItems = getMockItemsForTheme(props.theme);
  const items: GeneratedItem[] = Array.from({ length: props.count }, (_, i) => {
    const mockItem = themeMockItems[i % themeMockItems.length];
    return {
      name: mockItem.name,
      emoji: mockItem.emoji,
    };
  });

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
