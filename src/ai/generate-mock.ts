import { Observable, concatMap, delay, from, of, switchMap, toArray } from "rxjs";
import type { GeneratedItem, Interaction, ItemStreamProps } from "./generate";

interface MockItem {
  name: string;
  emoji: string;
  category?: string;
  packable?: boolean;
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
    // --- DRY GOODS: CLOTHING (Washable) ---
    { name: "Short-Sleeved Cotton Shirt", emoji: "👕", category: "Clothing", packable: true },
    { name: "Denim Jeans", emoji: "👖", category: "Clothing", packable: true },
    { name: "Bikini Set", emoji: "👙", category: "Clothing", packable: true },
    { name: "Heavy Duty Overcoat", emoji: "🧥", category: "Clothing", packable: true },
    { name: "Women's Tunic", emoji: "👚", category: "Clothing", packable: true },
    { name: "Woolen Socks", emoji: "🧦", category: "Clothing", packable: true },
    { name: "Insulated Gloves", emoji: "🧤", category: "Clothing", packable: true },
    { name: "Winter Scarf", emoji: "🧣", category: "Clothing", packable: true },
    { name: "Briefs", emoji: "🩲", category: "Clothing", packable: true },

    // --- DRY GOODS: SHELF-STABLE FOOD ---
    { name: "Chocolate Bar", emoji: "🍫", category: "Food", packable: true },

    // --- PERISHABLES: RAW/WET (Incompatible with dry containers) ---
    { name: "Bunch of Grapes", emoji: "🍇", category: "Perishable", packable: false },
    { name: "Vine-Ripened Tomato", emoji: "🍅", category: "Perishable", packable: false },
    { name: "Kiwi", emoji: "🥝", category: "Perishable", packable: false },
    { name: "Whole Pineapple", emoji: "🍍", category: "Perishable", packable: false },
    { name: "Ear of Corn", emoji: "🌽", category: "Perishable", packable: false },
    { name: "Russet Potato", emoji: "🥔", category: "Perishable", packable: false },
    { name: "Strips of Bacon", emoji: "🥓", category: "Raw Meat", packable: false },
    { name: "Raw Beef", emoji: "🥩", category: "Raw Meat", packable: false },
    { name: "Raw Egg", emoji: "🥚", category: "Fragile Perishable", packable: false },
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
      const interactions: Interaction[] = [];

      // Generate interactions, skipping successful (noop) combinations
      let attempts = 0;
      const maxAttempts = count * 10; // Avoid infinite loop

      while (interactions.length < count && attempts < maxAttempts) {
        attempts++;
        const item1 = items[Math.floor(Math.random() * items.length)];
        const item2 = items[Math.floor(Math.random() * items.length)];

        // Check if items are packable together based on compatibility rules
        const item1Packable = isPackable(item1.name);
        const item2Packable = isPackable(item2.name);
        const item1Category = getCategory(item1.name);
        const item2Category = getCategory(item2.name);

        // Both items are packable (clothing/shelf-stable food) -> Noop (skip)
        if (item1Packable && item2Packable) {
          continue;
        }

        // Raw meat or fragile perishable with anything -> Death (biological hazard)
        if (item1Category === "Raw Meat" || item2Category === "Raw Meat" || item1Category === "Fragile Perishable" || item2Category === "Fragile Perishable") {
          interactions.push({
            itemOneName: item1.name,
            itemTwoName: item2.name,
            speechBubbleWord: "Perished!",
          });
          continue;
        }

        // Regular perishables with packable items -> Poop (contamination)
        if ((item1Category === "Perishable" && item2Packable) || (item2Category === "Perishable" && item1Packable)) {
          interactions.push({
            itemOneName: item1.name,
            itemTwoName: item2.name,
            speechBubbleWord: "Contaminated!",
          });
          continue;
        }

        // Two non-packables together -> Poop (spoilage)
        interactions.push({
          itemOneName: item1.name,
          itemTwoName: item2.name,
          speechBubbleWord: "Spoiled!",
        });
      }

      return from(interactions).pipe(concatMap((interaction) => of(interaction).pipe(delay(100))));
    })
  );
}

// Helper functions to check item properties
function isPackable(itemName: string): boolean {
  for (const items of Object.values(THEME_MOCK_ITEMS)) {
    const item = items.find((i) => i.name === itemName);
    if (item) return item.packable ?? true; // Default items are packable
  }
  return true; // Default items are packable
}

function getCategory(itemName: string): string | undefined {
  for (const items of Object.values(THEME_MOCK_ITEMS)) {
    const item = items.find((i) => i.name === itemName);
    if (item) return item.category;
  }
  return undefined;
}
