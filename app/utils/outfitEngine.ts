/**
 * outfitEngine.ts
 * Rule-based daily outfit generation for FitSense.
 * Generates once per day, persisted via AsyncStorage.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ClothingColor =
    | 'black' | 'white' | 'grey' | 'navy' | 'blue' | 'khaki'
    | 'beige' | 'brown' | 'green' | 'red' | 'burgundy' | 'olive'
    | 'cream' | 'camel' | 'charcoal' | 'unknown';

export type BottomType = 'jeans' | 'trousers' | 'shorts' | 'chinos' | 'joggers';

export interface WardrobeItem {
    id: string;
    name: string;
    color: ClothingColor;
    emoji: string;
    image?: string | null;
    bottomType?: BottomType; // only for bottoms
    footwearType?: string;   // only for footwear
}

export interface Wardrobe {
    tops: WardrobeItem[];
    bottoms: WardrobeItem[];
    footwear: WardrobeItem[];
    accessories: WardrobeItem[];
    outerwear: WardrobeItem[];
}

export interface GeneratedOutfit {
    top: WardrobeItem;
    bottom: WardrobeItem;
    footwear: WardrobeItem;
    outerwear?: WardrobeItem | null;
    accessory?: WardrobeItem | null;
    generatedAt: string; // ISO date string, YYYY-MM-DD
}

// ─── Color Harmony Rules ──────────────────────────────────────────────────────

// Maps top color → compatible bottom colors
const COLOR_HARMONY: Record<ClothingColor, ClothingColor[]> = {
    black: ['blue', 'grey', 'black', 'white', 'khaki', 'olive', 'burgundy', 'charcoal'],
    white: ['black', 'blue', 'grey', 'navy', 'khaki', 'beige', 'olive', 'green', 'burgundy', 'charcoal'],
    grey: ['black', 'white', 'navy', 'blue', 'charcoal', 'burgundy'],
    navy: ['grey', 'beige', 'khaki', 'charcoal', 'white', 'black'],
    blue: ['black', 'grey', 'khaki', 'charcoal', 'navy', 'beige'],
    khaki: ['black', 'navy', 'white', 'brown', 'olive'],
    beige: ['navy', 'brown', 'black', 'olive', 'white'],
    brown: ['beige', 'khaki', 'cream', 'navy', 'black'],
    green: ['black', 'brown', 'khaki', 'beige', 'navy'],
    red: ['black', 'grey', 'navy', 'charcoal'],
    burgundy: ['grey', 'black', 'charcoal', 'beige'],
    olive: ['black', 'khaki', 'brown', 'navy', 'camel'],
    cream: ['navy', 'camel', 'brown', 'black'],
    camel: ['navy', 'white', 'black', 'grey'],
    charcoal: ['white', 'grey', 'black', 'blue'],
    unknown: ['black', 'grey', 'navy', 'khaki', 'white', 'brown', 'beige', 'charcoal'],
};

// Maps bottom type → suitable footwear types
const BOTTOM_TO_FOOTWEAR: Record<BottomType, string[]> = {
    jeans: ['sneakers', 'boots', 'loafers'],
    trousers: ['loafers', 'oxfords', 'brogues', 'derby'],
    shorts: ['sneakers', 'sandals', 'slip-ons'],
    chinos: ['loafers', 'sneakers', 'boots', 'brogues'],
    joggers: ['sneakers', 'slip-ons'],
};

// ─── Fallback Wardrobe (used if real wardrobe not available) ──────────────────

export const FALLBACK_WARDROBE: Wardrobe = {
    tops: [
        { id: 't1', name: 'Black Oversized Tee', color: 'black', emoji: '👕' },
        { id: 't2', name: 'White Linen Shirt', color: 'white', emoji: '👕' },
        { id: 't3', name: 'Navy Polo', color: 'navy', emoji: '👕' },
        { id: 't4', name: 'Grey Crewneck Sweatshirt', color: 'grey', emoji: '👕' },
        { id: 't5', name: 'Olive Henley', color: 'olive', emoji: '👕' },
        { id: 't6', name: 'Cream Knit Pullover', color: 'cream', emoji: '🧥' },
        { id: 't7', name: 'Burgundy Oxford Shirt', color: 'burgundy', emoji: '👕' },
    ],
    bottoms: [
        { id: 'b1', name: 'Blue Slim Jeans', color: 'blue', emoji: '👖', bottomType: 'jeans' },
        { id: 'b2', name: 'Black Skinny Jeans', color: 'black', emoji: '👖', bottomType: 'jeans' },
        { id: 'b3', name: 'Khaki Chinos', color: 'khaki', emoji: '👖', bottomType: 'chinos' },
        { id: 'b4', name: 'Grey Slim Trousers', color: 'grey', emoji: '👖', bottomType: 'trousers' },
        { id: 'b5', name: 'Olive Cargo Shorts', color: 'olive', emoji: '🩳', bottomType: 'shorts' },
        { id: 'b6', name: 'Navy Chinos', color: 'navy', emoji: '👖', bottomType: 'chinos' },
        { id: 'b7', name: 'Charcoal Joggers', color: 'charcoal', emoji: '👖', bottomType: 'joggers' },
    ],
    footwear: [
        { id: 'f1', name: 'White Sneakers', color: 'white', emoji: '👟', footwearType: 'sneakers' },
        { id: 'f2', name: 'Black Chelsea Boots', color: 'black', emoji: '🥾', footwearType: 'boots' },
        { id: 'f3', name: 'Brown Leather Loafers', color: 'brown', emoji: '🥿', footwearType: 'loafers' },
        { id: 'f4', name: 'Grey Slip-Ons', color: 'grey', emoji: '👟', footwearType: 'slip-ons' },
        { id: 'f5', name: 'Tan Derby Shoes', color: 'camel', emoji: '👞', footwearType: 'derby' },
        { id: 'f6', name: 'Black Brogues', color: 'black', emoji: '👞', footwearType: 'brogues' },
    ],
    accessories: [
        { id: 'a1', name: 'Silver Watch', color: 'grey', emoji: '⌚' },
        { id: 'a2', name: 'Black Cap', color: 'black', emoji: '🧢' },
        { id: 'a3', name: 'Gold Watch', color: 'camel', emoji: '⌚' },
        { id: 'a4', name: 'Navy Cap', color: 'navy', emoji: '🧢' },
        { id: 'a5', name: 'Leather Belt', color: 'brown', emoji: '🟤' },
    ],
    outerwear: [
        { id: 'o1', name: 'Black Bomber Jacket', color: 'black', emoji: '🧥' },
        { id: 'o2', name: 'Grey Denim Jacket', color: 'grey', emoji: '🧥' },
        { id: 'o3', name: 'Navy Blazer', color: 'navy', emoji: '🧥' },
        { id: 'o4', name: 'Olive Field Jacket', color: 'olive', emoji: '🧥' },
        { id: 'o5', name: 'Camel Overcoat', color: 'camel', emoji: '🧥' },
    ],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function randomItem<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

function getTodayString(): string {
    // Use local date to avoid timezone issues
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function normalizeColor(raw: string | null | undefined): ClothingColor {
    if (!raw) return 'unknown';
    const c = raw.toLowerCase().trim();
    const MAP: Record<string, ClothingColor> = {
        black: 'black', white: 'white', grey: 'grey', gray: 'grey',
        navy: 'navy', blue: 'blue', 'light blue': 'blue', 'dark blue': 'navy',
        khaki: 'khaki', tan: 'camel', camel: 'camel', beige: 'beige',
        brown: 'brown', green: 'green', 'dark green': 'green', olive: 'olive',
        red: 'red', burgundy: 'burgundy', maroon: 'burgundy', cream: 'cream',
        charcoal: 'charcoal', 'dark grey': 'charcoal', 'dark gray': 'charcoal',
    };
    return MAP[c] || 'unknown';
}

function inferBottomType(category: string, name: string): BottomType {
    const s = `${category} ${name}`.toLowerCase();
    if (s.includes('jean') || s.includes('denim')) return 'jeans';
    if (s.includes('short')) return 'shorts';
    if (s.includes('trouser') || s.includes('pant') || s.includes('slack')) return 'trousers';
    if (s.includes('jogger') || s.includes('sweat')) return 'joggers';
    return 'chinos'; // default
}

function inferFootwearType(category: string, name: string): string {
    const s = `${category} ${name}`.toLowerCase();
    if (s.includes('sneak') || s.includes('trainer') || s.includes('running')) return 'sneakers';
    if (s.includes('boot')) return 'boots';
    if (s.includes('loafer') || s.includes('moccasin')) return 'loafers';
    if (s.includes('sandal') || s.includes('flip')) return 'sandals';
    if (s.includes('oxford') || s.includes('derby')) return 'derby';
    if (s.includes('brogue')) return 'brogues';
    if (s.includes('slip')) return 'slip-ons';
    return 'sneakers'; // default
}

function getEmoji(category: string): string {
    switch (category) {
        case 'shirt':
        case 'tshirt':
            return '👕';
        case 'pants':
            return '👖';
        case 'shoes':
            return '👟';
        default:
            return '👕';
    }
}

// ─── Convert raw API wardrobe items into engine Wardrobe ─────────────────────

export function buildWardrobeFromItems(items: any[]) {
  const wardrobe: Wardrobe = {
    tops: [],
    bottoms: [],
    footwear: [],
    accessories: [],
    outerwear: [],
  };

  items.forEach((item) => {
    if (!item.category) return;

    const piece: WardrobeItem = {
      id: item.id,
      name: item.category,
      image: item.image ?? null,
      color: normalizeColor(item.color),
      emoji: getEmoji(item.category),
      bottomType:
        item.category === "pants"
          ? inferBottomType(item.category, item.name ?? "")
          : undefined,
      footwearType:
        item.category === "shoes"
          ? inferFootwearType(item.category, item.name ?? "")
          : undefined,
    };


    if (item.category === "shirt" || item.category === "tshirt") {
      wardrobe.tops.push(piece);
    }

    if (item.category === "pants") {
      wardrobe.bottoms.push(piece);
    }

    if (item.category === "shoes") {
      wardrobe.footwear.push(piece);
    }
  });

  return wardrobe;
}

// ─── Core Algorithm ───────────────────────────────────────────────────────────

export function generateDailyOutfit(wardrobe: Wardrobe): Omit<GeneratedOutfit, 'generatedAt'> {

    // Required categories (fallback allowed)
    const tops = wardrobe.tops.length > 0 ? wardrobe.tops : FALLBACK_WARDROBE.tops;
    const bottoms = wardrobe.bottoms.length > 0 ? wardrobe.bottoms : FALLBACK_WARDROBE.bottoms;
    const footwears = wardrobe.footwear.length > 0 ? wardrobe.footwear : FALLBACK_WARDROBE.footwear;

    // Optional categories (NO fallback — only show if user owns them)
    const accessories = wardrobe.accessories;
    const outerwears = wardrobe.outerwear;

    // ─── Step 1: Pick random top ───
    const top = randomItem(tops);

    // ─── Step 2: Match bottom with color harmony ───
    const harmonyColors = COLOR_HARMONY[top.color] || COLOR_HARMONY.unknown;

    const matchedBottoms = bottoms.filter(
        b => harmonyColors.includes(b.color)
    );

    const bottomPool = matchedBottoms.length > 0 ? matchedBottoms : bottoms;

    const bottom = randomItem(bottomPool);

    // ─── Step 3: Match footwear with bottom type ───
    const bottomType = (bottom.bottomType || 'jeans') as BottomType;

    const compatibleFootwearTypes =
        BOTTOM_TO_FOOTWEAR[bottomType] || BOTTOM_TO_FOOTWEAR.jeans;

    const matchedFootwear = footwears.filter(
        f => f.footwearType && compatibleFootwearTypes.includes(f.footwearType)
    );

    const footwearPool = matchedFootwear.length > 0 ? matchedFootwear : footwears;

    const footwear = randomItem(footwearPool);

    // ─── Step 4: Optional outerwear (only if wardrobe has it) ───
    let outerwear: WardrobeItem | null = null;

    if (outerwears.length > 0 && Math.random() < 0.30) {

        const matchedOuterwear = outerwears.filter(
            o => harmonyColors.includes(o.color)
        );

        const outerwearPool =
            matchedOuterwear.length > 0 ? matchedOuterwear : outerwears;

        outerwear = randomItem(outerwearPool);
    }

    // ─── Step 5: Optional accessory (only if wardrobe has it) ───
    let accessory: WardrobeItem | null = null;

    if (accessories.length > 0 && Math.random() < 0.50) {

        const matchedAccessories = accessories.filter(
            a => harmonyColors.includes(a.color) || a.color === 'unknown'
        );

        const accessoryPool =
            matchedAccessories.length > 0 ? matchedAccessories : accessories;

        accessory = randomItem(accessoryPool);
    }

   return {
    top: {
        ...top,
        image: top.image ?? null,
    },
    bottom: {
        ...bottom,
        image: bottom.image ?? null,
    },
    footwear: {
        ...footwear,
        image: footwear.image ?? null,
    },
    outerwear: outerwear
        ? {
              ...outerwear,
              image: outerwear.image ?? null,
          }
        : null,
    accessory: accessory
        ? {
              ...accessory,
              image: accessory.image ?? null,
          }
        : null,
};
}

// ─── Daily Persistence ────────────────────────────────────────────────────────

const STORAGE_KEY = 'fitsense_daily_outfit';

export async function getOrCreateDailyOutfit(wardrobe: Wardrobe): Promise<GeneratedOutfit> {
    const todayStr = getTodayString();

    try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed: GeneratedOutfit = JSON.parse(stored);
            if (parsed.generatedAt === todayStr) {
                return parsed; // Same day — reuse
            }
        }
    } catch (_) { }

    // Generate fresh
   const outfit : GeneratedOutfit = {
        ...generateDailyOutfit(wardrobe),
        generatedAt: todayStr,
    };

    try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(outfit));
    } catch (_) { }

    return outfit;
}

export async function forceRegenerateOutfit(wardrobe: Wardrobe): Promise<GeneratedOutfit> {
    const todayStr = getTodayString();
    const outfit: GeneratedOutfit = {
        ...generateDailyOutfit(wardrobe),
        generatedAt: todayStr,
    };
    try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(outfit));
    } catch (_) { }
    return outfit;
}
