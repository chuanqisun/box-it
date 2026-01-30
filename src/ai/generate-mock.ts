import { Observable, concatMap, delay, from, of, switchMap, toArray } from "rxjs";
import type { GeneratedItem, Interaction, ItemStreamProps } from "./generate";

type ItemCategory = "vegetable" | "protein" | "clothing" | "other" | undefined;

interface MockItem {
  name: string;
  emoji: string;
  category?: ItemCategory;
}

const THEME_MOCK_ITEMS: Record<string, MockItem[]> = {
  "Black Friday Sale": [
    { name: "TV", emoji: "📺", category: "other" },
    { name: "Laptop", emoji: "💻", category: "other" },
    { name: "Headphones", emoji: "🎧", category: "other" },
    { name: "Smartphone", emoji: "📱", category: "other" },
    { name: "Gaming Console", emoji: "🎮", category: "other" },
    { name: "Sneakers", emoji: "👟", category: "clothing" },
    { name: "Watch", emoji: "⌚", category: "other" },
    { name: "Camera", emoji: "📷", category: "other" },
    { name: "Tablet", emoji: "📲", category: "other" },
    { name: "Blender", emoji: "🧊", category: "other" },
    { name: "Coffee Maker", emoji: "☕", category: "other" },
    { name: "Vacuum", emoji: "🧹", category: "other" },
    { name: "Jacket", emoji: "🧥", category: "clothing" },
    { name: "Handbag", emoji: "👜", category: "other" },
  ],
  "Disaster Relief Donation": [
    // --- VEGETABLE ---
    { name: "Bunch of Grapes", emoji: "🍇", category: "vegetable" },
    { name: "Vine-Ripened Tomato", emoji: "🍅", category: "vegetable" },
    { name: "Kiwi", emoji: "🥝", category: "vegetable" },
    { name: "Whole Pineapple", emoji: "🍍", category: "vegetable" },
    { name: "Ear of Corn", emoji: "🌽", category: "vegetable" },
    { name: "Russet Potato", emoji: "🥔", category: "vegetable" },

    // --- PROTEIN ---
    { name: "Strips of Bacon", emoji: "🥓", category: "protein" },
    { name: "Raw Beef", emoji: "🥩", category: "protein" },
    { name: "Raw Egg", emoji: "🥚", category: "protein" },

    // --- CLOTHING ---
    { name: "Short-Sleeved Cotton Shirt", emoji: "👕", category: "clothing" },
    { name: "Denim Jeans", emoji: "👖", category: "clothing" },
    { name: "Bikini Set", emoji: "👙", category: "clothing" },
    { name: "Heavy Duty Overcoat", emoji: "🧥", category: "clothing" },
    { name: "Women's Tunic", emoji: "👚", category: "clothing" },
    { name: "Woolen Socks", emoji: "🧦", category: "clothing" },
    { name: "Insulated Gloves", emoji: "🧤", category: "clothing" },
    { name: "Winter Scarf", emoji: "🧣", category: "clothing" },
    { name: "Briefs", emoji: "🩲", category: "clothing" },

    // --- OTHER ---
    { name: "Chocolate Bar", emoji: "🍫", category: "other" },
  ],
  "Back to School": [
    { name: "Backpack", emoji: "🎒", category: "other" },
    { name: "Notebook", emoji: "📓", category: "other" },
    { name: "Pencils", emoji: "✏️", category: "other" },
    { name: "Calculator", emoji: "🖩", category: "other" },
    { name: "Scissors", emoji: "✂️", category: "other" },
    { name: "Ruler", emoji: "📏", category: "other" },
    { name: "Glue", emoji: "📎", category: "other" },
    { name: "Lunchbox", emoji: "🍱", category: "other" },
    { name: "Crayons", emoji: "🖍️", category: "other" },
    { name: "Textbook", emoji: "📚", category: "other" },
    { name: "Eraser", emoji: "🧽", category: "other" },
    { name: "Highlighter", emoji: "🖊️", category: "other" },
    { name: "Folder", emoji: "📂", category: "other" },
    { name: "Markers", emoji: "🖌️", category: "other" },
  ],
};

const DEFAULT_MOCK_ITEMS: MockItem[] = [
  { name: "Apple", emoji: "🍎", category: "vegetable" },
  { name: "Banana", emoji: "🍌", category: "vegetable" },
  { name: "Cherry", emoji: "🍒", category: "vegetable" },
  { name: "Avocado", emoji: "🥑", category: "vegetable" },
  { name: "Burger", emoji: "🍔", category: "protein" },
  { name: "Steak", emoji: "🥩", category: "protein" },
  { name: "Chicken", emoji: "🍗", category: "protein" },
  { name: "T-Shirt", emoji: "👕", category: "clothing" },
  { name: "Pants", emoji: "👖", category: "clothing" },
  { name: "Cookie", emoji: "🍪", category: "other" },
  { name: "Basketball", emoji: "🏀", category: "other" },
  { name: "Soccer Ball", emoji: "⚽", category: "other" },
  { name: "Car", emoji: "🚗", category: "other" },
  { name: "Rocket", emoji: "🚀", category: "other" },
];

function getMockItemsForTheme(theme: string): MockItem[] {
  return THEME_MOCK_ITEMS[theme] ?? DEFAULT_MOCK_ITEMS;
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
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

  const shuffledItems = shuffleArray(items);

  return from(shuffledItems).pipe(concatMap((item) => of(item).pipe(delay(50))));
}

export function simulateInteractions$(items$: Observable<GeneratedItem>): Observable<Interaction> {
  return items$.pipe(
    toArray(),
    switchMap((items) => {
      if (items.length === 0) return from([]);

      const interactions: Interaction[] = [];

      // Generate interactions based on category rules:
      // - Same category: no problem (skip)
      // - Protein + anything else: Contaminated!
      // - Fruit + anything else: Spoiled!
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const item1 = items[i];
          const item2 = items[j];

          const category1 = getItemCategory(item1.name);
          const category2 = getItemCategory(item2.name);

          // Same category -> no problem (skip)
          if (category1 === category2) {
            continue;
          }

          // Protein + anything else -> Contaminated!
          if (category1 === "protein" || category2 === "protein") {
            interactions.push({
              itemOneName: item1.name,
              itemTwoName: item2.name,
              speechBubbleWord: "Contaminated!",
            });
            continue;
          }

          // Vegetable + anything else -> Spoiled!
          if (category1 === "vegetable" || category2 === "vegetable") {
            interactions.push({
              itemOneName: item1.name,
              itemTwoName: item2.name,
              speechBubbleWord: "Spoiled!",
            });
            continue;
          }

          // Other combinations (clothing + other, etc.) -> no problem (skip)
        }
      }

      console.log("Generated interactions", interactions);

      return from(interactions).pipe(concatMap((interaction) => of(interaction).pipe(delay(10))));
    })
  );
}

// Helper function to get item category
function getItemCategory(itemName: string): ItemCategory {
  for (const items of Object.values(THEME_MOCK_ITEMS)) {
    const item = items.find((i) => i.name === itemName);
    if (item) return item.category;
  }
  // Check DEFAULT_MOCK_ITEMS as well
  const defaultItem = DEFAULT_MOCK_ITEMS.find((i) => i.name === itemName);
  if (defaultItem) return defaultItem.category;
  return undefined;
}
