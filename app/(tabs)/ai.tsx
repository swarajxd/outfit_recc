import { useUser } from "@clerk/clerk-expo";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SERVER_BASE } from "../utils/config";

const { width: SCREEN_W } = Dimensions.get("window");

// ─── Design Tokens ───────────────────────────────────────────────────────────
const C = {
  bg:                    "#0c0c0e",
  surface:               "#131315",
  surface2:              "#1a1a1c",
  surface3:              "#222224",
  surface4:              "#2a2a2d",
  surfaceVariant:        "#353437",
  border:                "rgba(255,255,255,0.07)",
  border2:               "rgba(255,255,255,0.12)",
  orange:                "#FFB68B",
  orangeDark:            "#ff9b5e",
  orangeDeep:            "#C45C00",
  onOrange:              "#3a1400",
  text:                  "#e8e4e8",
  text2:                 "#a09ca8",
  text3:                 "#6a6672",
  cream:                 "#d3c5ad",
  green:                 "#4ade80",
};

const DEFAULT_AVATAR =
  "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=60&q=80";

// ─── Types ───────────────────────────────────────────────────────────────────
type Message = {
  id: string;
  role: "ai" | "user";
  content: string;
  time: string;
  outfitCard?: boolean;
  outfitData?: any;
  imageUris?: string[];
  isTyping?: boolean;
};

const INITIAL_MESSAGES: Message[] = [
  {
    id: "1",
    role: "user",
    content: "Show me something effortless for a Mediterranean dinner.",
    time: "Just now",
  },
  {
    id: "2",
    role: "ai",
    content:
      "I've curated a look built around your linen preference and Monaco evening palette — structured silhouette, breathable weave, exactly your aesthetic.",
    time: "Just now",
  },
];

const FILTER_PILLS = ["Party", "Minimal", "Date Night", "Business", "Resort"];
const CONTEXT_CHIPS = ["Style with blazer", "Casual alternative", "Change color", "Show accessories"];

