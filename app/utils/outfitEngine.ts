/**
 * outfitEngine.ts
 * Intent-aware outfit generation for FitSense.
 * Pipeline: Parse Intent → Filter Candidates → Score Combinations → Rank & Diversify → Explain
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ClothingColor =
  | 'black' | 'white' | 'grey' | 'navy' | 'blue' | 'khaki'
  | 'beige' | 'brown' | 'green' | 'red' | 'burgundy' | 'olive'
  | 'cream' | 'camel' | 'charcoal' | 'unknown';

export type BottomType = 'jeans' | 'trousers' | 'shorts' | 'chinos' | 'joggers';

export type StyleTag =
  | 'streetwear' | 'casual' | 'smart-casual' | 'formal'
  | 'minimal' | 'preppy' | 'workwear' | 'athleisure';

export type OccasionTag =
  | 'casual' | 'office' | 'dinner' | 'date' | 'brunch'
  | 'weekend' | 'party' | 'outdoor';

export type SeasonTag = 'spring' | 'summer' | 'fall' | 'winter';

export type FitTag = 'slim' | 'regular' | 'relaxed';

export interface WardrobeItem {
  id: string;
  name: string;
  color: ClothingColor;
  emoji: string;
  image?: string | null;
  // Bottom specific
  bottomType?: BottomType;
  // Footwear specific
  footwearType?: string;
  // Scoring metadata (inferred from name/category if not set)
  style?: StyleTag[];
  occasion?: OccasionTag[];
  season?: SeasonTag[];
  fit?: FitTag;
}

export interface Wardrobe {
  tops: WardrobeItem[];
  bottoms: WardrobeItem[];
  footwear: WardrobeItem[];
  accessories: WardrobeItem[];
  outerwear: WardrobeItem[];
}

/**
 * Structured user intent parsed from a natural language prompt.
 * e.g. "casual streetwear for summer" →
 * { styles: ['streetwear','casual'], occasions: ['casual'], seasons: ['summer'], fits: ['relaxed'] }
 */
export interface OutfitIntent {
  styles: StyleTag[];
  occasions: OccasionTag[];
  seasons: SeasonTag[];
  fits: FitTag[];
  rawPrompt: string;
}

/**
 * Score breakdown — each dimension 0.0–1.0, weighted into a final 0–100 score.
 */
export interface OutfitScore {
  total: number;        // 0–100, the final weighted score
  styleMatch: number;   // 0–1, how well all items align to requested style
  colorHarmony: number; // 0–1, color pairing quality
  fitBalance: number;   // 0–1, top/bottom fit silhouette compatibility
  occasionMatch: number;// 0–1, how appropriate items are for the occasion
  seasonMatch: number;  // 0–1, how season-appropriate the outfit is
  diversityBonus: number;// 0–1, rewards unique combinations
}

export interface ScoredOutfit {
  top: WardrobeItem;
  bottom: WardrobeItem;
  footwear: WardrobeItem;
  outerwear?: WardrobeItem | null;
  accessory?: WardrobeItem | null;
  score: OutfitScore;
  reasons: string[];       // human-readable explanation of why this outfit scores well
  generatedAt: string;     // ISO date string YYYY-MM-DD
}

// Legacy type alias so existing code using GeneratedOutfit doesn't break
export type GeneratedOutfit = ScoredOutfit;

// ─── Color Harmony Rules ──────────────────────────────────────────────────────

const COLOR_HARMONY: Record<ClothingColor, ClothingColor[]> = {
  black: ['blue', 'grey', 'white', 'khaki', 'olive', 'burgundy', 'charcoal', 'beige', 'camel'],
  white: ['black', 'blue', 'grey', 'navy', 'khaki', 'beige', 'olive', 'green', 'burgundy', 'charcoal'],
  grey: ['black', 'white', 'navy', 'blue', 'charcoal', 'burgundy', 'camel'],
  navy: ['grey', 'beige', 'khaki', 'charcoal', 'white', 'black', 'camel', 'burgundy'],
  blue: ['black', 'grey', 'khaki', 'charcoal', 'navy', 'beige', 'white'],
  khaki: ['black', 'navy', 'white', 'brown', 'olive', 'beige'],
  beige: ['navy', 'brown', 'black', 'olive', 'white', 'camel'],
  brown: ['beige', 'khaki', 'cream', 'navy', 'black', 'camel'],
  green: ['black', 'brown', 'khaki', 'beige', 'navy'],
  red: ['black', 'grey', 'navy', 'charcoal'],
  burgundy: ['grey', 'black', 'charcoal', 'beige', 'navy', 'camel'],
  olive: ['black', 'khaki', 'brown', 'navy', 'camel', 'beige'],
  cream: ['navy', 'camel', 'brown', 'black', 'burgundy'],
  camel: ['navy', 'white', 'black', 'grey', 'burgundy', 'brown'],
  charcoal: ['white', 'grey', 'black', 'blue', 'camel', 'burgundy'],
  unknown: ['black', 'grey', 'navy', 'khaki', 'white', 'brown', 'beige', 'charcoal'],
};

// Clash pairs — these combinations actively hurt the score
const COLOR_CLASHES: [ClothingColor, ClothingColor][] = [
  ['blue', 'green'],
  ['red', 'green'],
  ['burgundy', 'blue'],
  ['olive', 'grey'],
  ['brown', 'black'], // mixing warm+cool browns with black
  ['navy', 'blue'],   // two similar blues look unintentional
];

