/**
 * outfitEngine.ts
 * Intent-aware outfit generation for FitSense.
 * Pipeline: Parse Intent → Filter Candidates → Score Combinations → Rank & Diversify → Explain
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SERVER_BASE } from "./config";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ClothingColor =
  | "black"
  | "white"
  | "grey"
  | "navy"
  | "blue"
  | "khaki"
  | "beige"
  | "brown"
  | "green"
  | "red"
  | "burgundy"
  | "olive"
  | "cream"
  | "camel"
  | "charcoal"
  | "unknown";

export type BottomType = "jeans" | "trousers" | "shorts" | "chinos" | "joggers";

export type FitTag = "slim" | "regular" | "relaxed";
export type StyleTag =
  | "streetwear"
  | "casual"
  | "smart-casual"
  | "formal"
  | "minimal"
  | "preppy"
  | "workwear"
  | "athleisure";
export type OccasionTag =
  | "casual"
  | "weekend"
  | "outdoor"
  | "brunch"
  | "dinner"
  | "date"
  | "office"
  | "party";
export type SeasonTag = "summer" | "winter" | "fall" | "spring";

export interface WardrobeItem {
  id: string;
  name: string;
  color: ClothingColor;
  emoji: string;
  image?: string | null;
  bottomType?: BottomType; // only for bottoms
  footwearType?: string; // only for footwear
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
  generatedAt: string | number; // ISO date string or timestamp
  score?: number;
  reasons?: string[];
}

// ─── Color Harmony ────────────────────────────────────────────────────────────

const COLOR_HARMONY: Record<ClothingColor, ClothingColor[]> = {
  black: [
    "blue",
    "grey",
    "black",
    "white",
    "khaki",
    "olive",
    "burgundy",
    "charcoal",
  ],
  white: [
    "black",
    "blue",
    "grey",
    "navy",
    "khaki",
    "beige",
    "olive",
    "green",
    "burgundy",
    "charcoal",
  ],
  grey: ["black", "white", "navy", "blue", "charcoal", "burgundy"],
  navy: ["grey", "beige", "khaki", "charcoal", "white", "black"],
  blue: ["black", "grey", "khaki", "charcoal", "navy", "beige"],
  khaki: ["black", "navy", "white", "brown", "olive"],
  beige: ["navy", "brown", "black", "olive", "white"],
  brown: ["beige", "khaki", "cream", "navy", "black"],
  green: ["black", "brown", "khaki", "beige", "navy"],
  red: ["black", "grey", "navy", "charcoal"],
  burgundy: ["grey", "black", "charcoal", "beige"],
  olive: ["black", "khaki", "brown", "navy", "camel"],
  cream: ["navy", "camel", "brown", "black"],
  camel: ["navy", "white", "black", "grey"],
  charcoal: ["white", "grey", "black", "blue"],
  unknown: [
    "black",
    "grey",
    "navy",
    "khaki",
    "white",
    "brown",
    "beige",
    "charcoal",
  ],
};

const COLOR_CLASHES: [ClothingColor, ClothingColor][] = [
  ["blue", "green"],
  ["red", "green"],
  ["burgundy", "blue"],
  ["olive", "grey"],
  ["brown", "black"],
  ["navy", "blue"],
];

const NEUTRAL_COLORS = new Set<ClothingColor>([
  "black",
  "white",
  "grey",
  "navy",
  "charcoal",
  "beige",
  "cream",
]);

// ─── Bottom → Footwear Compatibility ─────────────────────────────────────────

const BOTTOM_TO_FOOTWEAR: Record<BottomType, string[]> = {
  jeans: ["sneakers", "boots", "loafers"],
  trousers: ["loafers", "oxfords", "brogues", "derby"],
  shorts: ["sneakers", "sandals", "slip-ons"],
  chinos: ["loafers", "sneakers", "boots", "brogues"],
  joggers: ["sneakers", "slip-ons"],
};

const FIT_COMPATIBILITY: Record<FitTag, Record<FitTag, number>> = {
  slim: { slim: 1.0, regular: 0.75, relaxed: 0.45 },
  regular: { slim: 0.75, regular: 1.0, relaxed: 0.8 },
  relaxed: { slim: 0.45, regular: 0.8, relaxed: 1.0 },
};

const STYLE_OCCASION_AFFINITY: Record<StyleTag, OccasionTag[]> = {
  streetwear: ["casual", "weekend", "outdoor"],
  casual: ["casual", "weekend", "brunch", "outdoor"],
  "smart-casual": ["brunch", "dinner", "date", "office"],
  formal: ["office", "dinner", "date", "party"],
  minimal: ["casual", "office", "dinner", "date"],
  preppy: ["brunch", "office", "casual"],
  workwear: ["office", "outdoor", "casual"],
  athleisure: ["casual", "weekend", "outdoor"],
};

const SEASON_KEYWORDS: Record<SeasonTag, string[]> = {
  summer: ["linen", "cotton", "shorts", "tee", "short sleeve", "light", "tank"],
  winter: [
    "wool",
    "knit",
    "coat",
    "puffer",
    "fleece",
    "sweater",
    "pullover",
    "hoodie",
    "jacket",
    "overcoat",
  ],
  fall: ["flannel", "corduroy", "denim jacket", "bomber", "chino", "cardigan"],
  spring: ["light jacket", "chino", "poplin", "shirt"],
};

// ─── Fallback Wardrobe ─────────────────────────────────────────────────────────

export const FALLBACK_WARDROBE: Wardrobe = {
  tops: [
    { id: "t1", name: "Black Oversized Tee", color: "black", emoji: "👕" },
    { id: "t2", name: "White Linen Shirt", color: "white", emoji: "👕" },
    { id: "t3", name: "Navy Polo", color: "navy", emoji: "👕" },
    { id: "t4", name: "Grey Crewneck Sweatshirt", color: "grey", emoji: "👕" },
    { id: "t5", name: "Olive Henley", color: "olive", emoji: "👕" },
    { id: "t6", name: "Cream Knit Pullover", color: "cream", emoji: "🧥" },
    { id: "t7", name: "Burgundy Oxford Shirt", color: "burgundy", emoji: "👕" },
  ],
  bottoms: [
    {
      id: "b1",
      name: "Blue Slim Jeans",
      color: "blue",
      emoji: "👖",
      bottomType: "jeans",
    },
    {
      id: "b2",
      name: "Black Skinny Jeans",
      color: "black",
      emoji: "👖",
      bottomType: "jeans",
    },
    {
      id: "b3",
      name: "Khaki Chinos",
      color: "khaki",
      emoji: "👖",
      bottomType: "chinos",
    },
    {
      id: "b4",
      name: "Grey Slim Trousers",
      color: "grey",
      emoji: "👖",
      bottomType: "trousers",
    },
    {
      id: "b5",
      name: "Olive Cargo Shorts",
      color: "olive",
      emoji: "🩳",
      bottomType: "shorts",
    },
    {
      id: "b6",
      name: "Navy Chinos",
      color: "navy",
      emoji: "👖",
      bottomType: "chinos",
    },
    {
      id: "b7",
      name: "Charcoal Joggers",
      color: "charcoal",
      emoji: "👖",
      bottomType: "joggers",
    },
  ],
  footwear: [
    {
      id: "f1",
      name: "White Sneakers",
      color: "white",
      emoji: "👟",
      footwearType: "sneakers",
    },
    {
      id: "f2",
      name: "Black Chelsea Boots",
      color: "black",
      emoji: "🥾",
      footwearType: "boots",
    },
    {
      id: "f3",
      name: "Brown Leather Loafers",
      color: "brown",
      emoji: "🥿",
      footwearType: "loafers",
    },
    {
      id: "f4",
      name: "Grey Slip-Ons",
      color: "grey",
      emoji: "👟",
      footwearType: "slip-ons",
    },
    {
      id: "f5",
      name: "Tan Derby Shoes",
      color: "camel",
      emoji: "👞",
      footwearType: "derby",
    },
    {
      id: "f6",
      name: "Black Brogues",
      color: "black",
      emoji: "👞",
      footwearType: "brogues",
    },
  ],
  accessories: [
    { id: "a1", name: "Silver Watch", color: "grey", emoji: "⌚" },
    { id: "a2", name: "Black Cap", color: "black", emoji: "🧢" },
    { id: "a3", name: "Gold Watch", color: "camel", emoji: "⌚" },
    { id: "a4", name: "Navy Cap", color: "navy", emoji: "🧢" },
    { id: "a5", name: "Leather Belt", color: "brown", emoji: "🟤" },
  ],
  outerwear: [
    { id: "o1", name: "Black Bomber Jacket", color: "black", emoji: "🧥" },
    { id: "o2", name: "Grey Denim Jacket", color: "grey", emoji: "🧥" },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTodayString() {
  return new Date().toISOString().split("T")[0];
}

function normalizeColor(c: any): ClothingColor {
  if (!c) return "unknown";
  const s = String(c).toLowerCase().trim();
  const MAP: Record<string, ClothingColor> = {
    black: "black",
    white: "white",
    grey: "grey",
    gray: "grey",
    navy: "navy",
    blue: "blue",
    "dark blue": "navy",
    khaki: "khaki",
    tan: "camel",
    camel: "camel",
    beige: "beige",
    brown: "brown",
    green: "green",
    "dark green": "green",
    olive: "olive",
    red: "red",
    burgundy: "burgundy",
    maroon: "burgundy",
    cream: "cream",
    charcoal: "charcoal",
    "dark grey": "charcoal",
    "dark gray": "charcoal",
  };
  return MAP[s] || "unknown";
}

function inferBottomType(category: string, name: string): BottomType {
  const s = `${category} ${name}`.toLowerCase();
  if (s.includes("jean") || s.includes("denim")) return "jeans";
  if (s.includes("short")) return "shorts";
  if (s.includes("trouser") || s.includes("pant") || s.includes("slack"))
    return "trousers";
  if (s.includes("jogger") || s.includes("sweat")) return "joggers";
  return "chinos"; // default
}

function inferFootwearType(category: string, name: string): string {
  const s = `${category} ${name}`.toLowerCase();
  if (s.includes("sneak") || s.includes("trainer") || s.includes("running"))
    return "sneakers";
  if (s.includes("boot")) return "boots";
  if (s.includes("loafer") || s.includes("moccasin")) return "loafers";
  if (s.includes("sandal") || s.includes("flip")) return "sandals";
  if (s.includes("oxford") || s.includes("derby")) return "derby";
  if (s.includes("brogue")) return "brogues";
  if (s.includes("slip")) return "slip-ons";
  return "sneakers"; // default
}

function getEmoji(category: string): string {
  const cat = String(category || "").toLowerCase();
  if (cat.includes("shirt") || cat.includes("top")) return "👕";
  if (cat.includes("pant") || cat.includes("jean") || cat.includes("short"))
    return "👖";
  if (cat.includes("shoe") || cat.includes("sneaker") || cat.includes("boot"))
    return "👟";
  return "👕";
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateRandomOutfit(wardrobe: Wardrobe) {
  return {
    top: randomItem(wardrobe.tops),
    bottom: randomItem(wardrobe.bottoms),
    footwear: randomItem(wardrobe.footwear),
    outerwear: wardrobe.outerwear.length
      ? randomItem(wardrobe.outerwear)
      : null,
    accessory: wardrobe.accessories.length
      ? randomItem(wardrobe.accessories)
      : null,
  };
}

// ─── Convert raw API wardrobe items into engine Wardrobe ─────────────────────

function getEmojiForCat(cat: string): string {
  if (cat.includes("shirt") || cat.includes("top")) return "👕";
  if (cat.includes("pant") || cat.includes("jean") || cat.includes("short"))
    return "👖";
  if (cat.includes("shoe") || cat.includes("sneaker") || cat.includes("boot"))
    return "👟";
  return "👕";
}

function isTopCat(cat: string) {
  return ["shirt", "tshirt", "top", "sweater", "jacket", "coat"].some((k) =>
    cat.includes(k),
  );
}
function isBottomCat(cat: string) {
  return ["pant", "jean", "trouser", "bottom", "short", "skirt"].some((k) =>
    cat.includes(k),
  );
}
function isFootwearCat(cat: string) {
  return ["shoe", "sneaker", "boot", "sandal", "loafer"].some((k) =>
    cat.includes(k),
  );
}
function isOuterwearCat(cat: string) {
  return ["jacket", "coat", "outerwear"].some((k) => cat.includes(k));
}
function isAccessoryCat(cat: string) {
  return ["accessory", "cap", "hat", "bag", "belt", "watch"].some((k) =>
    cat.includes(k),
  );
}

export function buildWardrobeFromItems(items: any[]): Wardrobe {
  const wardrobe: Wardrobe = {
    tops: [],
    bottoms: [],
    footwear: [],
    accessories: [],
    outerwear: [],
  };

  items.forEach((item) => {
    if (!item.category) return;
    const cat = item.category.toLowerCase().trim();

    // Dig out color from multiple possible locations
    const attrs = item.attributes || {};
    const normAttrs = attrs.normalized_attributes || {};
    const colorRaw = item.color || normAttrs.color || attrs.color || null;

    // Use style_category from Gemini for a richer name if available
    const geminiStyleCat =
      normAttrs.style_category || attrs.style_category || null;
    const displayName = geminiStyleCat
      ? `${geminiStyleCat}`
      : item.name || item.category;

    const piece: WardrobeItem = {
      id: item.id || item.item_id,
      name: displayName,
      image: item.image ?? item.image_url ?? null,
      color: normalizeColor(colorRaw),
      emoji: getEmojiForCat(cat),
      bottomType: isBottomCat(cat)
        ? inferBottomType(cat, displayName)
        : undefined,
      footwearType: isFootwearCat(cat)
        ? inferFootwearType(cat, displayName)
        : undefined,
    };

    if (isTopCat(cat)) wardrobe.tops.push(piece);
    else if (isBottomCat(cat)) wardrobe.bottoms.push(piece);
    else if (isFootwearCat(cat)) wardrobe.footwear.push(piece);
    else if (isOuterwearCat(cat)) wardrobe.outerwear.push(piece);
    else if (isAccessoryCat(cat)) wardrobe.accessories.push(piece);
    else wardrobe.tops.push(piece); // unknown → tops
  });

  return wardrobe;
}

// ─── Core Algorithm ───────────────────────────────────────────────────────────

/**
 * Fetch vector-based outfit recommendations from the backend.
 * Returns an array of up to 3 outfits.
 */