const WIDGETS = [
  { icon: "🌤", label: "WEATHER", value: "28°C Sunny", accent: "Linen + light layers" },
  { icon: "🎨", label: "YOUR AESTHETIC", value: "Old Money Minimal", accent: null },
  { icon: "📈", label: "TRENDING", value: "Biscuit & Sage", accent: "This week" },
  { icon: "🌸", label: "YOUR PALETTE", value: "Cream, Navy", accent: "Suit your skin tone" },
  { icon: "📅", label: "UPCOMING", value: "Dinner · Fri", accent: "Prep your look" },
  { icon: "🕳", label: "WARDROBE GAP", value: "Tailored trousers", accent: "Missing from closet" },
];

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function AIScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [activePill, setActivePill] = useState("Party");
  const scrollRef = useRef<ScrollView>(null);

  // Fade-in animation on mount
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  const userAvatar =
    (user?.unsafeMetadata as { profileImageUrl?: string })?.profileImageUrl ||
    user?.imageUrl ||
    DEFAULT_AVATAR;

  const userName = user?.firstName || user?.username || "Bhavith";

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (!result.canceled)
      setSelectedImages((prev) => [...prev, ...result.assets.map((a) => a.uri)]);
  };

  const sendMessage = async (text: string, imageUris?: string[]) => {
    if (!text.trim() && (!imageUris || imageUris.length === 0)) return;
    const now = new Date();
    const time = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    const userMsgId = Date.now().toString();
    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", content: text, time, imageUris },
    ]);
    setInput("");
    setSelectedImages([]);
    setIsUploading(true);
    const aiMsgId = (Date.now() + 1).toString();
    setMessages((prev) => [
      ...prev,
      { id: aiMsgId, role: "ai", content: "", time, isTyping: true },
    ]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const formData = new FormData();
      formData.append("user_id", user?.id || "anonymous");
      if (text) formData.append("query", text);
      if (imageUris?.length) {
        imageUris.forEach((uri, i) => {
          const filename = uri.split("/").pop();
          const match = /\.(\w+)$/.exec(filename || "");
          formData.append("files", {
            uri,
            name: filename || `img_${i}.jpg`,
            type: match ? `image/${match[1]}` : "image",
          } as any);
        });
      }
      const response = await fetch(`${SERVER_BASE}/api/recommend-zara`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error(`Server ${response.status}`);
      const result = await response.json();
      if (result.success && result.outfits?.length > 0) {
        const best = result.outfits[0];
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId
              ? {
                  ...m,
                  isTyping: false,
                  content: `I've found some amazing pieces that perfectly match your style! Here's a curated look featuring ${best.reasons?.[0]?.toLowerCase() ?? "the perfect blend"}.`,
                  outfitCard: true,
                  outfitData: best,
                }
              : m
          )
        );
      } else throw new Error(result.error || "No outfits found.");
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsgId
            ? { ...m, isTyping: false, content: `I couldn't find a match right now. ${err.message}` }
            : m
        )
      );
    } finally {
      setIsUploading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[S.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Ambient glow background */}
      <View style={S.ambientBg} pointerEvents="none" />

      {/* ── Header ── */}
      <View style={S.header}>
        <View style={S.headerRow}>
          <View style={S.headerLeft}>
            {/* Logo */}
            <View style={S.logoWrap}>
              <View style={S.logoIcon}>
                <Text style={S.logoStar}>✦</Text>
              </View>
              <View style={S.onlineDot} />
            </View>
            {/* Title group */}
            <View style={S.titleGroup}>
              <Text style={S.headerTitle}>FITSENSE AI</Text>
              <Text style={S.headerSub}>Luxury Fashion Curator</Text>
            </View>
          </View>
        </View>

       
      </View>

      {/* ── Scrollable Body ── */}
      <ScrollView
        ref={scrollRef}
        style={S.body}
        contentContainerStyle={[S.bodyContent, { paddingBottom: 200 }]}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

          {/* Welcome Section */}
          <View style={S.welcomeSection}>
            <Text style={S.welcomeLabel}>{"Good Evening, " + userName.toUpperCase()}</Text>
            <Text style={S.welcomeHeadline}>{"What would you like\nto wear today?"}</Text>
            <Text style={S.welcomeSub}>
              {"Curated around your wardrobe,\naesthetic & upcoming plans."}
            </Text>

            {/* Action Cards Grid */}
            <View style={S.actionGrid}>
              <ActionCard icon="✨" label="Build Look" sub="Create a complete outfit" />
              <ActionCard icon="👔" label="Wardrobe" sub="Browse your wardrobe pieces " />
              <ActionCard icon="🔍" label="Find Similar" sub="Shop inspired looks" />
            </View>
          </View>

          {/* Featured Look */}
          <Text style={S.sectionLabel}>Featured Look of the Day</Text>
          <FeaturedCard />

          {/* Chat Messages */}
          <View style={S.chatSection}>
            {messages.map((msg) =>
              msg.role === "user" ? (
                <UserBubble key={msg.id} msg={msg} />
              ) : (
                <AIResponse key={msg.id} msg={msg} />
              )
            )}
          </View>

        </Animated.View>
      </ScrollView>

      {/* ── Fixed Bottom Area ── */}
      <View style={[S.bottomArea, { paddingBottom: insets.bottom || 20 }]}>
        {/* Context chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={S.chipsRow}
        >
          {CONTEXT_CHIPS.map((chip) => (
            <TouchableOpacity
              key={chip}
              style={S.chip}
              onPress={() => sendMessage(chip)}
              activeOpacity={0.7}
            >
              <Text style={S.chipText}>{chip}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Image previews */}
        {selectedImages.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 8 }}
            contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}
          >
            {selectedImages.map((uri, i) => (
              <View key={i} style={S.imgPreviewWrap}>
                <Image source={{ uri }} style={S.imgPreview} />
                <TouchableOpacity
                  style={S.imgRemoveBtn}
                  onPress={() => setSelectedImages((p) => p.filter((_, j) => j !== i))}
                >
                  <Text style={{ color: "#fff", fontSize: 9, fontWeight: "800" }}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Floating Input Pill */}
        <View style={S.inputPill}>
          <TouchableOpacity style={S.inputIconBtn} onPress={pickImage} activeOpacity={0.7}>
            <Text style={[S.inputIconText, selectedImages.length > 0 && { color: C.orange }]}>⊕</Text>
          </TouchableOpacity>
          <TextInput
            style={S.textInput}
            placeholder="Describe a mood or style..."
            placeholderTextColor="rgba(229,225,228,0.3)"
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => sendMessage(input, selectedImages.length ? selectedImages : undefined)}
            multiline
          />
          <TouchableOpacity style={S.inputIconBtn} activeOpacity={0.7}>
            <Text style={S.inputIconText}>🎙</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={S.sendBtn}
            onPress={() => sendMessage(input, selectedImages.length ? selectedImages : undefined)}
            disabled={isUploading}
            activeOpacity={0.8}
          >
            {isUploading ? (
              <ActivityIndicator size="small" color={C.onOrange} />
            ) : (
              <Text style={S.sendArrow}>↑</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Action Card ─────────────────────────────────────────────────────────────
function ActionCard({
  icon, label, sub, onPress,
}: {
  icon: string; label: string; sub: string; onPress?: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const handlePressIn = () =>
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 30 }).start();
  const handlePressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20 }).start();

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
      style={{ width: "32%" }}
    >
      <Animated.View style={[AC.card, { transform: [{ scale }] }]}>
        <Text style={AC.icon}>{icon}</Text>
        <Text style={AC.label}>{label}</Text>
        <Text style={AC.sub}>{sub}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Smart Widget ─────────────────────────────────────────────────────────────
function SmartWidget({ icon, label, value, accent }: {
  icon: string; label: string; value: string; accent: string | null;
}) {
  return (
    <TouchableOpacity style={SW.widget} activeOpacity={0.75}>
      <Text style={SW.icon}>{icon}</Text>
      <Text style={SW.label}>{label}</Text>
      <Text style={SW.value}>{value}</Text>
      {accent && <Text style={SW.accent}>{accent}</Text>}
    </TouchableOpacity>
  );
}

// ─── Featured Card ────────────────────────────────────────────────────────────
function FeaturedCard() {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <TouchableOpacity
      style={FC.card}
      activeOpacity={1}
      onPressIn={() => Animated.spring(scale, { toValue: 0.985, useNativeDriver: true, speed: 30 }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20 }).start()}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        {/* Hero Image Placeholder */}
        <View style={FC.imgWrap}>
          <View style={FC.imgPlaceholder}>
            <Text style={FC.silhouette}>🧥</Text>
            <Text style={FC.imgLabel}>Editorial Look</Text>
          </View>
          <View style={FC.matchBadge}>
            <Text style={FC.matchStar}>✦</Text>
            <Text style={FC.matchText}>97% Match</Text>
          </View>
        </View>
        {/* Body */}
        <View style={FC.body}>
          <Text style={FC.title}>The Monaco Evening</Text>
          <Text style={FC.desc}>
            Architectural linen silhouette meets effortless dusk dressing. Breathable, elevated, unmistakably curated.
          </Text>
          <View style={FC.tagsRow}>
            {["Minimal", "Old Money", "Dinner", "Linen"].map((t) => (
              <View key={t} style={FC.tag}><Text style={FC.tagText}>{t.toUpperCase()}</Text></View>
            ))}
          </View>
          <View style={FC.actionsRow}>
            <TouchableOpacity style={FC.btnPrimary} activeOpacity={0.8}>
              <Text style={FC.btnPrimaryText}>VIEW LOOK</Text>
            </TouchableOpacity>
            <TouchableOpacity style={FC.btnSecondary} activeOpacity={0.8}>
              <Text style={FC.btnSecondaryText}>Save ♡</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── User Bubble ──────────────────────────────────────────────────────────────
function UserBubble({ msg }: { msg: Message }) {
  return (
    <View style={UB.wrapper}>
      {msg.imageUris && msg.imageUris.length > 0 && (
        <View style={UB.imgRow}>
          {msg.imageUris.map((uri, i) => (
            <Image key={i} source={{ uri }} style={UB.img} />
          ))}
        </View>
      )}
      {!!msg.content && (
        <View style={UB.bubble}>
          <Text style={UB.text}>{msg.content}</Text>
        </View>
      )}
    </View>
  );
}

// ─── AI Response ──────────────────────────────────────────────────────────────
function AIResponse({ msg }: { msg: Message }) {
  return (
    <View style={AI_S.wrapper}>
      <View style={AI_S.curatorLabel}>
        <View style={AI_S.curatorBar} />
        <Text style={AI_S.curatorText}>SENSE AI CURATOR</Text>
      </View>
      {msg.isTyping ? (
        <View style={AI_S.typingBubble}>
          <TypingDots />
        </View>
      ) : (
        <>
          {!!msg.content && (
            <View style={AI_S.textBubble}>
              <Text style={AI_S.text}>{msg.content}</Text>
            </View>
          )}
          {msg.outfitCard && msg.outfitData && <OutfitCard data={msg.outfitData} />}
        </>
      )}
    </View>
  );
}

// ─── Outfit Card ──────────────────────────────────────────────────────────────
function OutfitCard({ data }: { data: any }) {
  if (!data?.outfit) return null;
  const { outfit, score } = data;
  const { top, bottom, shoes, outerwear, accessory } = outfit;
  const mainPiece = outerwear || top;

  return (
    <View style={OC.card}>
      <View style={OC.imageWrap}>
        {mainPiece?.image_path ? (
          <Image source={{ uri: mainPiece.image_path }} style={OC.mainImage} resizeMode="cover" />
        ) : (
          <View style={[OC.mainImage, { backgroundColor: C.surface3, alignItems: "center", justifyContent: "center" }]}>
            <Text style={{ fontSize: 48 }}>👔</Text>
          </View>
        )}
        <View style={OC.matchBadge}>
          <Text style={OC.matchIcon}>✦</Text>
          <Text style={OC.matchText}>{Math.round((score ?? 0.98) * 100)}% Match</Text>
        </View>
      </View>
      <View style={OC.body}>
        <View style={OC.titleRow}>
          <Text style={OC.title}>{mainPiece?.name ?? "Structured Linen Silhouette"}</Text>
          <Text style={OC.price}>€{mainPiece?.price ?? "420"}</Text>
        </View>
        <View style={OC.tagsRow}>
          <View style={OC.tag}><Text style={OC.tagText}>BESPOKE</Text></View>
          <View style={OC.tag}><Text style={OC.tagText}>LINEN</Text></View>
        </View>
        <Text style={OC.description}>
          {mainPiece?.description ?? "Architectural draping meets breathable weave. This piece captures the Monaco dusk with an effortless tonal shift."}
        </Text>
        <View style={OC.actionsRow}>
          <View style={OC.swatches}>
            <View style={[OC.swatch, OC.swatchActive]} />
            <View style={[OC.swatch, { backgroundColor: C.cream, opacity: 0.5 }]} />
            <View style={[OC.swatch, { backgroundColor: C.surfaceVariant, opacity: 0.5 }]} />
          </View>
          <View style={OC.iconBtns}>
            <TouchableOpacity><Text style={OC.iconBtn}>🔖</Text></TouchableOpacity>
            <TouchableOpacity><Text style={OC.iconBtn}>♡</Text></TouchableOpacity>
            <TouchableOpacity style={OC.buyBtn}>
              <Text style={OC.buyText}>BUY</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
      <View style={OC.accessories}>
        <Text style={OC.accTitle}>COMPLETE THE LOOK</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={OC.accScroll}>
          {[
            { item: shoes,     label: shoes?.name     ?? "Vesta Sneakers"  },
            { item: accessory, label: accessory?.name ?? "Orbit Timepiece" },
            { item: bottom,    label: bottom?.name    ?? "Nomad Carryall"  },
          ].map((acc, i) => (
            <View key={i} style={OC.accItem}>
              <View style={OC.accImgWrap}>
                {acc.item?.image_path ? (
                  <Image source={{ uri: acc.item.image_path }} style={OC.accImg} resizeMode="cover" />
                ) : (
                  <View style={[OC.accImg, { backgroundColor: C.surface3 }]} />
                )}
              </View>
              <Text style={OC.accLabel}>{acc.label}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

// ─── Typing Dots ──────────────────────────────────────────────────────────────
function TypingDots() {
  const anims = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];

  useEffect(() => {
    const loop = Animated.loop(
      Animated.stagger(
        200,
        anims.map((a) =>
          Animated.sequence([
            Animated.timing(a, { toValue: -4, duration: 300, useNativeDriver: true }),
            Animated.timing(a, { toValue: 0, duration: 300, useNativeDriver: true }),
          ])
        )
      )
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
      {anims.map((anim, i) => (
        <Animated.View
          key={i}
          style={{
            width: 7, height: 7, borderRadius: 4,
            backgroundColor: C.orange,
            opacity: 0.6 + i * 0.2,
            transform: [{ translateY: anim }],
          }}
        />
      ))}
    </View>
  );
}

// ─── StyleSheets ──────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  // Ambient glow overlay
  ambientBg: {
    position: "absolute", inset: 0,
    // Simulated with a very subtle radial tint — actual gradient requires expo-linear-gradient
    backgroundColor: "transparent",
  },

  // Header
  header: {
    backgroundColor: "rgba(12,12,14,0.95)",
    paddingTop: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  headerRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24, paddingBottom: 14,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  logoWrap: { position: "relative" },
  logoIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: "rgba(255,182,139,0.1)",
    borderWidth: 1, borderColor: "rgba(255,182,139,0.25)",
    alignItems: "center", justifyContent: "center",
  },
  logoStar: { fontSize: 16, color: C.orange },
  onlineDot: {
    position: "absolute", bottom: 1, right: 1,
    width: 9, height: 9, borderRadius: 5,
    backgroundColor: C.green,
    borderWidth: 1.5, borderColor: C.bg,
  },
  titleGroup: { flexDirection: "column", gap: 1 },
  headerTitle: { color: C.text, fontSize: 17, fontWeight: "700", letterSpacing: -0.3 },
  headerSub: { color: C.orange, fontSize: 10, fontWeight: "500", letterSpacing: 1.2, opacity: 0.8 },
  notifBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: C.surface3,
    borderWidth: 1, borderColor: C.border2,
    alignItems: "center", justifyContent: "center",
    position: "relative",
  },
  notifIcon: { fontSize: 16 },
  notifBadge: {
    position: "absolute", top: -4, right: -4,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: C.orange, borderWidth: 1.5, borderColor: C.bg,
    alignItems: "center", justifyContent: "center",
  },
  notifBadgeText: { color: C.onOrange, fontSize: 8, fontWeight: "800" },
  pillsScroll: { paddingLeft: 24 },
  pillsRow: { gap: 8, paddingRight: 24, paddingBottom: 14 },
  pill: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 999, borderWidth: 1,
    borderColor: C.border,
    backgroundColor: "rgba(42,42,45,0.5)",
  },
  pillActive: {
    borderColor: "rgba(255,182,139,0.4)",
    backgroundColor: "rgba(255,182,139,0.08)",
  },
  pillText: { color: C.text2, fontSize: 10, fontWeight: "600", letterSpacing: 1.5 },
  pillTextActive: { color: C.orange },

  // Body
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: 20 },

  // Welcome
  welcomeSection: { marginTop: 28, marginBottom: 28 },
  welcomeLabel: {
    color: C.cream, fontSize: 10, fontWeight: "600",
    letterSpacing: 2, textTransform: "uppercase", marginBottom: 10,
  },
  welcomeHeadline: {
    color: C.text, fontSize: 30, fontWeight: "800",
    letterSpacing: -0.8, lineHeight: 38, marginBottom: 10,
  },
  welcomeSub: {
    color: C.text3, fontSize: 13, lineHeight: 20, marginBottom: 24,
  },
  actionGrid: {
    flexDirection: "row",  gap: 12,
  },

  // Context bar
  contextBar: {
    flexDirection: "row", alignItems: "center",
    gap: 10, paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(42,42,45,0.4)",
    borderWidth: 1, borderColor: C.border,
    marginBottom: 28,
  },
  contextText: { color: C.cream, fontSize: 10, fontWeight: "600", letterSpacing: 1.2, textTransform: "uppercase" },
  contextDivider: { color: C.text3, fontSize: 11 },

  // Section label
  sectionLabel: {
    color: C.text2, fontSize: 10, fontWeight: "700",
    letterSpacing: 2, textTransform: "uppercase",
    marginBottom: 12,
  },

  // Widgets
  widgetsScroll: { marginBottom: 28, marginHorizontal: -4 },
  widgetsRow: { gap: 10, paddingHorizontal: 4 },

  // Chat
  chatSection: { gap: 24, marginTop: 4 },

  // Bottom area
  bottomArea: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    paddingHorizontal: 20, paddingTop: 16,
    backgroundColor: "rgba(12,12,14,0.96)",
    borderTopWidth: 0.5,
    borderTopColor: "rgba(255,255,255,0.05)",
  },
  chipsRow: { gap: 8, paddingBottom: 12 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: C.surface3,
    borderWidth: 1, borderColor: C.border,
  },
  chipText: { color: C.text2, fontSize: 12 },

  imgPreviewWrap: { position: "relative", width: 60, height: 60 },
  imgPreview: {
    width: 60, height: 60, borderRadius: 10,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
  },
  imgRemoveBtn: {
    position: "absolute", top: -6, right: -6,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: C.surface3,
    alignItems: "center", justifyContent: "center",
  },

  // Input pill
  inputPill: {
    flexDirection: "row", alignItems: "center",
    gap: 4, padding: 6, borderRadius: 999,
    backgroundColor: "rgba(42,42,45,0.7)",
    borderWidth: 1, borderColor: C.border2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4, shadowRadius: 20, elevation: 10,
  },
  inputIconBtn: { padding: 10 },
  inputIconText: { fontSize: 20, color: "rgba(160,156,168,0.6)" },
  textInput: {
    flex: 1, color: C.text, fontSize: 14,
    paddingVertical: 8, maxHeight: 100,
  },
  sendBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: C.orange,
    alignItems: "center", justifyContent: "center",
    shadowColor: C.orange, shadowRadius: 10, shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 0 },
  },
  sendArrow: { color: C.onOrange, fontSize: 18, fontWeight: "800" },
});

