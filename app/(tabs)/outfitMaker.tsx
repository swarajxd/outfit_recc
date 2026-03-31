import { useUser } from "@clerk/clerk-expo";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
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

// ── Tokens ──────────────────────────────────────────────────────────────────
const SURFACE    = "#0F0F0F";
const SURFACE_LOW= "#161616";
const SURF_CONT  = "#1C1C1C";
const SURF_HIGH  = "#242424";
const SURF_LOW2  = "#0A0A0A";
const PRIMARY    = "#FF4500";
const PRI_DIM    = "rgba(255,69,0,0.15)";
const PRI_CONT   = "#FF5625";
const PRI_LIGHT  = "#FFB5A0";
const ON_SURF    = "#EFEFEF";
const ON_SURF_DIM= "rgba(239,239,239,0.4)";

const W          = Dimensions.get("window").width;
const CARD_W     = W - 40;           // results paddingHorizontal: 20
const HALF_W     = Math.floor(CARD_W / 2);
const PANEL_H    = 340;              // height of each image panel

const QUICK_PROMPTS = [
  "Casual summer day", "Date night",
  "Smart office", "Weekend brunch", "All black",
];

// ── OutfitCard ───────────────────────────────────────────────────────────────
function OutfitCard({ outfit, rank }: { outfit: GeneratedOutfit; rank: number }) {
  const LABELS = ["Best Match", "Strong Pick", "Solid Look"];
  const isBest = rank === 1;
  const score  = outfit.score !== undefined ? Math.round(outfit.score * 100) : null;

  const topName    = outfit.top?.name    ?? null;
  const bottomName = outfit.bottom?.name ?? null;

  return (
    <View style={[s.card, isBest && s.cardBest]}>

      {/* ── Split-panel image collage ── */}
      <View style={s.panels}>

        {/* LEFT — Top garment */}
        <View style={s.panelLeft}>
          {outfit.top?.image ? (
            <Image
              source={{ uri: outfit.top.image }}
              style={s.panelImg}
              resizeMode="contain"
            />
          ) : (
            <Text style={s.panelEmoji}>👕</Text>
          )}
          {/* Category label at bottom of panel */}
          <View style={s.panelLabel}>
            <Text style={s.panelLabelTxt}>TOP</Text>
          </View>
        </View>

        {/* Centre divider */}
        <View style={s.divider} />

        {/* RIGHT — Bottom garment */}
        <View style={s.panelRight}>
          {outfit.bottom?.image ? (
            <Image
              source={{ uri: outfit.bottom.image }}
              style={s.panelImg}
              resizeMode="contain"
            />
          ) : (
            <Text style={s.panelEmoji}>👖</Text>
          )}
          <View style={s.panelLabel}>
            <Text style={s.panelLabelTxt}>BOTTOM</Text>
          </View>
        </View>

        {/* Floating rank badge — top-left */}
        <View style={[s.rankBadge, isBest && s.rankBadgeBest]}>
          <Text style={[s.rankTxt, isBest && s.rankTxtBest]}>
            {LABELS[rank - 1] ?? `Look ${rank}`}
          </Text>
        </View>

        {/* Floating score — top-right */}
        {score !== null && (
          <View style={[s.scoreBadge, isBest && s.scoreBadgeBest]}>
            <Text style={[s.scoreNum, isBest && s.scoreNumBest]}>{score}</Text>
            <Text style={[s.scorePts, isBest && s.scorePtsBest]}>pts</Text>
          </View>
        )}
      </View>

      {/* ── Footer ── */}
      <View style={s.footer}>
        {/* Item names */}
        <View style={s.names}>
          {topName && (
            <View style={s.nameRow}>
              <Text style={s.nameCat}>TOP</Text>
              <Text style={s.nameVal} numberOfLines={1}>{topName}</Text>
            </View>
          )}
          {bottomName && (
            <View style={s.nameRow}>
              <Text style={s.nameCat}>BOTTOM</Text>
              <Text style={s.nameVal} numberOfLines={1}>{bottomName}</Text>
            </View>
          )}
        </View>

        {/* Reason chips */}
        {(outfit.reasons?.length ?? 0) > 0 && (
          <View style={s.chips}>
            {outfit.reasons!.slice(0, 3).map((r, i) => (
              <View key={i} style={s.chip}>
                <Text style={s.chipTxt}>{r}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

    </View>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────
export default function OutfitMaker() {
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const { wardrobe } = useLocalSearchParams();

  useMemo(() => {
    if (!wardrobe) return null;
    let raw: any[];
    try { raw = JSON.parse(wardrobe as string); } catch { return null; }
    if (!Array.isArray(raw)) return raw;
    return buildWardrobeFromItems(raw);
  }, [wardrobe]);

  const [prompt, setPrompt]   = useState("");
  const [outfits, setOutfits] = useState<GeneratedOutfit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const generate = async (text?: string) => {
    const input = (text ?? prompt).trim();
    if (!input) return;
    if (!user?.id) { setError("Please sign in to generate outfits."); return; }
    setLoading(true); setError(""); setOutfits([]);
    try {
      const results = await getVectorBasedOutfits(user.id, input);
      setOutfits(results);
    } catch (e: any) {
      setError(e.message || "Something went wrong. Please try again.");
    } finally { setLoading(false); }
  };

  const useQuick = (t: string) => { setPrompt(t); generate(t); };

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero */}
        <View style={s.hero}>
          <Text style={s.overline}>AI STYLE CONCIERGE</Text>
          <Text style={s.heroTitle}>
            Define Your{"\n"}
            <Text style={s.heroItalic}>Aesthetic.</Text>
          </Text>
        </View>

        {/* Input bar */}
        <View style={s.inputRow}>
          <TextInput
            placeholder="Describe your vibe…"
            placeholderTextColor="rgba(239,239,239,0.18)"
            style={s.input}
            value={prompt}
            onChangeText={setPrompt}
            onSubmitEditing={() => generate()}
            returnKeyType="go"
            multiline={false}
          />
          <TouchableOpacity onPress={() => generate()} activeOpacity={0.85}>
            <LinearGradient
              colors={[PRI_CONT, PRI_LIGHT]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={s.sendBtn}
            >
              <Text style={s.sendIcon}>✦</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Quick-prompt chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.quickRow}>
          {QUICK_PROMPTS.map((p) => (
            <TouchableOpacity key={p} style={s.quickChip} onPress={() => useQuick(p)} activeOpacity={0.7}>
              <Text style={s.quickTxt}>{p}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Loading */}
        {loading && (
          <View style={s.loading}>
            <ActivityIndicator color={PRIMARY} size="small" />
            <Text style={s.loadingTxt}>Curating your looks…</Text>
          </View>
        )}

        {/* Error */}
        {error !== "" && (
          <View style={s.errorBox}>
            <Text style={s.errorTxt}>⚡ {error}</Text>
          </View>
        )}

        {/* Results */}
        {outfits.length > 0 && (
          <View style={s.results}>
            <View style={s.resultsHdr}>
              <Text style={s.resultsTitle}>Curated Looks</Text>
              <Text style={s.resultsSub}>{outfits.length} outfits</Text>
            </View>
            {outfits.map((o, i) => <OutfitCard key={i} outfit={o} rank={i + 1} />)}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: SURFACE },

  // Hero
  hero: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 28 },
  overline: { color: PRIMARY, fontSize: 10, fontWeight: "700", letterSpacing: 4, marginBottom: 12 },
  heroTitle: { fontSize: 42, fontWeight: "800", color: ON_SURF, letterSpacing: -1.5, lineHeight: 48 },
  heroItalic: { fontWeight: "200", color: ON_SURF_DIM, fontStyle: "italic" },

  // Input
  inputRow: {
    marginHorizontal: 24, flexDirection: "row", alignItems: "center",
    backgroundColor: SURF_LOW2, borderRadius: 20,
    paddingHorizontal: 20, paddingVertical: 6, marginBottom: 16,
  },
  input: { flex: 1, color: ON_SURF, fontSize: 18, fontWeight: "300", paddingVertical: 16, paddingRight: 12 },
  sendBtn: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  sendIcon: { color: "#fff", fontSize: 18, fontWeight: "700" },

  // Quick-prompt chips
  quickRow: { paddingHorizontal: 24, gap: 8, marginBottom: 32 },
  quickChip: {
    backgroundColor: SURF_CONT, borderRadius: 999,
    paddingVertical: 8, paddingHorizontal: 16,
    borderWidth: 1, borderColor: "rgba(255,69,0,0.15)",
  },
  quickTxt: { color: ON_SURF_DIM, fontSize: 12, fontWeight: "500" },

  // States
  loading: { alignItems: "center", paddingVertical: 40, gap: 12 },
  loadingTxt: { color: ON_SURF_DIM, fontSize: 13 },
  errorBox: { marginHorizontal: 20, marginBottom: 16, backgroundColor: "rgba(255,69,0,0.1)", borderRadius: 16, padding: 16 },
  errorTxt: { color: PRI_LIGHT, fontWeight: "600", fontSize: 13, lineHeight: 20 },

  // Results
  results: { paddingHorizontal: 20, gap: 18 },
  resultsHdr: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 2 },
  resultsTitle: { color: ON_SURF, fontSize: 22, fontWeight: "700", letterSpacing: -0.5 },
  resultsSub: { color: ON_SURF_DIM, fontSize: 12 },

  // ── Card ──────────────────────────────────────────────────────────────────
  card: {
    width: CARD_W,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: SURFACE_LOW,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  cardBest: { borderColor: `${PRIMARY}60` },

  // ── Split panels ───────────────────────────────────────────────────────────
  panels: {
    flexDirection: "row",
    height: PANEL_H,
    backgroundColor: "#F1EDE7",
    position: "relative",
    overflow: "hidden",
  },

  panelLeft: {
    width: HALF_W,
    height: PANEL_H,
    backgroundColor: "#EDE8E2",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  panelRight: {
    width: HALF_W,
    height: PANEL_H,
    backgroundColor: "#E8E3DC",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  divider: {
    width: StyleSheet.hairlineWidth,
    height: PANEL_H,
    backgroundColor: "#C8BFB5",
  },

  panelImg: {
    width: HALF_W,
    height: PANEL_H - 28,    // leave 28px for label at bottom
  },

  panelEmoji: {
    fontSize: 64,
    textAlign: "center",
  },

  // Category label pinned to bottom of each panel
  panelLabel: {
    position: "absolute",
    bottom: 0,
    left: 0, right: 0,
    height: 26,
    backgroundColor: "rgba(235,230,222,0.92)",
    alignItems: "center",
    justifyContent: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#C8BFB5",
  },
  panelLabelTxt: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2,
    color: "#7A6A5A",
  },

  // Rank badge — top-left floating over panels
  rankBadge: {
    position: "absolute",
    top: 12, left: 12,
    backgroundColor: "rgba(20,20,20,0.78)",
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  rankBadgeBest: { backgroundColor: PRIMARY, borderColor: "transparent" },
  rankTxt: { color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: "700", letterSpacing: 0.3 },
  rankTxtBest: { color: "#fff" },

  // Score badge — top-right floating over panels
  scoreBadge: {
    position: "absolute",
    top: 12, right: 12,
    backgroundColor: "rgba(20,20,20,0.78)",
    borderRadius: 14,
    paddingHorizontal: 11, paddingVertical: 7,
    flexDirection: "row", alignItems: "baseline", gap: 2,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  scoreBadgeBest: { backgroundColor: PRIMARY, borderColor: "transparent" },
  scoreNum: { color: ON_SURF, fontSize: 17, fontWeight: "800" },
  scoreNumBest: { color: "#fff" },
  scorePts: { color: ON_SURF_DIM, fontSize: 9, fontWeight: "600", letterSpacing: 0.5 },
  scorePtsBest: { color: "rgba(255,255,255,0.7)" },

  // ── Footer ─────────────────────────────────────────────────────────────────
  footer: {
    backgroundColor: SURFACE_LOW,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 12,
  },

  names: { gap: 5, marginBottom: 10 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  nameCat: {
    width: 64,
    fontSize: 9, fontWeight: "700",
    color: PRIMARY, letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  nameVal: {
    flex: 1,
    fontSize: 14, fontWeight: "500",
    color: ON_SURF,
  },

  // Reason chips
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    backgroundColor: PRI_DIM, borderRadius: 999,
    paddingVertical: 5, paddingHorizontal: 11,
    borderWidth: 1, borderColor: "rgba(255,69,0,0.2)",
  },
  chipTxt: { color: PRI_LIGHT, fontSize: 11 },
});