export async function getVectorBasedOutfits(
  userId: string,
  query: string = "casual outfit",
): Promise<GeneratedOutfit[]> {
  try {
    const url = `${SERVER_BASE}/api/recommend-outfit?user_id=${encodeURIComponent(userId)}&query=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      headers: {
        "x-user-id": userId,
      },
    });

    if (!response.ok) {
      throw new Error(`Backend recommendation failed: ${response.status}`);
    }

    const data = await response.json();
    const outfits = data.outfits;

    if (!outfits || !Array.isArray(outfits) || outfits.length === 0) {
      throw new Error("No outfit candidates returned from backend");
    }

    // BUG FIX: Helper to safely extract fields from the nested API item shape.
    function extractItem(
      item: any,
      fallbackEmoji: string,
    ): WardrobeItem | null {
      if (!item) return null;
      const attrs = item?.attributes || {};
      const norm = attrs?.normalized_attributes || attrs;

      const image: string | null =
        item?.image_url ??
        item?.image ??
        item?.img_url ??
        item?.image_path ??
        null;

      const colorRaw = norm?.color ?? attrs?.color ?? item?.color ?? null;

      const styleCat = norm?.style_category ?? attrs?.style_category ?? null;
      const name: string = styleCat ?? item?.name ?? item?.category ?? "Item";

      return {
        id: item?.item_id ?? item?.id,
        name,
        image,
        color: normalizeColor(colorRaw),
        emoji: fallbackEmoji,
      };
    }

    return outfits.map((best: any) => {
      const { top, bottom, shoes, outerwear, accessory } = best.outfit;
      return {
        top: extractItem(top, getEmoji(top?.category || "top"))!,
        bottom: {
          ...extractItem(bottom, getEmoji(bottom?.category || "bottom"))!,
          bottomType: inferBottomType(
            bottom?.category || "bottom",
            bottom?.name ?? "",
          ),
        },
        footwear: {
          ...extractItem(shoes, getEmoji(shoes?.category || "shoes"))!,
          footwearType: inferFootwearType(
            shoes?.category || "shoes",
            shoes?.name ?? "",
          ),
        },
        outerwear: extractItem(outerwear, "🧥"),
        accessory: extractItem(accessory, "⌚"),
        generatedAt: Date.now(),
        score: best.score,
        reasons: best.reasons,
      };
    });
  } catch (err) {
    console.warn(
      "Vector-based recommendation failed, falling back to rule-based:",
      err,
    );
    throw err;
  }
}

/**
 * Legacy wrapper for getVectorBasedOutfits that returns only the first result.
 */
export async function getVectorBasedOutfit(
  userId: string,
  query: string = "casual outfit",
): Promise<GeneratedOutfit> {
  const outfits = await getVectorBasedOutfits(userId, query);
  return outfits[0];
}

export function generateDailyOutfit(
  wardrobe: Wardrobe,
): Omit<GeneratedOutfit, "generatedAt"> {
  // Required categories (fallback allowed)
  const tops =
    wardrobe.tops.length > 0 ? wardrobe.tops : FALLBACK_WARDROBE.tops;
  const bottoms =
    wardrobe.bottoms.length > 0 ? wardrobe.bottoms : FALLBACK_WARDROBE.bottoms;
  const footwears =
    wardrobe.footwear.length > 0
      ? wardrobe.footwear
      : FALLBACK_WARDROBE.footwear;

  // Optional categories (NO fallback — only show if user owns them)
  const accessories = wardrobe.accessories;
  const outerwears = wardrobe.outerwear;

  // ─── Step 1: Pick random top ───
  const top = randomItem(tops);

  // ─── Step 2: Match bottom with color harmony ───
  const harmonyColors = COLOR_HARMONY[top.color] || COLOR_HARMONY.unknown;

  const matchedBottoms = bottoms.filter(
    (b) => harmonyColors.includes(b.color) && b.color !== top.color,
  );
  const bottomPool = matchedBottoms.length > 0 ? matchedBottoms : bottoms;

  const bottom = randomItem(bottomPool);

  // ─── Step 3: Match footwear with bottom type ───
  const bottomType = (bottom.bottomType || "jeans") as BottomType;

  const compatibleFootwearTypes =
    BOTTOM_TO_FOOTWEAR[bottomType] || BOTTOM_TO_FOOTWEAR.jeans;

  const matchedFootwear = footwears.filter(
    (f) =>
      f.footwearType &&
      compatibleFootwearTypes.includes(f.footwearType) &&
      (harmonyColors.includes(f.color) || f.color === bottom.color),
  );

  const footwearPool = matchedFootwear.length > 0 ? matchedFootwear : footwears;

  const footwear = randomItem(footwearPool);

  // ─── Step 4: Optional outerwear (only if wardrobe has it) ───
  let outerwear: WardrobeItem | null = null;

  if (outerwears.length > 0 && Math.random() < 0.6) {
    const matchedOuterwear = outerwears.filter(
      (o) => harmonyColors.includes(o.color) && o.color !== top.color,
    );

    const outerwearPool =
      matchedOuterwear.length > 0 ? matchedOuterwear : outerwears;

    outerwear = randomItem(outerwearPool);
  }

  // ─── Step 5: Optional accessory (only if wardrobe has it) ───
  let accessory: WardrobeItem | null = null;

  if (accessories.length > 0) {
    const matchedAccessories = accessories.filter(
      (a) => harmonyColors.includes(a.color) || a.color === "unknown",
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

const STORAGE_KEY = "fitsense_daily_outfit";

export async function getOrCreateDailyOutfit(
  wardrobe: Wardrobe,
  userId?: string,
  query?: string, // FIX: accept user query so it reaches the backend
): Promise<GeneratedOutfit> {
  const todayStr = getTodayString();

  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed: GeneratedOutfit = JSON.parse(stored);
      // FIX: don't reuse cached outfit when a new query is explicitly provided
      if (parsed.generatedAt === todayStr && !query) {
        return parsed; // Same day — reuse
      }
    }
  } catch (_) {}

  // Attempt vector-based generation if userId is provided
  if (userId) {
    try {
      const vectorOutfit = await getVectorBasedOutfit(userId, query);
      const outfit: GeneratedOutfit = {
        ...vectorOutfit,
        generatedAt: todayStr,
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(outfit));
      return outfit;
    } catch (err) {
      console.warn(
        "Vector-based generation failed, falling back to rule-based:",
        err,
      );
    }
  }

  // Generate fresh (rule-based fallback)
  const outfit: GeneratedOutfit = {
    ...generateDailyOutfit(wardrobe),
    generatedAt: todayStr,
  };

  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(outfit));
  } catch (_) {}

  return outfit;
}

export async function forceRegenerateOutfit(
  wardrobe: Wardrobe,
  userId?: string,
  query?: string, // FIX: accept user query
): Promise<GeneratedOutfit> {
  const todayStr = getTodayString();

  // Attempt vector-based generation if userId is provided
  if (userId) {
    try {
      const vectorOutfit = await getVectorBasedOutfit(userId, query);
      const outfit: GeneratedOutfit = {
        ...vectorOutfit,
        generatedAt: todayStr,
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(outfit));
      return outfit;
    } catch (err) {
      console.warn(
        "Vector-based regeneration failed, falling back to rule-based:",
        err,
      );
    }
  }

  const outfit: GeneratedOutfit = {
    ...generateBestOutfit(wardrobe),
    generatedAt: todayStr,
  };
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(outfit));
  } catch (_) {}
  return outfit;
}

function generateBestOutfit(
  wardrobe: Wardrobe,
): Omit<GeneratedOutfit, "generatedAt"> {
  // ensure wardrobe never empty
  const tops = wardrobe.tops.length ? wardrobe.tops : FALLBACK_WARDROBE.tops;
  const bottoms = wardrobe.bottoms.length
    ? wardrobe.bottoms
    : FALLBACK_WARDROBE.bottoms;
  const footwears = wardrobe.footwear.length
    ? wardrobe.footwear
    : FALLBACK_WARDROBE.footwear;

  const accessories = wardrobe.accessories;
  const outerwears = wardrobe.outerwear;

  let bestOutfit: Omit<GeneratedOutfit, "generatedAt"> | null = null;
  let bestScore = -Infinity;

  for (let i = 0; i < 40; i++) {
    const top = randomItem(tops);

    const harmonyColors = COLOR_HARMONY[top.color] || COLOR_HARMONY.unknown;

    const matchedBottoms = bottoms.filter(
      (b) => harmonyColors.includes(b.color) && b.color !== top.color,
    );

    const bottom = randomItem(matchedBottoms.length ? matchedBottoms : bottoms);

    const bottomType = (bottom.bottomType || "jeans") as BottomType;

    const compatibleFootwearTypes =
      BOTTOM_TO_FOOTWEAR[bottomType] || BOTTOM_TO_FOOTWEAR.jeans;

    const matchedFootwear = footwears.filter(
      (f) =>
        f.footwearType &&
        compatibleFootwearTypes.includes(f.footwearType) &&
        (harmonyColors.includes(f.color) || f.color === bottom.color),
    );

    const footwear = randomItem(
      matchedFootwear.length ? matchedFootwear : footwears,
    );

    let outerwear: WardrobeItem | null = null;

    if (outerwears.length && Math.random() < 0.6) {
      const matchedOuterwear = outerwears.filter(
        (o) => harmonyColors.includes(o.color) && o.color !== top.color,
      );

      outerwear = randomItem(
        matchedOuterwear.length ? matchedOuterwear : outerwears,
      );
    }

    let accessory: WardrobeItem | null = null;

    if (accessories.length) {
      const matchedAccessories = accessories.filter(
        (a) => harmonyColors.includes(a.color) || a.color === "unknown",
      );

      accessory = randomItem(
        matchedAccessories.length ? matchedAccessories : accessories,
      );
    }

    const candidate: Omit<GeneratedOutfit, "generatedAt"> = {
      top,
      bottom,
      footwear,
      outerwear,
      accessory,
    };

    const score = scoreOutfit(candidate);

    if (score > bestScore) {
      bestScore = score;
      bestOutfit = candidate;
    }
  }

  return bestOutfit!;
}

function scoreOutfit(outfit: Omit<GeneratedOutfit, "generatedAt">) {
  let score = 50;

  const neutral = ["black", "white", "grey", "navy"];

  if (neutral.includes(outfit.top.color)) score += 10;
  if (neutral.includes(outfit.bottom.color)) score += 10;

  const harmony = COLOR_HARMONY[outfit.top.color] || [];

  if (harmony.includes(outfit.bottom.color)) score += 20;

  if (harmony.includes(outfit.footwear.color)) score += 15;

  if (outfit.accessory) score += 5;

  if (
    outfit.top.name.toLowerCase().includes("blazer") &&
    outfit.bottom.name.toLowerCase().includes("short")
  ) {
    score -= 25;
  }

  return score;
}
