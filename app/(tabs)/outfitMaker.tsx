import { useUser } from "@clerk/clerk-expo";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
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
    forceRegenerateOutfit,
    getVectorBasedOutfit,
} from "../utils/outfitEngine";

// ─── Design Tokens (Cupertino Noir / Stitch) ────────────────────────────────
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
const ON_SURFACE_MID = "rgba(226,226,226,0.6)";

type Outfit = {
  top?: any;
  bottom?: any;
  footwear?: any;
  outerwear?: any;
  accessory?: any;
  score?: number;
  reasons?: string[];
};

// ─── Occasion / Weather / Style config ─────────────────────────────────────
const CONFIG_SECTIONS = [
  {
    key: "occasion",
    label: "Occasion",
    icon: "📅",
    options: ["Casual", "Formal", "Party", "Gym"],
  },
  {
    key: "weather",
    label: "Climate",
    icon: "🌡️",
    options: ["Hot", "Moderate", "Cold", "Rainy"],
  },
  {
    key: "style",
    label: "Style",
    icon: "✦",
    options: ["Minimal", "Trendy", "Sporty", "Streetwear"],
  },
];

export default function OutfitMaker() {
  const router = useRouter();
  const { user } = useUser();
  const insets = useSafeAreaInsets();
  const { wardrobe } = useLocalSearchParams();

  // ── Convert raw items array → Wardrobe shape ─────────────────────────────
  // The server stores filenames like tshirt_0.png → category "tshirt".
  // We expand the mapping so ALL real images appear in the generated outfit.
  const parsedWardrobe = useMemo(() => {
    if (!wardrobe) return null;
    let raw: any[];
    try {
      raw = JSON.parse(wardrobe as string);
    } catch {
      return null;
    }
    if (!Array.isArray(raw)) return raw; // already a Wardrobe object (fallback)

    const w: any = {
      tops: [],
      bottoms: [],
      footwear: [],
      accessories: [],
      outerwear: [],
    };

    raw.forEach((item) => {
      const cat = (item.category || "").toLowerCase();
      const piece = {
        ...item,
        name: item.category,
        emoji: "👕",
        color: "unknown",
      };

      if (
        [
          "shirt",
          "tshirt",
          "t-shirt",
          "top",
          "polo",
          "blouse",
          "sweater",
          "hoodie",
          "knit",
          "pullover",
        ].some((k) => cat.includes(k))
      ) {
        w.tops.push(piece);
      } else if (
        [
          "pant",
          "jean",
          "trouser",
          "bottom",
          "short",
          "chino",
          "jogger",
          "slack",
          "skirt",
        ].some((k) => cat.includes(k))
      ) {
        w.bottoms.push({
          ...piece,
          bottomType: cat.includes("short")
            ? "shorts"
            : cat.includes("jogger")
              ? "joggers"
              : "jeans",
        });
      } else if (
        [
          "shoe",
          "sneaker",
          "boot",
          "sandal",
          "loafer",
          "oxford",
          "brogue",
          "slip",
        ].some((k) => cat.includes(k))
      ) {
        w.footwear.push({
          ...piece,
          footwearType: cat.includes("boot")
            ? "boots"
            : cat.includes("loafer")
              ? "loafers"
              : "sneakers",
        });
      } else if (
        ["jacket", "coat", "blazer", "outerwear", "overcoat", "cardigan"].some(
          (k) => cat.includes(k),
        )
      ) {
        w.outerwear.push(piece);
      } else if (
        [
          "accessory",
          "cap",
          "hat",
          "bag",
          "belt",
          "watch",
          "sock",
          "scarf",
          "glove",
        ].some((k) => cat.includes(k))
      ) {
        w.accessories.push(piece);
      } else {
        // Unknown category — put in tops as best guess so wardrobe isn't empty
        w.tops.push(piece);
      }
    });
    return w;
  }, [wardrobe]);

  const [prompt, setPrompt] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [answers, setAnswers] = useState({
    occasion: "",
    weather: "",
    style: "",
  });
  const [outfit, setOutfit] = useState<Outfit | null>(null);

  const selectOption = (question: string, value: string) => {
    setAnswers({ ...answers, [question]: value });
  };

  const generateOutfit = async () => {
    setLoading(true);
    try {
      // 1. Build a combined query from prompt + answers
      const parts = [];
      if (prompt) parts.push(prompt);
      if (answers.style) parts.push(`${answers.style} style`);
      if (answers.occasion) parts.push(`for ${answers.occasion}`);
      if (answers.weather) parts.push(`in ${answers.weather} weather`);

      const fullQuery = parts.join(" ") || "casual outfit";

      // 2. Try vector-based generation if user is logged in
      if (user?.id) {
        try {
          console.log("Attempting vector recommendation for:", fullQuery);
          const vectorOutfit = await getVectorBasedOutfit(user.id, fullQuery);
          setOutfit(vectorOutfit);
          setLoading(false);
          setMessage("");
          return;
        } catch (vErr) {
          console.warn(
            "Vector recommendation failed, falling back to rules:",
            vErr,
          );
        }
      }

      // 3. Fallback to rule-based generation
      if (!parsedWardrobe) {
        console.log("No wardrobe found for fallback");
        setLoading(false);
        return;
      }

      let filteredWardrobe = { ...parsedWardrobe };
      let missingItems = false;

      if (filteredWardrobe.tops.length === 0) missingItems = true;
      if (filteredWardrobe.bottoms.length === 0) missingItems = true;
      if (filteredWardrobe.footwear.length === 0) missingItems = true;

      if (missingItems) {
        setMessage(
          "You don't have items exactly matching this request in your wardrobe. Showing the closest outfit instead.",
        );
      } else {
        setMessage("");
      }

      const promptLower = prompt.toLowerCase();
      const inferredAnswers = { ...answers };

      if (promptLower.includes("wedding") || promptLower.includes("formal")) {
        inferredAnswers.occasion = "Formal";
      } else if (
        promptLower.includes("gym") ||
        promptLower.includes("workout")
      ) {
        inferredAnswers.occasion = "Gym";
      }

      if (promptLower.includes("winter") || promptLower.includes("cold")) {
        inferredAnswers.weather = "Cold";
      } else if (
        promptLower.includes("summer") ||
        promptLower.includes("hot")
      ) {
        inferredAnswers.weather = "Hot";
      }

      if (
        inferredAnswers.occasion !== answers.occasion ||
        inferredAnswers.weather !== answers.weather
      ) {
        setAnswers(inferredAnswers);
      }

      if (inferredAnswers.weather === "Hot") {
        filteredWardrobe.outerwear = [];
      } else if (inferredAnswers.weather === "Cold") {
        if (parsedWardrobe.outerwear.length === 0) {
          console.log("No jackets available");
        }
      }

      if (inferredAnswers.occasion === "Formal") {
        const formalTops = parsedWardrobe.tops.filter(
          (item: any) =>
            item.name.toLowerCase().includes("shirt") ||
            item.name.toLowerCase().includes("blazer"),
        );
        if (formalTops.length > 0) {
          filteredWardrobe.tops = formalTops;
        }
      } else if (inferredAnswers.occasion === "Gym") {
        filteredWardrobe.bottoms = parsedWardrobe.bottoms.filter(
          (item: any) =>
            item.name.toLowerCase().includes("short") ||
            item.name.toLowerCase().includes("jogger"),
        );
      }

      if (answers.style === "Minimal") {
        filteredWardrobe.accessories = [];
      }

      const result = await forceRegenerateOutfit(filteredWardrobe);
      setOutfit(result);
    } catch (err) {
      console.log("Error generating outfit", err);
    } finally {
      setLoading(false);
    }
  };

  const renderResultItem = (item: any, label: string) => {
    const hasImage =
      item.image && typeof item.image === "string" && item.image.length > 4;
    return (
      <View key={label} style={styles.resultItem}>
        <View style={styles.resultImageWrap}>
          {hasImage ? (
            <Image
              source={{ uri: item.image }}
              style={StyleSheet.absoluteFillObject}
              resizeMode="cover"
            />
          ) : (
            <Text style={styles.resultEmoji}>{item.emoji || "👕"}</Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.resultLabel}>{label.toUpperCase()}</Text>
          <Text style={styles.resultName}>{item.name}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* ── HERO HEADER ─────────────────────────────────────────────── */}
        <View style={styles.hero}>
          <Text style={styles.overline}>AI STYLE CONCIERGE</Text>
          <Text style={styles.heroTitle}>
            Define Your{"\n"}
            <Text style={styles.heroItalic}>Aesthetic.</Text>
          </Text>
        </View>

        {/* ── VIBE INPUT ──────────────────────────────────────────────── */}
        <View style={styles.inputRow}>
          <TextInput
            placeholder="Describe your vibe..."
            placeholderTextColor="rgba(226,226,226,0.2)"
            style={styles.input}
            value={prompt}
            onChangeText={setPrompt}
          />
          <TouchableOpacity onPress={generateOutfit} activeOpacity={0.85}>
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

        {/* ── CONFIG BENTO GRID ────────────────────────────────────────── */}
        <View style={styles.bentoRow}>
          {CONFIG_SECTIONS.map((section) => (
            <View key={section.key} style={styles.bentoCard}>
              <View style={styles.bentoHeader}>
                <Text style={styles.bentoIcon}>{section.icon}</Text>
                <Text style={styles.bentoLabel}>{section.label}</Text>
              </View>
              <View style={styles.pillarOptions}>
                {section.options.map((opt) => {
                  const isSelected =
                    answers[section.key as keyof typeof answers] === opt;
                  return (
                    <TouchableOpacity
                      key={opt}
                      style={[
                        styles.pillOption,
                        isSelected && styles.pillSelected,
                      ]}
                      onPress={() => selectOption(section.key, opt)}
                      activeOpacity={0.75}
                    >
                      <Text
                        style={[
                          styles.pillText,
                          isSelected && styles.pillTextSelected,
                        ]}
                      >
                        {opt}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
        </View>

        {/* ── CTA BUTTON ─────────────────────────────────────────────── */}
        <View style={styles.ctaWrap}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={generateOutfit}
            disabled={loading}
          >
            <LinearGradient
              colors={[PRIMARY, PRIMARY_CONTAINER]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.ctaBtn}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.ctaText}>Generate Outfit</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* ── WARNING ─────────────────────────────────────────────────── */}
        {message !== "" && (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>⚡ {message}</Text>
          </View>
        )}

        {/* ── RESULTS ─────────────────────────────────────────────────── */}
        {outfit && (
          <View style={styles.resultSection}>
            <View style={styles.resultHeaderRow}>
              <View>
                <Text style={styles.resultHeadline}>Your Outfit</Text>
                {outfit.score !== undefined && (
                  <Text style={styles.resultScore}>
                    {Math.round(outfit.score * 100)}% Match
                  </Text>
                )}
              </View>
              <Text style={styles.resultCount}>
                {
                  [
                    outfit.top,
                    outfit.bottom,
                    outfit.footwear,
                    outfit.outerwear,
                    outfit.accessory,
                  ].filter(Boolean).length
                }{" "}
                pieces
              </Text>
            </View>

            {outfit.reasons && outfit.reasons.length > 0 && (
              <View style={styles.reasonsBox}>
                {outfit.reasons.map((r, i) => (
                  <Text key={i} style={styles.reasonText}>
                    • {r}
                  </Text>
                ))}
              </View>
            )}

            <View style={styles.resultCard}>
              {outfit.top && renderResultItem(outfit.top, "Top")}
              {outfit.bottom && renderResultItem(outfit.bottom, "Bottom")}
              {outfit.footwear && renderResultItem(outfit.footwear, "Footwear")}
              {outfit.accessory &&
                renderResultItem(outfit.accessory, "Accessory")}
              {outfit.outerwear &&
                renderResultItem(outfit.outerwear, "Outerwear")}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SURFACE,
  },

  // ── Hero ────────────────────────────────────────────────────────────────
  hero: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 32,
  },
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
  heroItalic: {
    fontWeight: "200",
    color: ON_SURFACE_DIM,
    fontStyle: "italic",
  },

  // ── Input ───────────────────────────────────────────────────────────────
  inputRow: {
    marginHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: SURFACE_LOWEST,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 6,
    marginBottom: 24,
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
  sendIcon: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },

  // ── Bento Config Grid ────────────────────────────────────────────────────
  bentoRow: {
    flexDirection: "row",
    marginHorizontal: 24,
    gap: 10,
    marginBottom: 28,
  },
  bentoCard: {
    flex: 1,
    backgroundColor: SURFACE_LOW,
    borderRadius: 20,
    padding: 14,
  },
  bentoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 14,
  },
  bentoIcon: {
    fontSize: 14,
  },
  bentoLabel: {
    color: ON_SURFACE_DIM,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  pillarOptions: {
    gap: 8,
  },
  pillOption: {
    backgroundColor: SURFACE_CONTAINER,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  pillSelected: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: `${PRIMARY}60`,
  },
  pillText: {
    color: ON_SURFACE_DIM,
    fontSize: 11,
    fontWeight: "600",
  },
  pillTextSelected: {
    color: PRIMARY_LIGHT,
  },

  // ── CTA ─────────────────────────────────────────────────────────────────
  ctaWrap: {
    marginHorizontal: 24,
    marginBottom: 24,
    alignItems: "center",
  },
  ctaBtn: {
    paddingHorizontal: 56,
    paddingVertical: 18,
    borderRadius: 999,
  },
  ctaText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 15,
    letterSpacing: 2,
    textTransform: "uppercase",
  },

  // ── Warning ─────────────────────────────────────────────────────────────
  warningBox: {
    marginHorizontal: 24,
    marginBottom: 16,
    backgroundColor: "rgba(255,69,0,0.12)",
    borderRadius: 16,
    padding: 16,
  },
  warningText: {
    color: PRIMARY_LIGHT,
    fontWeight: "600",
    fontSize: 13,
    lineHeight: 20,
  },

  // ── Result Section ───────────────────────────────────────────────────────
  resultSection: {
    marginHorizontal: 24,
  },
  resultHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(93,64,56,0.15)",
  },
  resultHeadline: {
    color: ON_SURFACE,
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  resultScore: {
    color: PRIMARY_LIGHT,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  resultCount: {
    color: ON_SURFACE_DIM,
    fontSize: 12,
  },
  reasonsBox: {
    backgroundColor: SURFACE_LOWEST,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    gap: 6,
  },
  reasonText: {
    color: ON_SURFACE_MID,
    fontSize: 13,
    lineHeight: 18,
  },
  resultCard: {
    backgroundColor: SURFACE_LOW,
    borderRadius: 24,
    overflow: "hidden",
  },
  resultItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(93,64,56,0.1)",
  },
  resultImageWrap: {
    width: 64,
    height: 64,
    borderRadius: 14,
    backgroundColor: SURFACE_HIGH,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  resultImage: {
    width: "100%",
    height: "100%",
  },
  resultEmoji: {
    fontSize: 28,
  },
  resultLabel: {
    color: PRIMARY,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2.5,
    marginBottom: 4,
  },
  resultName: {
    color: ON_SURFACE,
    fontSize: 14,
    fontWeight: "500",
  },
});
