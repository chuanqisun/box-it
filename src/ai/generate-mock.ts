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
    { name: "TV", emoji: "📺", category: "Electronics", packable: true },
    { name: "Laptop", emoji: "💻", category: "Electronics", packable: true },
    { name: "Headphones", emoji: "🎧", category: "Electronics", packable: true },
    { name: "Smartphone", emoji: "📱", category: "Electronics", packable: true },
    { name: "Gaming Console", emoji: "🎮", category: "Electronics", packable: true },
    { name: "Sneakers", emoji: "👟", category: "Clothing", packable: true },
    { name: "Watch", emoji: "⌚", category: "Accessories", packable: true },
    { name: "Camera", emoji: "📷", category: "Electronics", packable: true },
    { name: "Tablet", emoji: "📲", category: "Electronics", packable: true },
    { name: "Blender", emoji: "🧊", category: "Appliances", packable: true },
    { name: "Coffee Maker", emoji: "☕", category: "Appliances", packable: true },
    { name: "Vacuum", emoji: "🧹", category: "Appliances", packable: true },
    { name: "Jacket", emoji: "🧥", category: "Clothing", packable: true },
    { name: "Handbag", emoji: "👜", category: "Accessories", packable: true },
  ],
  "Disaster Relief Donation": [
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
  ],
  "Back to School": [
    { name: "Backpack", emoji: "🎒", category: "Accessories", packable: true },
    { name: "Notebook", emoji: "📓", category: "School Supplies", packable: true },
    { name: "Pencils", emoji: "✏️", category: "School Supplies", packable: true },
    { name: "Calculator", emoji: "🖩", category: "Electronics", packable: true },
    { name: "Scissors", emoji: "✂️", category: "School Supplies", packable: true },
    { name: "Ruler", emoji: "📏", category: "School Supplies", packable: true },
    { name: "Glue", emoji: "📎", category: "School Supplies", packable: true },
    { name: "Lunchbox", emoji: "🍱", category: "Accessories", packable: true },
    { name: "Crayons", emoji: "🖍️", category: "School Supplies", packable: true },
    { name: "Textbook", emoji: "📚", category: "School Supplies", packable: true },
    { name: "Eraser", emoji: "🧽", category: "School Supplies", packable: true },
    { name: "Highlighter", emoji: "🖊️", category: "School Supplies", packable: true },
    { name: "Folder", emoji: "📂", category: "School Supplies", packable: true },
    { name: "Markers", emoji: "🖌️", category: "School Supplies", packable: true },
  ],
};

const DEFAULT_MOCK_ITEMS: MockItem[] = [
  { name: "Apple", emoji: "🍎", category: "Perishable", packable: false },
  { name: "Banana", emoji: "🍌", category: "Perishable", packable: false },
  { name: "Cherry", emoji: "🍒", category: "Perishable", packable: false },
  { name: "Avocado", emoji: "🥑", category: "Perishable", packable: false },
  { name: "Burger", emoji: "🍔", category: "Perishable", packable: false },
  { name: "Pizza", emoji: "🍕", category: "Perishable", packable: false },
  { name: "Ice Cream", emoji: "🍦", category: "Perishable", packable: false },
  { name: "Donut", emoji: "🍩", category: "Perishable", packable: false },
  { name: "Cookie", emoji: "🍪", category: "Food", packable: true },
  { name: "Beer", emoji: "🍺", category: "Beverage", packable: true },
  { name: "Basketball", emoji: "🏀", category: "Sports", packable: true },
  { name: "Soccer Ball", emoji: "⚽", category: "Sports", packable: true },
  { name: "Car", emoji: "🚗", category: "Toys", packable: true },
  { name: "Rocket", emoji: "🚀", category: "Toys", packable: true },
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

export function simulateInteractions$(items$: Observable<GeneratedItem>): Observable<Interaction> {
  return items$.pipe(
    toArray(),
    switchMap((items) => {
      if (items.length === 0) return from([]);

      const interactions: Interaction[] = [];

      // Generate ALL possible interactions exhaustively, skipping successful (noop) combinations
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const item1 = items[i];
          const item2 = items[j];

          const item1Packable = isPackable(item1.name);
          const item2Packable = isPackable(item2.name);

          // Both items are packable -> Noop (skip)
          if (item1Packable && item2Packable) {
            continue;
          }

          // Both non-packable -> random Perished or Spoiled
          if (!item1Packable && !item2Packable) {
            interactions.push({
              itemOneName: item1.name,
              itemTwoName: item2.name,
              speechBubbleWord: Math.random() < 0.5 ? "Perished!" : "Spoiled!",
            });
            continue;
          }

          // One non-packable with one packable -> Contaminated
          interactions.push({
            itemOneName: item1.name,
            itemTwoName: item2.name,
            speechBubbleWord: "Contaminated!",
          });
        }
      }

      console.log("Generated interactions", interactions);

      return from(interactions).pipe(concatMap((interaction) => of(interaction).pipe(delay(10))));
    })
  );
}

// Helper function to check if item is packable
function isPackable(itemName: string): boolean {
  for (const items of Object.values(THEME_MOCK_ITEMS)) {
    const item = items.find((i) => i.name === itemName);
    if (item) return item.packable ?? true;
  }
  // Check DEFAULT_MOCK_ITEMS as well
  const defaultItem = DEFAULT_MOCK_ITEMS.find((i) => i.name === itemName);
  if (defaultItem) return defaultItem.packable ?? true;
  return true;
}