// Action Card styles
const AC = StyleSheet.create({
  card: {
    padding: 16, borderRadius: 16,
    backgroundColor: "rgba(42,42,45,0.6)",
    borderWidth: 1, borderColor: C.border,
    gap: 6,
  },
  icon: { fontSize: 22 },
  label: { color: C.text, fontSize: 14, fontWeight: "600" },
  sub: { color: C.text3, fontSize: 11 },
});

// Smart Widget styles
const SW = StyleSheet.create({
  widget: {
    width: 140, padding: 14, borderRadius: 16,
    backgroundColor: C.surface2,
    borderWidth: 1, borderColor: C.border,
  },
  icon: { fontSize: 20, marginBottom: 8 },
  label: { color: C.text3, fontSize: 9, fontWeight: "600", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 },
  value: { color: C.text, fontSize: 13, fontWeight: "600", lineHeight: 18 },
  accent: { color: C.orange, fontSize: 11, marginTop: 4 },
});

// Featured Card styles
const FC = StyleSheet.create({
  card: { marginBottom: 28, borderRadius: 24, overflow: "hidden", backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border },
  imgWrap: { height: 220, position: "relative" },
  imgPlaceholder: {
    flex: 1, alignItems: "center", justifyContent: "center",
    backgroundColor: "#16151a", gap: 8,
  },
  silhouette: { fontSize: 56, opacity: 0.5 },
  imgLabel: { color: "rgba(255,182,139,0.4)", fontSize: 10, letterSpacing: 2, textTransform: "uppercase" },
  matchBadge: {
    position: "absolute", top: 14, left: 14,
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(12,12,14,0.75)",
    borderWidth: 1, borderColor: "rgba(255,182,139,0.25)",
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5,
  },
  matchStar: { color: C.orange, fontSize: 11 },
  matchText: { color: C.orange, fontSize: 11, fontWeight: "700" },
  body: { padding: 18 },
  title: { color: C.text, fontSize: 18, fontWeight: "700", letterSpacing: -0.3, marginBottom: 6 },
  desc: { color: C.text2, fontSize: 12, lineHeight: 18, marginBottom: 12 },
  tagsRow: { flexDirection: "row", gap: 6, flexWrap: "wrap", marginBottom: 16 },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: C.border },
  tagText: { color: C.text2, fontSize: 10, fontWeight: "600", letterSpacing: 1 },
  actionsRow: { flexDirection: "row", gap: 10 },
  btnPrimary: { flex: 1, paddingVertical: 11, borderRadius: 10, backgroundColor: C.orange, alignItems: "center" },
  btnPrimaryText: { color: C.onOrange, fontSize: 12, fontWeight: "800", letterSpacing: 1 },
  btnSecondary: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 10, backgroundColor: "transparent", borderWidth: 1, borderColor: C.border2, alignItems: "center" },
  btnSecondaryText: { color: C.text2, fontSize: 12, fontWeight: "600" },
});

