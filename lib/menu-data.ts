/**
 * Canonical menu for 305 Beverages Co. — the single source of truth for the
 * seed. Prices are in whole RUPEES here for readability; convert to paise with
 * `* 100` when persisting. Names, categories, spelling, and prices are
 * preserved EXACTLY as provided by the business.
 *
 * A Vitest spec asserts the SQL seed in `supabase/migrations` matches this
 * data so the two never drift.
 */
export interface SeedCategory {
  name: string;
  subgroup: string | null;
  sort: number;
  products: { name: string; price: number }[];
}

export const MENU: SeedCategory[] = [
  {
    name: "SODAWISE",
    subgroup: null,
    sort: 1,
    products: [
      { name: "Lemon", price: 60 },
      { name: "Kala Khatta", price: 60 },
      { name: "Jeera Masala", price: 60 },
      { name: "Paan", price: 60 },
      { name: "Aam Panna", price: 60 },
      { name: "Ginger Ale", price: 60 },
    ],
  },
  {
    name: "ICE TEA",
    subgroup: null,
    sort: 2,
    products: [
      { name: "Peach Ice Tea", price: 120 },
      { name: "Lemon Ice Tea", price: 120 },
    ],
  },
  {
    name: "305 Signature",
    subgroup: null,
    sort: 3,
    products: [
      { name: "Kiwi Tropical", price: 120 },
      { name: "Island Crush", price: 120 },
      { name: "Peach Gold", price: 120 },
      { name: "Mango Tango", price: 120 },
      { name: "Litchi Lemon", price: 120 },
      { name: "Apple Pineapple Cooler", price: 120 },
      { name: "Fridge Cigarette", price: 140 },
    ],
  },
  {
    name: "MATCH",
    subgroup: null,
    sort: 4,
    products: [
      { name: "Classic Matcha", price: 160 },
      { name: "Strawberry matcha", price: 180 },
      { name: "Mango Matcha", price: 180 },
      { name: "Watermelon Match", price: 200 },
      { name: "Blueberry Matcha", price: 200 },
      { name: "Tender Coconut Matcha", price: 200 },
    ],
  },
  {
    name: "MOCKTAILS",
    subgroup: "Fruit Crush",
    sort: 5,
    products: [
      { name: "Pineapple", price: 80 },
      { name: "Orange", price: 80 },
      { name: "Black Current", price: 80 },
      { name: "Strawberry", price: 80 },
      { name: "Litchi", price: 80 },
      { name: "Mango", price: 80 },
      { name: "Watermelon", price: 80 },
      { name: "Tender Coconut", price: 100 },
      { name: "Blueberry", price: 100 },
      { name: "Kiwi", price: 100 },
      { name: "Custard Apple", price: 100 },
      { name: "Cranberry", price: 120 },
      { name: "Raspberry", price: 120 },
    ],
  },
  {
    name: "SYRUPS",
    subgroup: null,
    sort: 6,
    products: [
      { name: "Bubblegum", price: 80 },
      { name: "Blue Curacao", price: 80 },
      { name: "Pinacolada", price: 80 },
      { name: "Mint Mojito", price: 80 },
      { name: "Virgin Mojito", price: 80 },
    ],
  },
  {
    name: "Coffee Menu",
    subgroup: null,
    sort: 7,
    products: [
      { name: "Iced Americano", price: 80 },
      { name: "Classic Iced Lattee", price: 100 },
      { name: "Spanish Lattee", price: 120 },
      { name: "Caramel Iced Lattee", price: 120 },
      { name: "Vanilla Iced Lattee", price: 120 },
      { name: "Hazelnut Iced Lattee", price: 120 },
      { name: "Iced Mocha", price: 120 },
    ],
  },
];

export const DEFAULT_EXPENSE_CATEGORIES: string[] = [
  "Ingredients and Raw Materials",
  "Milk and Dairy",
  "Fruits",
  "Syrups and Flavours",
  "Tea, Coffee and Matcha",
  "Cups, Lids and Packaging",
  "Ice and Water",
  "Staff Salaries",
  "Rent",
  "Electricity and Utilities",
  "Transportation and Delivery",
  "Marketing and Advertising",
  "Equipment and Maintenance",
  "Repairs",
  "Miscellaneous",
];

/** Total product count across all categories (used by seed-integrity test). */
export const TOTAL_PRODUCTS = MENU.reduce(
  (acc, c) => acc + c.products.length,
  0
);