const NEUTRAL_COLORS = new Set<ClothingColor>(['black', 'white', 'grey', 'navy', 'charcoal', 'beige', 'cream']);

// ─── Bottom → Footwear Compatibility ─────────────────────────────────────────

const BOTTOM_TO_FOOTWEAR: Record<BottomType, string[]> = {
  jeans: ['sneakers', 'boots', 'loafers', 'brogues'],
  trousers: ['loafers', 'derby', 'brogues', 'oxfords', 'boots'],
  shorts: ['sneakers', 'sandals', 'slip-ons'],
  chinos: ['loafers', 'sneakers', 'boots', 'brogues', 'derby'],
  joggers: ['sneakers', 'slip-ons'],
};

// ─── Fit Silhouette Compatibility ─────────────────────────────────────────────
// Scores how well top fit + bottom fit work together visually.
// relaxed+relaxed = deliberate, slim+slim = sharp, mixing is context-dependent.

const FIT_COMPATIBILITY: Record<FitTag, Record<FitTag, number>> = {
  slim: { slim: 1.0, regular: 0.75, relaxed: 0.45 },
  regular: { slim: 0.75, regular: 1.0, relaxed: 0.80 },
  relaxed: { slim: 0.45, regular: 0.80, relaxed: 1.0 },
};

// ─── Style → Occasion mapping (used when user specifies occasion not style) ───

const STYLE_OCCASION_AFFINITY: Record<StyleTag, OccasionTag[]> = {
  streetwear: ['casual', 'weekend', 'outdoor'],
  casual: ['casual', 'weekend', 'brunch', 'outdoor'],
  'smart-casual': ['brunch', 'dinner', 'date', 'office'],
  formal: ['office', 'dinner', 'date', 'party'],
  minimal: ['casual', 'office', 'dinner', 'date'],
  preppy: ['brunch', 'office', 'casual'],
  workwear: ['office', 'outdoor', 'casual'],
  athleisure: ['casual', 'weekend', 'outdoor'],
};

// ─── Season Appropriateness ────────────────────────────────────────────────────

// Items without a season tag are assumed all-season.
// This map nudges certain fabric/style keywords toward a season.
const SEASON_KEYWORDS: Record<SeasonTag, string[]> = {
  summer: ['linen', 'cotton', 'shorts', 'tee', 'short sleeve', 'light', 'tank'],
  winter: ['wool', 'knit', 'coat', 'puffer', 'fleece', 'sweater', 'pullover', 'hoodie', 'jacket', 'overcoat'],
  fall: ['flannel', 'corduroy', 'denim jacket', 'bomber', 'chino', 'cardigan'],
  spring: ['light jacket', 'chino', 'poplin', 'shirt'],
};

// ─── Fallback Wardrobe ─────────────────────────────────────────────────────────