// User Bubble styles
const UB = StyleSheet.create({
  wrapper: { alignItems: "flex-end" },
  imgRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 6, justifyContent: "flex-end" },
  img: { width: 90, height: 90, borderRadius: 10 },
  bubble: {
    maxWidth: "80%", paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: 18, borderTopRightRadius: 4,
    backgroundColor: C.orangeDeep,
    shadowColor: C.orange, shadowRadius: 8, shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
  },
  text: { color: "#ffe8d6", fontSize: 14, fontWeight: "500", lineHeight: 22 },
});

// AI Response styles
const AI_S = StyleSheet.create({
  wrapper: { gap: 8 },
  curatorLabel: { flexDirection: "row", alignItems: "center", gap: 8 },
  curatorBar: { width: 3, height: 14, backgroundColor: C.cream, borderRadius: 2 },
  curatorText: { color: C.text2, fontSize: 9, fontWeight: "700", letterSpacing: 2, textTransform: "uppercase" },
  typingBubble: { backgroundColor: C.surface3, padding: 16, borderRadius: 16, alignSelf: "flex-start" },
  textBubble: { backgroundColor: C.surface3, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: C.border },
  text: { color: C.text2, fontSize: 14, lineHeight: 22 },
});

// Outfit Card styles
const OC = StyleSheet.create({
  card: { backgroundColor: C.surface3, borderRadius: 24, overflow: "hidden", shadowColor: "#000", shadowRadius: 20, shadowOpacity: 0.4, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
  imageWrap: { height: 360, position: "relative" },
  mainImage: { width: "100%", height: "100%" },
  matchBadge: { position: "absolute", top: 16, left: 16, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(42,42,45,0.55)", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  matchIcon: { color: C.orange, fontSize: 12 },
  matchText: { color: C.orange, fontSize: 12, fontWeight: "700" },
  body: { padding: 20 },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  title: { color: C.text, fontSize: 20, fontWeight: "800", letterSpacing: -0.3, flex: 1, marginRight: 12 },
  price: { color: C.cream, fontSize: 18, fontWeight: "500" },
  tagsRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  tag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: C.bg },
  tagText: { color: C.text, fontSize: 10, fontWeight: "700", letterSpacing: 1.5 },
  description: { color: C.text2, fontSize: 14, lineHeight: 22, marginBottom: 20 },
  actionsRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: C.border, paddingTop: 16 },
  swatches: { flexDirection: "row", gap: 6 },
  swatch: { width: 16, height: 16, borderRadius: 8 },
  swatchActive: { backgroundColor: "#E5E1E4", borderWidth: 2, borderColor: C.orange },
  iconBtns: { flexDirection: "row", alignItems: "center", gap: 14 },
  iconBtn: { fontSize: 20, color: C.text2 },
  buyBtn: { paddingHorizontal: 22, paddingVertical: 9, borderRadius: 999, backgroundColor: C.orange, shadowColor: C.orange, shadowRadius: 8, shadowOpacity: 0.3, shadowOffset: { width: 0, height: 0 } },
  buyText: { color: C.onOrange, fontSize: 12, fontWeight: "800", letterSpacing: 1.5 },
  accessories: { paddingHorizontal: 20, paddingBottom: 20 },
  accTitle: { color: C.cream, fontSize: 9, fontWeight: "700", letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 14 },
  accScroll: { gap: 24, paddingRight: 8 },
  accItem: { flexDirection: "row", alignItems: "center", gap: 12 },
  accImgWrap: { width: 48, height: 48, borderRadius: 10, overflow: "hidden", backgroundColor: C.bg },
  accImg: { width: "100%", height: "100%" },
  accLabel: { color: C.text, fontSize: 11, fontWeight: "500" },
});