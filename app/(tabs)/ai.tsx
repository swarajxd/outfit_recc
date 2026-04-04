import { useUser } from "@clerk/clerk-expo";
import * as ImagePicker from "expo-image-picker";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
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

// ─── Design Tokens (from HTML / design-system.md) ───────────────────────────
const C = {
  surface: "#131315",
  surfaceContainer: "#201F21",
  surfaceContainerHigh: "#2A2A2C",
  surfaceContainerLow: "#1C1B1D",
  surfaceContainerLowest: "#0E0E10",
  surfaceVariant: "#353437",
  onSurface: "#E5E1E4",
  onSurfaceVariant: "#C8C5CA",
  primary: "#FFB68B",
  onPrimary: "#522300",
  onPrimaryFixed: "#321200",
  onPrimaryContainer: "#C45C00",
  secondary: "#C8C5CA",
  secondaryFixed: "#E4E1E6",
  tertiary: "#D3C5AD",
  outline: "#919095",
  outlineVariant: "#47464A",
};

const DEFAULT_AVATAR =
  "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=60&q=80";

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
];

const FILTER_PILLS = ["Party", "Minimal", "Date Night", "Business"];
const CONTEXT_CHIPS = [
  "Style with blazer",
  "Casual alternative",
  "Change color",
];