export const FALLBACK_WARDROBE: Wardrobe = {
  tops: [
    { id: 't1', name: 'Black Oversized Tee', color: 'black', emoji: '👕', style: ['streetwear', 'casual'], fit: 'relaxed', season: ['spring', 'summer', 'fall'], occasion: ['casual', 'weekend'] },
    { id: 't2', name: 'White Linen Shirt', color: 'white', emoji: '👕', style: ['smart-casual', 'minimal'], fit: 'regular', season: ['summer'], occasion: ['casual', 'brunch', 'dinner'] },
    { id: 't3', name: 'Navy Polo', color: 'navy', emoji: '👕', style: ['smart-casual', 'preppy'], fit: 'slim', season: ['spring', 'summer'], occasion: ['casual', 'office', 'brunch'] },
    { id: 't4', name: 'Grey Crewneck Sweatshirt', color: 'grey', emoji: '👕', style: ['streetwear', 'casual'], fit: 'relaxed', season: ['fall', 'winter'], occasion: ['casual', 'weekend'] },
    { id: 't5', name: 'Olive Henley', color: 'olive', emoji: '👕', style: ['casual', 'workwear'], fit: 'regular', season: ['spring', 'fall'], occasion: ['casual', 'weekend'] },
    { id: 't6', name: 'Cream Knit Pullover', color: 'cream', emoji: '🧥', style: ['minimal', 'smart-casual'], fit: 'regular', season: ['fall', 'winter'], occasion: ['brunch', 'dinner', 'casual'] },
    { id: 't7', name: 'Burgundy Oxford Shirt', color: 'burgundy', emoji: '👕', style: ['smart-casual', 'formal'], fit: 'slim', season: ['fall', 'winter'], occasion: ['office', 'dinner', 'date'] },
  ],
  bottoms: [
    { id: 'b1', name: 'Blue Slim Jeans', color: 'blue', emoji: '👖', bottomType: 'jeans', style: ['casual', 'streetwear'], fit: 'slim', season: ['spring', 'summer', 'fall'], occasion: ['casual', 'date', 'brunch'] },
    { id: 'b2', name: 'Black Skinny Jeans', color: 'black', emoji: '👖', bottomType: 'jeans', style: ['streetwear', 'minimal'], fit: 'slim', season: ['spring', 'summer', 'fall', 'winter'], occasion: ['casual', 'date', 'dinner'] },
    { id: 'b3', name: 'Khaki Chinos', color: 'khaki', emoji: '👖', bottomType: 'chinos', style: ['smart-casual', 'preppy'], fit: 'regular', season: ['spring', 'summer', 'fall'], occasion: ['office', 'brunch', 'casual'] },
    { id: 'b4', name: 'Grey Slim Trousers', color: 'grey', emoji: '👖', bottomType: 'trousers', style: ['smart-casual', 'formal', 'minimal'], fit: 'slim', season: ['spring', 'fall', 'winter'], occasion: ['office', 'dinner', 'date'] },
    { id: 'b5', name: 'Olive Cargo Shorts', color: 'olive', emoji: '🩳', bottomType: 'shorts', style: ['streetwear', 'casual'], fit: 'relaxed', season: ['summer'], occasion: ['casual', 'weekend', 'brunch'] },
    { id: 'b6', name: 'Navy Chinos', color: 'navy', emoji: '👖', bottomType: 'chinos', style: ['smart-casual', 'preppy'], fit: 'regular', season: ['spring', 'fall'], occasion: ['office', 'brunch', 'casual'] },
    { id: 'b7', name: 'Charcoal Joggers', color: 'charcoal', emoji: '👖', bottomType: 'joggers', style: ['streetwear', 'athleisure'], fit: 'relaxed', season: ['fall', 'winter'], occasion: ['casual', 'weekend'] },
  ],
  footwear: [
    { id: 'f1', name: 'White Sneakers', color: 'white', emoji: '👟', footwearType: 'sneakers', style: ['streetwear', 'casual', 'minimal'], fit: 'relaxed', season: ['spring', 'summer', 'fall'], occasion: ['casual', 'weekend', 'brunch'] },
    { id: 'f2', name: 'Black Chelsea Boots', color: 'black', emoji: '🥾', footwearType: 'boots', style: ['smart-casual', 'minimal'], fit: 'slim', season: ['fall', 'winter'], occasion: ['dinner', 'date', 'office'] },
    { id: 'f3', name: 'Brown Leather Loafers', color: 'brown', emoji: '🥿', footwearType: 'loafers', style: ['smart-casual', 'preppy'], fit: 'regular', season: ['spring', 'summer', 'fall'], occasion: ['office', 'brunch', 'dinner'] },
    { id: 'f4', name: 'Grey Slip-Ons', color: 'grey', emoji: '👟', footwearType: 'slip-ons', style: ['casual', 'minimal'], fit: 'relaxed', season: ['spring', 'summer'], occasion: ['casual', 'weekend'] },
    { id: 'f5', name: 'Tan Derby Shoes', color: 'camel', emoji: '👞', footwearType: 'derby', style: ['smart-casual', 'formal'], fit: 'slim', season: ['spring', 'fall'], occasion: ['office', 'dinner', 'date'] },
    { id: 'f6', name: 'Black Brogues', color: 'black', emoji: '👞', footwearType: 'brogues', style: ['smart-casual', 'formal'], fit: 'slim', season: ['fall', 'winter'], occasion: ['office', 'dinner', 'date'] },
  ],
  accessories: [
    { id: 'a1', name: 'Silver Watch', color: 'grey', emoji: '⌚', style: ['minimal', 'smart-casual'], occasion: ['office', 'dinner', 'date', 'brunch'] },
    { id: 'a2', name: 'Black Cap', color: 'black', emoji: '🧢', style: ['streetwear', 'casual'], occasion: ['casual', 'weekend'] },
    { id: 'a3', name: 'Gold Watch', color: 'camel', emoji: '⌚', style: ['smart-casual', 'formal'], occasion: ['dinner', 'date', 'office'] },
    { id: 'a4', name: 'Navy Cap', color: 'navy', emoji: '🧢', style: ['streetwear', 'casual'], occasion: ['casual', 'weekend'] },
    { id: 'a5', name: 'Leather Belt', color: 'brown', emoji: '🪢', style: ['smart-casual', 'preppy'], occasion: ['office', 'dinner', 'brunch'] },
  ],
  outerwear: [
    { id: 'o1', name: 'Black Bomber Jacket', color: 'black', emoji: '🧥', style: ['streetwear', 'casual'], fit: 'regular', season: ['spring', 'fall'], occasion: ['casual', 'weekend'] },
    { id: 'o2', name: 'Grey Denim Jacket', color: 'grey', emoji: '🧥', style: ['casual', 'streetwear'], fit: 'regular', season: ['spring', 'fall'], occasion: ['casual', 'brunch'] },
    { id: 'o3', name: 'Navy Blazer', color: 'navy', emoji: '🧥', style: ['smart-casual', 'formal'], fit: 'slim', season: ['spring', 'fall'], occasion: ['office', 'dinner', 'date'] },
    { id: 'o4', name: 'Olive Field Jacket', color: 'olive', emoji: '🧥', style: ['casual', 'workwear'], fit: 'regular', season: ['fall'], occasion: ['casual', 'outdoor'] },
    { id: 'o5', name: 'Camel Overcoat', color: 'camel', emoji: '🧥', style: ['minimal', 'smart-casual'], fit: 'regular', season: ['fall', 'winter'], occasion: ['dinner', 'office', 'date'] },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getTodayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function normalizeColor(raw: string | null | undefined): ClothingColor {
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

export function inferBottomType(category: string, name: string): BottomType {
  const s = `${category} ${name}`.toLowerCase();
  if (s.includes('jean') || s.includes('denim')) return 'jeans';
  if (s.includes('short')) return 'shorts';
  if (s.includes('trouser') || s.includes('pant') || s.includes('slack')) return 'trousers';
  if (s.includes('jogger') || s.includes('sweat')) return 'joggers';
  return 'chinos';
}

export function inferFootwearType(category: string, name: string): string {
  const s = `${category} ${name}`.toLowerCase();
  if (s.includes('sneak') || s.includes('trainer') || s.includes('running')) return 'sneakers';
  if (s.includes('boot')) return 'boots';
  if (s.includes('loafer') || s.includes('moccasin')) return 'loafers';
  if (s.includes('sandal') || s.includes('flip')) return 'sandals';
  if (s.includes('oxford')) return 'oxfords';
  if (s.includes('derby')) return 'derby';
  if (s.includes('brogue')) return 'brogues';
  if (s.includes('slip')) return 'slip-ons';
  return 'sneakers';
}

function getEmoji(category: string): string {
  switch (category) {
    case 'shirt': case 'tshirt': return '👕';
    case 'pants': return '👖';
    case 'shoes': return '👟';
    default: return '👕';
  }
}

function inferStyleTags(name: string, category: string): StyleTag[] {
  const s = `${name} ${category}`.toLowerCase();
  const tags: StyleTag[] = [];
  if (s.includes('oversized') || s.includes('cargo') || s.includes('jogger') || s.includes('hoodie')) tags.push('streetwear');
  if (s.includes('linen') || s.includes('polo') || s.includes('oxford') || s.includes('chino') || s.includes('blazer')) tags.push('smart-casual');
  if (s.includes('slim') || s.includes('trouser') || s.includes('derby') || s.includes('brogue')) tags.push('formal');
  if (s.includes('knit') || s.includes('minimal') || s.includes('clean')) tags.push('minimal');
  if (s.includes('sneaker') || s.includes('tee') || s.includes('t-shirt')) tags.push('casual');
  if (!tags.length) tags.push('casual');
  return tags;
}

function inferSeasonTags(name: string): SeasonTag[] {
  const s = name.toLowerCase();
  const seasons: SeasonTag[] = [];
  for (const [season, keywords] of Object.entries(SEASON_KEYWORDS)) {
    if (keywords.some(k => s.includes(k))) seasons.push(season as SeasonTag);
  }
  return seasons.length ? seasons : ['spring', 'summer', 'fall', 'winter'];
}

function inferFit(name: string): FitTag {
  const s = name.toLowerCase();
  if (s.includes('slim') || s.includes('skinny') || s.includes('fitted') || s.includes('tailored')) return 'slim';
  if (s.includes('oversized') || s.includes('relaxed') || s.includes('loose') || s.includes('baggy') || s.includes('cargo') || s.includes('jogger')) return 'relaxed';
  return 'regular';
}

// ─── Build Wardrobe from API items ────────────────────────────────────────────

export function buildWardrobeFromItems(items: any[]): Wardrobe {
  const wardrobe: Wardrobe = { tops: [], bottoms: [], footwear: [], accessories: [], outerwear: [] };

  items.forEach((item) => {
    if (!item.category) return;

    const piece: WardrobeItem = {
      id: item.id,
      name: item.name || item.category,
      image: item.image ?? null,
      color: normalizeColor(item.color),
      emoji: getEmoji(item.category),
      style: inferStyleTags(item.name || '', item.category),
      season: inferSeasonTags(item.name || ''),
      fit: inferFit(item.name || ''),
      bottomType: item.category === 'pants' ? inferBottomType(item.category, item.name ?? '') : undefined,
      footwearType: item.category === 'shoes' ? inferFootwearType(item.category, item.name ?? '') : undefined,
    };

    if (item.category === 'shirt' || item.category === 'tshirt') wardrobe.tops.push(piece);
    if (item.category === 'pants') wardrobe.bottoms.push(piece);
    if (item.category === 'shoes') wardrobe.footwear.push(piece);
    if (['accessory', 'hat', 'watch', 'sock', 'bag'].includes(item.category)) wardrobe.accessories.push(piece);
  });

  return wardrobe;
}

// ─── Step 1: Parse Intent ─────────────────────────────────────────────────────

const STYLE_KEYWORDS: Record<StyleTag, string[]> = {
  streetwear: ['street', 'hype', 'urban', 'drip', 'edgy', 'hypebeast', 'graphic', 'sneaker'],
  casual: ['casual', 'relax', 'comfy', 'everyday', 'laid', 'chill', 'simple', 'basic'],
  'smart-casual': ['smart', 'date', 'dinner', 'brunch', 'clean', 'modern', 'polished', 'neat'],
  formal: ['formal', 'work', 'office', 'professional', 'corporate', 'meeting', 'interview'],
  minimal: ['minimal', 'simple', 'clean', 'monochrome', 'mono', 'understated', 'sleek'],
  preppy: ['preppy', 'classic', 'collegiate', 'polo', 'ivy'],
  workwear: ['workwear', 'utility', 'functional', 'rugged', 'field'],
  athleisure: ['athleisure', 'athletic', 'gym', 'sport', 'active', 'track'],
};

const OCCASION_KEYWORDS: Record<OccasionTag, string[]> = {
  casual: ['casual', 'chill', 'everyday', 'hang', 'friends'],
  office: ['office', 'work', 'professional', 'meeting', 'interview', 'corporate'],
  dinner: ['dinner', 'restaurant', 'evening', 'night out'],
  date: ['date', 'romantic', 'night out'],
  brunch: ['brunch', 'morning', 'lunch', 'coffee'],
  weekend: ['weekend', 'saturday', 'sunday', 'lazy'],
  party: ['party', 'club', 'night', 'event'],
  outdoor: ['outdoor', 'outside', 'park', 'hiking', 'festival'],
};

const SEASON_KEYWORDS_INTENT: Record<SeasonTag, string[]> = {
  summer: ['summer', 'hot', 'heat', 'warm', 'sunny', 'beach', 'humid'],
  winter: ['winter', 'cold', 'freeze', 'chilly', 'snow', 'cozy'],
  fall: ['fall', 'autumn', 'october', 'november', 'cool'],
  spring: ['spring', 'fresh', 'mild', 'april', 'may'],
};

const FIT_KEYWORDS: Record<FitTag, string[]> = {
  relaxed: ['relaxed', 'loose', 'baggy', 'oversized', 'comfy', 'roomy'],
  slim: ['slim', 'fitted', 'tight', 'sharp', 'tailored', 'clean'],
  regular: ['regular', 'normal', 'standard', 'balanced'],
};

export function parseIntent(prompt: string): OutfitIntent {
  const p = prompt.toLowerCase();

  function extract<T extends string>(map: Record<T, string[]>): T[] {
    return (Object.entries(map) as [T, string[]][])
      .filter(([, kws]) => kws.some(k => p.includes(k)))
      .map(([tag]) => tag);
  }

  const styles = extract<StyleTag>(STYLE_KEYWORDS);
  const occasions = extract<OccasionTag>(OCCASION_KEYWORDS);
  const seasons = extract<SeasonTag>(SEASON_KEYWORDS_INTENT);
  const fits = extract<FitTag>(FIT_KEYWORDS);

  // If user gave an occasion but no style, infer likely styles from occasion
  if (styles.length === 0 && occasions.length > 0) {
    for (const [style, occs] of Object.entries(STYLE_OCCASION_AFFINITY) as [StyleTag, OccasionTag[]][]) {
      if (occs.some(o => occasions.includes(o))) styles.push(style);
    }
  }

  return {
    styles: styles.length ? styles : ['casual'],
    occasions: occasions.length ? occasions : ['casual'],
    seasons: seasons.length ? seasons : ['spring', 'summer', 'fall', 'winter'],
    fits: fits.length ? fits : [],
    rawPrompt: prompt,
  };
}

// ─── Step 2: Scoring Functions ────────────────────────────────────────────────

/**
 * Style match: average overlap of each item's style tags with the intent.
 * A top tagged ['streetwear','casual'] against intent ['streetwear'] → 0.5 overlap → high.
 */
function scoreStyleMatch(items: WardrobeItem[], intent: OutfitIntent): number {
  if (!intent.styles.length) return 0.5;

  const itemScores = items.map(item => {
    if (!item.style?.length) return 0.4; // unknown items get slight penalty
    const overlap = item.style.filter(s => intent.styles.includes(s)).length;
    return overlap / Math.max(item.style.length, intent.styles.length);
  });

  return itemScores.reduce((a, b) => a + b, 0) / itemScores.length;
}

/**
 * Color harmony: multi-factor.
 * +0.40 if bottom color is in top's harmony list
 * +0.25 if footwear color is in harmony list OR matches bottom
 * +0.15 bonus if outerwear (when present) harmonizes
 * +0.20 neutral bonus — outfits with ≤1 non-neutral color
 * -0.25 clash penalty for known bad pairs
 */
function scoreColorHarmony(
  top: WardrobeItem,
  bottom: WardrobeItem,
  footwear: WardrobeItem,
  outerwear?: WardrobeItem | null,
): number {
  const harmony = COLOR_HARMONY[top.color] || COLOR_HARMONY.unknown;
  let score = 0;

  // Core pairing
  if (harmony.includes(bottom.color) && top.color !== bottom.color) score += 0.40;
  else if (top.color === bottom.color) score += 0.10; // monochrome — ok but not ideal unless intentional

  // Footwear
  if (footwear.color === bottom.color || harmony.includes(footwear.color)) score += 0.25;

  // Outerwear harmony
  if (outerwear) {
    const outHarmony = COLOR_HARMONY[outerwear.color] || COLOR_HARMONY.unknown;
    if (outHarmony.includes(top.color) || outHarmony.includes(bottom.color)) score += 0.15;
  } else {
    score += 0.15; // no outerwear, don't penalise
  }

  // Neutral bonus: clean palette
  const allColors: ClothingColor[] = [top.color, bottom.color, footwear.color];
  if (outerwear) allColors.push(outerwear.color);
  const nonNeutralCount = allColors.filter(c => !NEUTRAL_COLORS.has(c)).length;
  if (nonNeutralCount === 0) score += 0.20; // full neutral — always safe
  else if (nonNeutralCount === 1) score += 0.15; // one accent — sharp
  else if (nonNeutralCount === 2) score += 0.05; // two accents — risky but ok

  // Clash penalty
  for (const [a, b] of COLOR_CLASHES) {
    const colors = new Set(allColors);
    if (colors.has(a) && colors.has(b)) { score -= 0.25; break; }
  }

  return Math.max(0, Math.min(1, score));
}

/**
 * Fit balance: how well the top and bottom silhouettes work together.
 * Uses the FIT_COMPATIBILITY matrix. Defaults to 0.6 if fit data is missing.
 */
function scoreFitBalance(top: WardrobeItem, bottom: WardrobeItem, intent: OutfitIntent): number {
  const topFit = top.fit || 'regular';
  const bottomFit = bottom.fit || 'regular';
  const baseScore = FIT_COMPATIBILITY[topFit][bottomFit];

  // Bonus: if intent specifies a fit preference and items match it
  if (intent.fits.length > 0) {
    const topMatch = intent.fits.includes(topFit) ? 0.1 : 0;
    const bottomMatch = intent.fits.includes(bottomFit) ? 0.1 : 0;
    return Math.min(1, baseScore + topMatch + bottomMatch);
  }

  return baseScore;
}

/**
 * Occasion match: what fraction of items are appropriate for the target occasion.
 * Items without occasion tags get a neutral 0.5 so they don't ruin the score.
 */
function scoreOccasionMatch(items: WardrobeItem[], intent: OutfitIntent): number {
  if (!intent.occasions.length) return 0.7;

  const itemScores = items.map(item => {
    if (!item.occasion?.length) return 0.5;
    const overlap = item.occasion.filter(o => intent.occasions.includes(o)).length;
    return overlap > 0 ? 0.5 + (overlap / intent.occasions.length) * 0.5 : 0.2;
  });

  return itemScores.reduce((a, b) => a + b, 0) / itemScores.length;
}

/**
 * Season match: checks whether items are appropriate for the requested season.
 * Items with no season data are treated as all-season (score: 0.7).
 */
function scoreSeasonMatch(items: WardrobeItem[], intent: OutfitIntent): number {
  if (!intent.seasons.length) return 0.7;

  const isAllSeason = (s?: SeasonTag[]) => !s || s.length === 4 || s.length === 0;

  const itemScores = items.map(item => {
    if (isAllSeason(item.season)) return 0.7;
    const match = item.season!.some(s => intent.seasons.includes(s));
    return match ? 1.0 : 0.1; // off-season is a meaningful penalty
  });

  return itemScores.reduce((a, b) => a + b, 0) / itemScores.length;
}

/**
 * Diversity bonus: rewards outfits where the top+bottom pair hasn't been
 * seen in recently generated outfits. Pass usedPairKeys to track.
 */
function scoreDiversityBonus(
  top: WardrobeItem,
  bottom: WardrobeItem,
  usedPairKeys: Set<string>,
): number {
  const key = `${top.id}__${bottom.id}`;
  return usedPairKeys.has(key) ? 0 : 1;
}

// ─── Step 3: Compute Final Score ──────────────────────────────────────────────

const SCORE_WEIGHTS = {
  styleMatch: 0.30,
  colorHarmony: 0.25,
  fitBalance: 0.20,
  occasionMatch: 0.15,
  seasonMatch: 0.07,
  diversityBonus: 0.03,
};

function computeOutfitScore(
  top: WardrobeItem,
  bottom: WardrobeItem,
  footwear: WardrobeItem,
  outerwear: WardrobeItem | null,
  accessory: WardrobeItem | null,
  intent: OutfitIntent,
  usedPairKeys: Set<string>,
): OutfitScore {
  const scoringItems = [top, bottom, footwear];
  if (outerwear) scoringItems.push(outerwear);
  if (accessory) scoringItems.push(accessory);

  const styleMatch = scoreStyleMatch(scoringItems, intent);
  const colorHarmony = scoreColorHarmony(top, bottom, footwear, outerwear);
  const fitBalance = scoreFitBalance(top, bottom, intent);
  const occasionMatch = scoreOccasionMatch(scoringItems, intent);
  const seasonMatch = scoreSeasonMatch(scoringItems, intent);
  const diversityBonus = scoreDiversityBonus(top, bottom, usedPairKeys);

  const total = Math.round((
    SCORE_WEIGHTS.styleMatch * styleMatch +
    SCORE_WEIGHTS.colorHarmony * colorHarmony +
    SCORE_WEIGHTS.fitBalance * fitBalance +
    SCORE_WEIGHTS.occasionMatch * occasionMatch +
    SCORE_WEIGHTS.seasonMatch * seasonMatch +
    SCORE_WEIGHTS.diversityBonus * diversityBonus
  ) * 100);

  return { total, styleMatch, colorHarmony, fitBalance, occasionMatch, seasonMatch, diversityBonus };
}

// ─── Step 4: Generate Explanations ───────────────────────────────────────────

function buildReasons(
  top: WardrobeItem,
  bottom: WardrobeItem,
  footwear: WardrobeItem,
  outerwear: WardrobeItem | null,
  accessory: WardrobeItem | null,
  score: OutfitScore,
  intent: OutfitIntent,
): string[] {
  const reasons: string[] = [];

  // Style
  if (score.styleMatch >= 0.8) reasons.push(`Strong ${intent.styles[0]} style alignment`);
  else if (score.styleMatch >= 0.5) reasons.push(`Fits the ${intent.styles[0]} vibe`);

  // Color
  const allColors = [top.color, bottom.color, footwear.color];
  const nonNeutral = allColors.filter(c => !NEUTRAL_COLORS.has(c)).length;
  if (nonNeutral === 0) reasons.push('Clean all-neutral palette — always works');
  else if (nonNeutral === 1) reasons.push(`Balanced palette: neutral base with a ${allColors.find(c => !NEUTRAL_COLORS.has(c))} accent`);
  if (score.colorHarmony >= 0.75) reasons.push('Colors pair well together');

  // Fit
  if (score.fitBalance >= 0.9) reasons.push(`${top.fit || 'regular'} top + ${bottom.fit || 'regular'} bottom — silhouettes match`);
  else if (score.fitBalance < 0.5) reasons.push('Note: mixed fit silhouettes — intentional contrast');

  // Occasion
  if (score.occasionMatch >= 0.8) reasons.push(`Appropriate for ${intent.occasions[0]}`);

  // Season
  if (score.seasonMatch >= 0.9) reasons.push(`Good choice for ${intent.seasons[0] || 'this season'}`);

  // Extras
  if (accessory) reasons.push(`${accessory.name} ties the look together`);
  if (outerwear) reasons.push(`${outerwear.name} adds depth to the outfit`);

  // Footwear logic
  const btType = bottom.bottomType || 'jeans';
  const validFwTypes = BOTTOM_TO_FOOTWEAR[btType] || [];
  if (footwear.footwearType && validFwTypes.includes(footwear.footwearType)) {
    reasons.push(`${footwear.name} pairs well with ${bottom.name}`);
  }

  return reasons.slice(0, 5); // cap at 5 reasons
}

// ─── Step 5: Select Best Accessory & Outerwear for an outfit ─────────────────

function pickBestAccessory(
  accessories: WardrobeItem[],
  top: WardrobeItem,
  bottom: WardrobeItem,
  intent: OutfitIntent,
): WardrobeItem | null {
  if (!accessories.length) return null;
  const harmony = COLOR_HARMONY[top.color] || COLOR_HARMONY.unknown;

  return accessories
    .map(a => {
      let s = 0;
      if (harmony.includes(a.color) || a.color === bottom.color || NEUTRAL_COLORS.has(a.color)) s += 2;
      if (a.style?.some(st => intent.styles.includes(st))) s += 2;
      if (a.occasion?.some(o => intent.occasions.includes(o))) s += 1;
      return { item: a, score: s };
    })
    .sort((a, b) => b.score - a.score)[0].item;
}

function pickBestOuterwear(
  outerwears: WardrobeItem[],
  top: WardrobeItem,
  bottom: WardrobeItem,
  intent: OutfitIntent,
): WardrobeItem | null {
  if (!outerwears.length) return null;

  // Skip outerwear for summer unless user specifically asks for layers
  const wantsSummer = intent.seasons.includes('summer') && !intent.seasons.includes('winter') && !intent.seasons.includes('fall');
  if (wantsSummer && Math.random() > 0.3) return null;

  const harmony = COLOR_HARMONY[top.color] || COLOR_HARMONY.unknown;

  const candidates = outerwears
    .map(o => {
      let s = 0;
      if (harmony.includes(o.color) && o.color !== top.color) s += 2;
      if (o.style?.some(st => intent.styles.includes(st))) s += 2;
      if (o.season?.some(s2 => intent.seasons.includes(s2))) s += 2;
      if (o.occasion?.some(oc => intent.occasions.includes(oc))) s += 1;
      return { item: o, score: s };
    })
    .sort((a, b) => b.score - a.score);

  // Only include outerwear if it's a reasonably good match
  return candidates[0]?.score >= 3 ? candidates[0].item : null;
}

// ─── Step 6: Main Generation — Intent-Aware Exhaustive + Ranked ──────────────

/**
 * Core generation function.
 * Generates outfit combinations, scores every candidate, and returns the top N
 * diverse outfits — ensuring no two results share the same (top, bottom) pair.
 */
export function generateRankedOutfits(
  wardrobe: Wardrobe,
  intent: OutfitIntent,
  topN = 3,
): ScoredOutfit[] {
  const tops = wardrobe.tops.length ? wardrobe.tops : FALLBACK_WARDROBE.tops;
  const bottoms = wardrobe.bottoms.length ? wardrobe.bottoms : FALLBACK_WARDROBE.bottoms;
  const footwears = wardrobe.footwear.length ? wardrobe.footwear : FALLBACK_WARDROBE.footwear;
  const accessories = wardrobe.accessories;
  const outerwears = wardrobe.outerwear;

  const usedPairKeys = new Set<string>();
  const candidates: Array<{ outfit: Omit<ScoredOutfit, 'reasons' | 'generatedAt'>; score: OutfitScore }> = [];

  // ── Exhaustive combination pass ──────────────────────────────────────────
  for (const top of tops) {
    const harmony = COLOR_HARMONY[top.color] || COLOR_HARMONY.unknown;

    // Pre-filter bottoms: must harmonize with top and differ in color
    const compatibleBottoms = bottoms.filter(b =>
      harmony.includes(b.color) && b.color !== top.color
    );
    const bottomPool = compatibleBottoms.length >= 2 ? compatibleBottoms : bottoms;

    for (const bottom of bottomPool) {
      // Pre-filter footwear: must suit bottom type
      const btType = (bottom.bottomType || 'jeans') as BottomType;
      const validFwTypes = BOTTOM_TO_FOOTWEAR[btType] || BOTTOM_TO_FOOTWEAR.jeans;
      const compatibleFootwear = footwears.filter(f =>
        f.footwearType && validFwTypes.includes(f.footwearType)
      );
      const footwearPool = compatibleFootwear.length ? compatibleFootwear : footwears;

      for (const footwear of footwearPool) {
        const outerwear = pickBestOuterwear(outerwears, top, bottom, intent);
        const accessory = pickBestAccessory(accessories, top, bottom, intent);

        const score = computeOutfitScore(top, bottom, footwear, outerwear, accessory, intent, usedPairKeys);

        candidates.push({
          outfit: { top, bottom, footwear, outerwear, accessory, score },
          score,
        });
      }
    }
  }

  // ── Sort by total score ───────────────────────────────────────────────────
  candidates.sort((a, b) => b.score.total - a.score.total);

  // ── Diversify: pick top N with unique (top, bottom) pairs ────────────────
  const todayStr = getTodayString();
  const results: ScoredOutfit[] = [];
  const seenPairs = new Set<string>();
  const seenTops = new Set<string>();

  for (const { outfit, score } of candidates) {
    if (results.length >= topN) break;

    const pairKey = `${outfit.top.id}__${outfit.bottom.id}`;
    const topKey = outfit.top.id;

    // Enforce unique top+bottom pair and avoid same top appearing in all results
    if (seenPairs.has(pairKey)) continue;
    if (results.length >= 1 && seenTops.has(topKey)) continue; // allow same top at most once

    seenPairs.add(pairKey);
    seenTops.add(topKey);
    usedPairKeys.add(pairKey);

    const reasons = buildReasons(outfit.top, outfit.bottom, outfit.footwear, outfit.outerwear ?? null, outfit.accessory ?? null, score, intent);

    results.push({
      ...outfit,
      outerwear: outfit.outerwear ?? null,
      accessory: outfit.accessory ?? null,
      score,
      reasons,
      generatedAt: todayStr,
    });
  }

  // ── Fallback: if not enough diverse results, relax the top-uniqueness rule ─
  if (results.length < topN) {
    for (const { outfit, score } of candidates) {
      if (results.length >= topN) break;
      const pairKey = `${outfit.top.id}__${outfit.bottom.id}`;
      if (seenPairs.has(pairKey)) continue;
      seenPairs.add(pairKey);

      const reasons = buildReasons(outfit.top, outfit.bottom, outfit.footwear, outfit.outerwear ?? null, outfit.accessory ?? null, score, intent);
      results.push({
        ...outfit,
        outerwear: outfit.outerwear ?? null,
        accessory: outfit.accessory ?? null,
        score,
        reasons,
        generatedAt: todayStr,
      });
    }
  }

  return results;
}

// ─── Daily Outfit (single best) ───────────────────────────────────────────────

/**
 * Generates a single daily outfit without any intent (just the best-scoring combo).
 * Used for the "Outfit of the Day" feature.
 */
export function generateDailyOutfit(wardrobe: Wardrobe): Omit<ScoredOutfit, 'generatedAt'> {
  const defaultIntent: OutfitIntent = {
    styles: ['casual', 'smart-casual'],
    occasions: ['casual'],
    seasons: ['spring', 'summer', 'fall', 'winter'],
    fits: [],
    rawPrompt: '',
  };
  const results = generateRankedOutfits(wardrobe, defaultIntent, 1);
  return results[0];
}

// ─── Daily Persistence ────────────────────────────────────────────────────────

const STORAGE_KEY = 'fitsense_daily_outfit_v2';

export async function getOrCreateDailyOutfit(wardrobe: Wardrobe): Promise<ScoredOutfit> {
  const todayStr = getTodayString();
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed: ScoredOutfit = JSON.parse(stored);
      if (parsed.generatedAt === todayStr) return parsed;
    }
  } catch (_) { }

  const outfit: ScoredOutfit = {
    ...generateDailyOutfit(wardrobe),
    generatedAt: todayStr,
  };

  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(outfit));
  } catch (_) { }

  return outfit;
}

export async function forceRegenerateOutfit(wardrobe: Wardrobe, intent?: OutfitIntent): Promise<ScoredOutfit> {
  const todayStr = getTodayString();
  const effectiveIntent: OutfitIntent = intent || {
    styles: ['casual'],
    occasions: ['casual'],
    seasons: ['spring', 'summer', 'fall', 'winter'],
    fits: [],
    rawPrompt: '',
  };
  const results = generateRankedOutfits(wardrobe, effectiveIntent, 1);
  const outfit: ScoredOutfit = { ...results[0], generatedAt: todayStr };
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(outfit));
  } catch (_) { }
  return outfit;
}