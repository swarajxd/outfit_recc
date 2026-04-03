import { useUser } from "@clerk/clerk-expo";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import {
    ActivityIndicator,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
    buildWardrobeFromItems,
    GeneratedOutfit,
    getVectorBasedOutfits,
} from "../utils/outfitEngine";

// ─── Design Tokens ───────────────────────────────────────────────────────────
const SURFACE = "#131313";
const SURFACE_LOW = "#1B1B1B";
const SURFACE_CONTAINER = "#1F1F1F";
const SURFACE_HIGH = "#2A2A2A";
const SURFACE_LOWEST = "#0E0E0E";
const PRIMARY = "#FF4500";
const PRIMARY_CONTAINER = "#FF5625";
const PRIMARY_LIGHT = "#FFB5A0";
const ON_SURFACE = "#E2E2E2";
const ON_SURFACE_DIM = "rgba(226,226,226,0.4)";

const QUICK_PROMPTS = [
  "Casual summer day",
  "Date night",
  "Smart office",
  "Weekend brunch",
  "All black",
];

export default function OutfitMaker() {
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const { wardrobe } = useLocalSearchParams();

  const parsedWardrobe = useMemo(() => {
    if (!wardrobe) return null;
    let raw: any[];
    try {
      raw = JSON.parse(wardrobe as string);
    } catch {
      return null;
    }
    // Already a Wardrobe object (not a flat array)
    if (!Array.isArray(raw)) return raw;
    return buildWardrobeFromItems(raw);
  }, [wardrobe]);

  const [prompt, setPrompt] = useState("");
  const [outfits, setOutfits] = useState<GeneratedOutfit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const generate = async (text?: string) => {
    const input = (text ?? prompt).trim();
    if (!input) return;
    if (!user?.id) {
      setError("Please sign in to generate outfits.");
      return;
    }

    setLoading(true);
    setError("");
    setOutfits([]);

    try {
      console.log("Attempting vector recommendation for:", input);
      const results = await getVectorBasedOutfits(user.id, input);
      // Backend returns top3 outfits
      setOutfits(results);
    } catch (e: any) {
      console.error("Vector recommendation error:", e);
      setError(e.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const useQuickPrompt = (text: string) => {
    setPrompt(text);
    generate(text);
  };

  // ─── Sub-components ────────────────────────────────────────────────────────

  const ScoreBar = ({ value, label }: { value: number; label: string }) => (
    <View style={styles.scoreBarWrap}>
      <Text style={styles.scoreBarLabel}>{label}</Text>
      <View style={styles.scoreTrack}>
        <View
          style={[
            styles.scoreFill,
            { width: `${Math.round(value * 100)}%` as any },
          ]}
        />
      </View>
      <Text style={styles.scoreBarValue}>{Math.round(value * 100)}</Text>
    </View>
  );

  const OutfitItem = ({ item, label }: { item: any; label: string }) => {
    const hasImage =
      item.image && typeof item.image === "string" && item.image.length > 4;
    return (
      <View style={styles.outfitItem}>
        <View style={styles.outfitImageWrap}>
          {hasImage ? (
            <Image
              source={{ uri: item.image }}
              style={StyleSheet.absoluteFillObject}
              resizeMode="cover"
            />
          ) : (
            <Text style={styles.outfitEmoji}>{item.emoji || "👕"}</Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.outfitItemLabel}>{label.toUpperCase()}</Text>
          <Text style={styles.outfitItemName}>{item.name}</Text>
          {item.color && item.color !== "unknown" && (
            <Text style={styles.outfitItemColor}>{item.color}</Text>
          )}
        </View>
      </View>
    );
  };

  const OutfitCard = ({
    outfit,
    rank,
  }: {
    outfit: GeneratedOutfit;
    rank: number;
  }) => {
    const rankLabels = ["Best Match", "Strong Alternative", "Solid Choice"];
    const pieces = [
      outfit.top && { item: outfit.top, label: "Top" },
      outfit.bottom && { item: outfit.bottom, label: "Bottom" },
      outfit.footwear && { item: outfit.footwear, label: "Footwear" },
      outfit.outerwear && { item: outfit.outerwear, label: "Outerwear" },
      outfit.accessory && { item: outfit.accessory, label: "Accessory" },
    ].filter(Boolean) as { item: any; label: string }[];

    const totalScore =
      outfit.score !== undefined ? Math.round(outfit.score * 100) : 0;

    return (
      <View style={[styles.outfitCard, rank === 1 && styles.outfitCardBest]}>
        {/* Card header */}
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View
              style={[styles.rankBadge, rank === 1 && styles.rankBadgeBest]}
            >
              <Text
                style={[
                  styles.rankBadgeText,
                  rank === 1 && styles.rankBadgeTextBest,
                ]}
              >
                {rank}
              </Text>
            </View>
            <View>
              <Text style={styles.rankLabel}>{rankLabels[rank - 1]}</Text>
              <Text style={styles.pieceCount}>{pieces.length} pieces</Text>
            </View>
          </View>
          <View style={styles.totalScoreWrap}>
            <Text style={styles.totalScoreValue}>{totalScore}</Text>
            <Text style={styles.totalScoreLabel}>score</Text>
          </View>
        </View>

        {/* Items */}
        <View style={styles.itemsSection}>
          {pieces.map(({ item, label }) => (
            <OutfitItem key={label} item={item} label={label} />
          ))}
        </View>

        {/* Reasons */}
        {outfit.reasons && outfit.reasons.length > 0 && (
          <View style={styles.reasonsSection}>
            {outfit.reasons.map((r: string, i: number) => (
              <View key={i} style={styles.reasonTag}>
                <Text style={styles.reasonText}>{r}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.overline}>AI STYLE CONCIERGE</Text>
          <Text style={styles.heroTitle}>
            Define Your{"\n"}
            <Text style={styles.heroItalic}>Aesthetic.</Text>
          </Text>
        </View>

        {/* Prompt input */}
        <View style={styles.inputRow}>
          <TextInput
            placeholder="Describe your vibe..."
            placeholderTextColor="rgba(226,226,226,0.2)"
            style={styles.input}
            value={prompt}
            onChangeText={setPrompt}
            onSubmitEditing={() => generate()}
            returnKeyType="go"
            multiline={false}
          />
          <TouchableOpacity onPress={() => generate()} activeOpacity={0.85}>
            <LinearGradient
              colors={[PRIMARY_CONTAINER, PRIMARY_LIGHT]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.sendBtn}
            >
              <Text style={styles.sendIcon}>✦</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Quick prompts */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickPromptRow}
        >
          {QUICK_PROMPTS.map((p) => (
            <TouchableOpacity
              key={p}
              style={styles.quickChip}
              onPress={() => useQuickPrompt(p)}
              activeOpacity={0.7}
            >
              <Text style={styles.quickChipText}>{p}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Loading */}
        {loading && (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={PRIMARY} size="small" />
            <Text style={styles.loadingText}>Scoring your wardrobe...</Text>
          </View>
        )}

        {/* Error */}
        {error !== "" && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚡ {error}</Text>
          </View>
        )}

        {/* Results */}
        {outfits.length > 0 && (
          <View style={styles.resultsWrap}>
            <View style={styles.resultsHeader}>
              <Text style={styles.resultsHeadline}>Curated Looks</Text>
              <Text style={styles.resultsSubtitle}>
                {outfits.length} outfits ranked
              </Text>
            </View>
            {outfits.map((o, i) => (
              <OutfitCard key={i} outfit={o} rank={i + 1} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: SURFACE },

  // Hero
  hero: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 28 },
  overline: {
    color: PRIMARY,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 4,
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 42,
    fontWeight: "800",
    color: ON_SURFACE,
    letterSpacing: -1.5,
    lineHeight: 48,
  },
  heroItalic: { fontWeight: "200", color: ON_SURFACE_DIM, fontStyle: "italic" },

  // Input
  inputRow: {
    marginHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: SURFACE_LOWEST,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 6,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    color: ON_SURFACE,
    fontSize: 18,
    fontWeight: "300",
    paddingVertical: 16,
    paddingRight: 12,
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  sendIcon: { color: "#fff", fontSize: 18, fontWeight: "700" },

  // Quick prompts
  quickPromptRow: { paddingHorizontal: 24, gap: 8, marginBottom: 28 },
  quickChip: {
    backgroundColor: SURFACE_CONTAINER,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "rgba(255,69,0,0.15)",
  },
  quickChipText: { color: ON_SURFACE_DIM, fontSize: 12, fontWeight: "500" },

  // Loading
  loadingWrap: { alignItems: "center", paddingVertical: 40, gap: 12 },
  loadingText: { color: ON_SURFACE_DIM, fontSize: 13 },

  // Error
  errorBox: {
    marginHorizontal: 24,
    marginBottom: 16,
    backgroundColor: "rgba(255,69,0,0.12)",
    borderRadius: 16,
    padding: 16,
  },
  errorText: {
    color: PRIMARY_LIGHT,
    fontWeight: "600",
    fontSize: 13,
    lineHeight: 20,
  },

  // Results
  resultsWrap: { paddingHorizontal: 24, gap: 16 },
  resultsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 4,
  },
  resultsHeadline: {
    color: ON_SURFACE,
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  resultsSubtitle: { color: ON_SURFACE_DIM, fontSize: 12 },

  // Outfit card
  outfitCard: {
    backgroundColor: SURFACE_LOW,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
  },
  outfitCardBest: {
    borderColor: `${PRIMARY}40`,
  },

  // Card header
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  cardHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: SURFACE_HIGH,
    alignItems: "center",
    justifyContent: "center",
  },
  rankBadgeBest: { backgroundColor: PRIMARY },
  rankBadgeText: { color: ON_SURFACE_DIM, fontSize: 12, fontWeight: "700" },
  rankBadgeTextBest: { color: "#fff" },
  rankLabel: { color: ON_SURFACE, fontSize: 14, fontWeight: "600" },
  pieceCount: { color: ON_SURFACE_DIM, fontSize: 11, marginTop: 1 },
  totalScoreWrap: { alignItems: "flex-end" },
  totalScoreValue: {
    color: ON_SURFACE,
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -1,
  },
  totalScoreLabel: {
    color: ON_SURFACE_DIM,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
  },

  // Items
  itemsSection: {},
  outfitItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.04)",
  },
  outfitImageWrap: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: SURFACE_HIGH,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  outfitEmoji: { fontSize: 26 },
  outfitItemLabel: {
    color: PRIMARY,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2.5,
    marginBottom: 3,
  },
  outfitItemName: { color: ON_SURFACE, fontSize: 13, fontWeight: "500" },
  outfitItemColor: {
    color: ON_SURFACE_DIM,
    fontSize: 11,
    marginTop: 2,
    textTransform: "capitalize",
  },

  // Score bars
  scoresSection: {
    padding: 14,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
  },
  scoreBarWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  scoreBarLabel: { color: ON_SURFACE_DIM, fontSize: 11, width: 54 },
  scoreTrack: {
    flex: 1,
    height: 3,
    backgroundColor: SURFACE_HIGH,
    borderRadius: 99,
    overflow: "hidden",
  },
  scoreFill: { height: "100%", backgroundColor: PRIMARY, borderRadius: 99 },
  scoreBarValue: {
    color: ON_SURFACE_DIM,
    fontSize: 11,
    width: 24,
    textAlign: "right",
  },

  // Reasons
  reasonsSection: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    padding: 14,
    paddingTop: 0,
  },
  reasonTag: {
    backgroundColor: "rgba(255,69,0,0.08)",
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "rgba(255,69,0,0.15)",
  },
  reasonText: { color: PRIMARY_LIGHT, fontSize: 11 },
});