export default function AIScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [hasImagesUploaded, setHasImagesUploaded] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

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
    if (!result.canceled) {
      const newUris = result.assets.map((a) => a.uri);
      setSelectedImages((prev) => [...prev, ...newUris]);
      setHasImagesUploaded(true);
    }
  };

  // Note: 3 option cards appear automatically when image is uploaded (hasImagesUploaded = true)
  // User then types a prompt and selects one of the 3 modes to get recommendations
  const handleSendPrompt = () => {
    // This function exists for future use - currently the 3 cards appear after image upload
  };

  const sendMessage = async (
    text: string,
    imageUris?: string[],
    mode?: string,
  ) => {
    if (!text.trim() && (!imageUris || imageUris.length === 0)) return;
    const now = new Date();
    const time = now.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const userMsgId = Date.now().toString();
    setMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        role: "user",
        content: text || (mode ? `Mode: ${mode}` : ""),
        time,
        imageUris,
      },
    ]);
    setInput("");
    setIsUploading(true);
    const aiMsgId = (Date.now() + 1).toString();
    setMessages((prev) => [
      ...prev,
      { id: aiMsgId, role: "ai", content: "", time, isTyping: true },
    ]);

    try {
      const formData = new FormData();
      formData.append("user_id", user?.id || "anonymous");
      if (text) formData.append("query", text);
      if (mode) formData.append("mode", mode);
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
              : m,
          ),
        );
        // Clear images after successful recommendation
        setSelectedImages([]);
        setInput(""); // Clear input too
      } else throw new Error(result.error || "No outfits found.");
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsgId
            ? {
                ...m,
                isTyping: false,
                content: `I couldn't find a match right now. ${err.message}`,
              }
            : m,
        ),
      );
    } finally {
      setIsUploading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const handleRecommendationSourceSelect = (mode: string) => {
    // Store the current input and images for the recommendation call
    const prompt = input || "Recommend an outfit for me";
    const images = selectedImages.length > 0 ? selectedImages : undefined;

    // Clear input and selection after selection
    setInput("");
    setSelectedImages([]);

    sendMessage(prompt, images, mode);
  };

  return (
    <KeyboardAvoidingView
      style={[S.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* ── Header ── */}
      <View style={S.header}>
        <View style={S.headerRow}>
          <View style={S.headerLeft}>
            <Image source={{ uri: userAvatar }} style={S.headerAvatar} />
            <Text style={S.headerTitle}>Sense AI</Text>
          </View>
          <TouchableOpacity>
            <Text style={S.bellIcon}>🔔</Text>
          </TouchableOpacity>
        </View>

        {/* Filter pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={S.pillsRow}
          style={S.pillsScroll}
        >
          {FILTER_PILLS.map((pill) => (
            <TouchableOpacity key={pill} style={S.pill}>
              <Text style={S.pillText}>{pill.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── Scrollable Content ── */}
      <ScrollView
        ref={scrollRef}
        style={S.body}
        contentContainerStyle={[S.bodyContent, { paddingBottom: 200 }]}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() =>
          scrollRef.current?.scrollToEnd({ animated: false })
        }
      >
        {/* Welcome */}
        <View style={S.welcomeSection}>
          <Text style={S.welcomeLabel}>
            {"Good Evening, " + userName.toUpperCase()}
          </Text>
          <Text style={S.welcomeHeadline}>
            {"What would you like to\nwear today?"}
          </Text>

          <View style={S.actionGrid}>
            {!hasImagesUploaded ? (
              <ActionCard icon="📤" label="Upload Outfit" onPress={pickImage} />
            ) : (
              <>
                <ActionCard
                  icon="✨"
                  label="Build Look"
                  onPress={() => handleRecommendationSourceSelect("build")}
                />
                <ActionCard
                  icon="👔"
                  label="Wardrobe"
                  onPress={() => handleRecommendationSourceSelect("wardrobe")}
                />
                <ActionCard
                  icon="🔍"
                  label="Find Similar"
                  onPress={() => handleRecommendationSourceSelect("similar")}
                />
              </>
            )}
          </View>
        </View>

        {/* Smart Context Bar */}
        <View style={S.contextBar}>
          <Text style={S.contextText}>📍 Monaco · 28°C</Text>
          <Text style={S.contextDivider}>|</Text>
          <Text style={S.contextText}>Linen recommended</Text>
          <Text style={S.contextDivider}>|</Text>
          <Text style={S.contextText}>SPF suggested</Text>
        </View>

        {/* Chat Messages */}
        <View style={S.chatSection}>
          {messages.map((msg) =>
            msg.role === "user" ? (
              <UserBubble key={msg.id} msg={msg} />
            ) : (
              <AIResponse key={msg.id} msg={msg} />
            ),
          )}
        </View>
      </ScrollView>

      {/* ── Fixed Bottom Area ── */}
      <View style={[S.bottomArea, { paddingBottom: insets.bottom || 20 }]}>
        {/* Context chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={S.contextChipsRow}
        >
          {CONTEXT_CHIPS.map((chip) => (
            <TouchableOpacity
              key={chip}
              style={S.contextChip}
              onPress={() => sendMessage(chip)}
            >
              <Text style={S.contextChipText}>{chip}</Text>
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
                  onPress={() =>
                    setSelectedImages((p) => p.filter((_, j) => j !== i))
                  }
                >
                  <Text
                    style={{ color: "#fff", fontSize: 9, fontWeight: "800" }}
                  >
                    ✕
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Floating Input Pill */}
        <View style={S.inputPill}>
          <TouchableOpacity style={S.inputIconBtn} onPress={pickImage}>
            <Text
              style={[
                S.inputIconText,
                selectedImages.length > 0 && { color: C.primary },
              ]}
            >
              ⊕
            </Text>
          </TouchableOpacity>

          <TextInput
            style={S.textInput}
            placeholder="Describe a mood or style..."
            placeholderTextColor="rgba(229,225,228,0.4)"
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => {
              // Show 3 option cards after prompt is entered
              handleSendPrompt();
            }}
            multiline
          />

          <TouchableOpacity style={S.inputIconBtn}>
            <Text style={S.inputIconText}>🎙</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={S.sendBtn}
            onPress={() => {
              // Show 3 option cards after prompt is entered
              handleSendPrompt();
            }}
            disabled={isUploading}
          >
            {isUploading ? (
              <ActivityIndicator size="small" color={C.onPrimaryFixed} />
            ) : (
              <Text style={S.sendArrow}>↑</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Action Card ──────────────────────────────────────────────────────────────
function ActionCard({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity style={AC.card} onPress={onPress} activeOpacity={0.75}>
      <Text style={AC.icon}>{icon}</Text>
      <Text style={AC.label}>{label}</Text>
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
      {/* "Sense AI Curator" label */}
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
          {msg.outfitCard && msg.outfitData && (
            <OutfitCard data={msg.outfitData} />
          )}
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
      {/* Large hero image */}
      <View style={OC.imageWrap}>
        {mainPiece?.image_path ? (
          <Image
            source={{ uri: mainPiece.image_path }}
            style={OC.mainImage}
            resizeMode="cover"
          />
        ) : (
          <View
            style={[OC.mainImage, { backgroundColor: C.surfaceContainerHigh }]}
          />
        )}
        {/* Match badge */}
        <View style={OC.matchBadge}>
          <Text style={OC.matchIcon}>✦</Text>
          <Text style={OC.matchText}>
            {Math.round((score ?? 0.98) * 100)}% Match
          </Text>
        </View>
      </View>

      {/* Body */}
      <View style={OC.body}>
        <View style={OC.titleRow}>
          <Text style={OC.title}>
            {mainPiece?.name ?? "Structured Linen Silhouette"}
          </Text>
          <Text style={OC.price}>€{mainPiece?.price ?? "420"}</Text>
        </View>

        <View style={OC.tagsRow}>
          <View style={OC.tag}>
            <Text style={OC.tagText}>BESPOKE</Text>
          </View>
          <View style={OC.tag}>
            <Text style={OC.tagText}>LINEN</Text>
          </View>
        </View>

        <Text style={OC.description}>
          {mainPiece?.description ??
            "Architectural draping meets breathable weave. This piece captures the Monaco dusk with an effortless tonal shift."}
        </Text>

        {/* Actions row */}
        <View style={OC.actionsRow}>
          <View style={OC.swatches}>
            <View style={[OC.swatch, OC.swatchActive]} />
            <View
              style={[OC.swatch, { backgroundColor: C.tertiary, opacity: 0.5 }]}
            />
            <View
              style={[
                OC.swatch,
                { backgroundColor: C.surfaceVariant, opacity: 0.5 },
              ]}
            />
          </View>
          <View style={OC.iconBtns}>
            <TouchableOpacity>
              <Text style={OC.iconBtn}>🔖</Text>
            </TouchableOpacity>
            <TouchableOpacity>
              <Text style={OC.iconBtn}>♡</Text>
            </TouchableOpacity>
            <TouchableOpacity style={OC.buyBtn}>
              <Text style={OC.buyText}>BUY</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Complete the look */}
      <View style={OC.accessories}>
        <Text style={OC.accTitle}>COMPLETE THE LOOK</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={OC.accScroll}
        >
          {[
            { item: shoes, label: shoes?.name ?? "Vesta Sneakers" },
            { item: accessory, label: accessory?.name ?? "Orbit Timepiece" },
            { item: bottom, label: bottom?.name ?? "Nomad Carryall" },
          ].map((acc, i) => (
            <View key={i} style={OC.accItem}>
              <View style={OC.accImgWrap}>
                {acc.item?.image_path ? (
                  <Image
                    source={{ uri: acc.item.image_path }}
                    style={OC.accImg}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={[
                      OC.accImg,
                      { backgroundColor: C.surfaceContainerHigh },
                    ]}
                  />
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
  return (
    <View style={{ flexDirection: "row", gap: 5 }}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={{
            width: 7,
            height: 7,
            borderRadius: 4,
            backgroundColor: C.primary,
            opacity: 0.5 + i * 0.25,
          }}
        />
      ))}
    </View>
  );
}

// ─── StyleSheets ──────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },

  // Header
  header: { backgroundColor: C.surface, paddingTop: 8 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerAvatar: { width: 32, height: 32, borderRadius: 16 },
  headerTitle: {
    color: C.onSurface,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  bellIcon: { fontSize: 20, color: C.primary },
  pillsScroll: { paddingLeft: 24 },
  pillsRow: { gap: 8, paddingRight: 24, paddingBottom: 12 },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(71,70,74,0.4)",
    backgroundColor: "rgba(53,52,55,0.4)",
  },
  pillText: {
    color: C.secondaryFixed,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1.5,
  },

  // Body
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: 20 },

  // Welcome section
  welcomeSection: { marginTop: 16, marginBottom: 28 },
  welcomeLabel: {
    color: C.tertiary,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  welcomeHeadline: {
    color: C.onSurface,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
    lineHeight: 36,
    marginBottom: 24,
  },
  actionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },

  // Context bar
  contextBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(53,52,55,0.4)",
    borderWidth: 1,
    borderColor: "rgba(71,70,74,0.1)",
    marginBottom: 28,
  },
  contextText: {
    color: C.tertiary,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  contextDivider: { color: "rgba(71,70,74,0.6)", fontSize: 12 },

  // Chat section
  chatSection: { gap: 24 },

  // Bottom
  bottomArea: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    // gradient fade from surface
    backgroundColor: C.surface,
  },
  contextChipsRow: { gap: 8, paddingBottom: 12 },
  contextChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: C.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: "rgba(71,70,74,0.1)",
  },
  contextChipText: { color: C.onSurfaceVariant, fontSize: 12 },

  imgPreviewWrap: { position: "relative", width: 60, height: 60 },
  imgPreview: {
    width: 60,
    height: 60,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  imgRemoveBtn: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: C.surfaceContainerHigh,
    alignItems: "center",
    justifyContent: "center",
  },

  // Floating input pill
  inputPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    padding: 6,
    borderRadius: 999,
    backgroundColor: "rgba(53,52,55,0.4)",
    borderWidth: 1,
    borderColor: "rgba(71,70,74,0.2)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  inputIconBtn: { padding: 10 },
  inputIconText: { fontSize: 20, color: "rgba(200,197,202,0.6)" },
  textInput: {
    flex: 1,
    color: C.onSurface,
    fontSize: 14,
    paddingVertical: 8,
    maxHeight: 100,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: C.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: C.primary,
    shadowRadius: 8,
    shadowOpacity: 0.3,
  },
  sendArrow: { color: C.onPrimaryFixed, fontSize: 18, fontWeight: "800" },
});

const AC = StyleSheet.create({
  card: {
    width: "47%",
    padding: 16,
    borderRadius: 12,
    backgroundColor: "rgba(53,52,55,0.4)",
    borderWidth: 1,
    borderColor: "rgba(71,70,74,0.15)",
    gap: 10,
  },
  icon: { fontSize: 22, color: C.primary },
  label: { color: C.onSurface, fontSize: 14, fontWeight: "500" },
});

const UB = StyleSheet.create({
  wrapper: { alignItems: "flex-end" },
  imgRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 6,
    justifyContent: "flex-end",
  },
  img: { width: 90, height: 90, borderRadius: 10 },
  bubble: {
    maxWidth: "80%",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 18,
    borderTopRightRadius: 4,
    // gradient-like: orange primary → dark orange
    backgroundColor: C.onPrimaryContainer,
    shadowColor: C.primary,
    shadowRadius: 8,
    shadowOpacity: 0.15,
  },
  text: {
    color: C.onPrimaryFixed,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 22,
  },
});

const AI_S = StyleSheet.create({
  wrapper: { gap: 10 },
  curatorLabel: { flexDirection: "row", alignItems: "center", gap: 8 },
  curatorBar: {
    width: 3,
    height: 16,
    backgroundColor: C.tertiary,
    borderRadius: 2,
  },
  curatorText: {
    color: C.onSurfaceVariant,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  typingBubble: {
    backgroundColor: C.surfaceContainerHigh,
    padding: 16,
    borderRadius: 16,
    alignSelf: "flex-start",
  },
  textBubble: {
    backgroundColor: C.surfaceContainerHigh,
    borderRadius: 16,
    padding: 14,
  },
  text: { color: C.onSurfaceVariant, fontSize: 14, lineHeight: 22 },
});

const OC = StyleSheet.create({
  card: {
    backgroundColor: C.surfaceContainerHigh,
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#000",
    shadowRadius: 20,
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },

  imageWrap: { height: 360, position: "relative" },
  mainImage: { width: "100%", height: "100%" },
  matchBadge: {
    position: "absolute",
    top: 16,
    left: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(53,52,55,0.55)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  matchIcon: { color: C.primary, fontSize: 12 },
  matchText: { color: C.primary, fontSize: 12, fontWeight: "700" },

  body: { padding: 20 },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  title: {
    color: C.onSurface,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.3,
    flex: 1,
    marginRight: 12,
  },
  price: { color: C.tertiary, fontSize: 18, fontWeight: "500" },

  tagsRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#0E0E10",
  },
  tagText: {
    color: C.secondaryFixed,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
  },

  description: {
    color: C.onSurfaceVariant,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 20,
  },

  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "rgba(71,70,74,0.15)",
    paddingTop: 16,
  },
  swatches: { flexDirection: "row", gap: 6 },
  swatch: { width: 16, height: 16, borderRadius: 8 },
  swatchActive: {
    backgroundColor: "#E5E1E4",
    borderWidth: 2,
    borderColor: C.primary,
  },
  iconBtns: { flexDirection: "row", alignItems: "center", gap: 14 },
  iconBtn: { fontSize: 20, color: C.onSurfaceVariant },
  buyBtn: {
    paddingHorizontal: 22,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: C.primary,
    shadowColor: C.primary,
    shadowRadius: 8,
    shadowOpacity: 0.3,
  },
  buyText: {
    color: C.onPrimaryFixed,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.5,
  },

  accessories: { paddingHorizontal: 20, paddingBottom: 20 },
  accTitle: {
    color: C.tertiary,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2.5,
    textTransform: "uppercase",
    marginBottom: 14,
  },
  accScroll: { gap: 24, paddingRight: 8 },
  accItem: { flexDirection: "row", alignItems: "center", gap: 12 },
  accImgWrap: {
    width: 48,
    height: 48,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: C.surfaceContainerLowest,
  },
  accImg: { width: "100%", height: "100%" },
  accLabel: { color: C.onSurface, fontSize: 11, fontWeight: "500" },
});
