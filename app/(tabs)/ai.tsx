import { useUser } from "@clerk/clerk-expo";
import * as ImagePicker from "expo-image-picker";
import React, { useRef, useState } from "react";
import {
    ActivityIndicator,
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

const W = Dimensions.get("window").width;
const CARD_W = W - 40;
const HALF_W = Math.floor(CARD_W / 2);
const PANEL_H = 250;
const PANEL_H2 = 180;
const RANK_LABELS = ["Best Match", "Strong Pick", "Solid Look"];

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
  const [showModeCards, setShowModeCards] = useState(false);
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
      setShowModeCards(true);
    }
  };

  // Called when user hits send or submit with a prompt (with or without image).
  // Shows the 3 mode cards so the user can pick Build Look / Wardrobe / Find Similar.
  const handleSendPrompt = () => {
    if (!input.trim() && selectedImages.length === 0) return;
    setShowModeCards(true);
  };

  /**
   * Always use the unified /recommend-styled endpoint on the main server.
   * The server will forward the "mode" parameter to the Python AI model,
   * which handles dataset selection (Wardrobe, Zara, or Both).
   */
  const resolveEndpoint = (mode?: string): string => {
    return `${SERVER_BASE}/api/recommend-styled`;
  };

  const modeLabel = (mode?: string): string => {
    switch (mode) {
      case "build":
        return "Build Look";
      case "wardrobe":
        return "My Wardrobe";
      case "similar":
        return "Find Similar";
      default:
        return "Recommend";
    }
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
        content: text || `[${modeLabel(mode)}]`,
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
      const endpoint = resolveEndpoint(mode);

      // Always use POST for the unified recommendation endpoint
      const formData = new FormData();
      formData.append("user_id", user?.id || "anonymous");
      if (text) formData.append("query", text);
      if (mode) formData.append("mode", mode);

      if (imageUris?.length) {
        if (Platform.OS === "web") {
          // Web: we must append real Blob/File objects (uri-based objects don't upload bytes)
          await Promise.all(
            imageUris.map(async (uri, i) => {
              const filename = uri.split("/").pop() || `img_${i}.jpg`;
              const resp = await fetch(uri);
              const blob = await resp.blob();
              const type = blob.type || "image/jpeg";
              const file = new File([blob], filename, { type });
              formData.append("files", file);
            }),
          );
        } else {
          // Native: RN fetch understands {uri, name, type}
          imageUris.forEach((uri, i) => {
            const filename = uri.split("/").pop();
            const match = /\.(\w+)$/.exec(filename || "");
            formData.append("files", {
              uri,
              name: filename || `img_${i}.jpg`,
              type: match ? `image/${match[1]}` : "image/jpeg",
            } as any);
          });
        }
      }

      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error(`Server ${response.status}`);
      const result = await response.json();

      if (!result.success) throw new Error(result.error || "No outfits found.");

      const scenario = result.scenario;
      const sourceLabel =
        mode === "wardrobe"
          ? "your wardrobe"
          : mode === "build"
            ? "your wardrobe and Zara"
            : "Zara";

      if (scenario === "IMAGE_UPPER_LOWER") {
        const hasUpper = (result.upper_outfits?.length ?? 0) > 0;
        const hasLower = (result.lower_outfits?.length ?? 0) > 0;
        const hasFallback = (result.outfits?.length ?? 0) > 0;

        if (!hasUpper && !hasLower && !hasFallback) {
          throw new Error("No matching outfits found.");
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId
              ? {
                  ...m,
                  isTyping: false,
                  content: `Here are styled recommendations from ${sourceLabel} for your look.`,
                  outfitCard: true,
                  outfitData: {
                    scenario,
                    upper_outfits: result.upper_outfits ?? [],
                    lower_outfits: result.lower_outfits ?? [],
                    outfits: result.outfits ?? [],
                    upper_intent: result.upper_intent ?? {},
                    lower_intent: result.lower_intent ?? {},
                  },
                }
              : m,
          ),
        );
      } else {
        // PROMPT_ONLY
        if (!result.outfits?.length) throw new Error("No outfits found.");
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId
              ? {
                  ...m,
                  isTyping: false,
                  content: `I've curated looks from ${sourceLabel} that match your style.`,
                  outfitCard: true,
                  outfitData: {
                    scenario,
                    outfits: result.outfits ?? [],
                    upper_outfits: [],
                    lower_outfits: [],
                    upper_intent: {},
                    lower_intent: {},
                  },
                }
              : m,
          ),
        );
      }

      setSelectedImages([]);
      setInput("");
      setShowModeCards(false);
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
    // ✅ IMPORTANT: Only use input if user actually typed something
    // Don't add default prompt if user uploaded image only
    const prompt = input || "";
    const images = selectedImages.length > 0 ? selectedImages : undefined;
    setInput("");
    setSelectedImages([]);
    setShowModeCards(false);
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
            {!showModeCards ? (
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
function SplitPanelCard({
  outfitWrap,
  rank,
  mode = "standard",
}: {
  outfitWrap: any;
  rank: number;
  mode?: "standard" | "upper" | "lower";
}) {
  if (!outfitWrap?.outfit) return null;

  const { outfit, score, reasons } = outfitWrap;
  const { top, bottom, shoes, outerwear, accessory } = outfit;

  const isBest = rank === 1;
  const scoreInt = score !== undefined ? Math.round(score * 100) : null;
  const rankLabel = RANK_LABELS[rank - 1] ?? `Look ${rank}`;

  let leftSlot: any;
  let leftLabel: string;
  let rightSlot: any;
  let rightLabel: string;
  let altSlot: any | null = null;
  let altLabel = "";

  if (mode === "upper") {
    // uploaded top/shirt/tshirt => main: other segments, alt: best top alternative
    leftSlot = bottom;
    leftLabel = "BOTTOM";
    rightSlot = shoes;
    rightLabel = "SHOES";
    altSlot = top;
    altLabel = "BEST ALT TOP";
  } else if (mode === "lower") {
    // uploaded lower => main: other segments, alt: best lower alternative
    leftSlot = outerwear || top;
    leftLabel = outerwear ? "OUTERWEAR" : "TOP";
    rightSlot = shoes;
    rightLabel = "SHOES";
    altSlot = bottom;
    altLabel = "BEST ALT BOTTOM";
  } else {
    leftSlot = outerwear || top;
    leftLabel = outerwear ? "OUTERWEAR" : "TOP";
    rightSlot = bottom;
    rightLabel = "BOTTOM";
  }

  let row2Left: any;
  let row2LeftLabel: string;
  let row2Right: any;
  let row2RightLabel: string;

  if (mode === "standard") {
    row2Left = accessory;
    row2LeftLabel = "ACCESSORY";
    row2Right = shoes;
    row2RightLabel = "SHOES";
  } else {
    row2Left = accessory;
    row2LeftLabel = "ACCESSORY";
    row2Right = altSlot;
    row2RightLabel = altLabel;
  }

  const hasRow2 = row2Left || row2Right;

  const footerItems: { cat: string; name: string }[] = [];
  if (leftSlot?.attributes?.style_category || leftSlot?.category) {
    footerItems.push({
      cat: leftLabel,
      name: leftSlot?.attributes?.style_category ?? leftSlot?.category ?? leftLabel,
    });
  }
  if (rightSlot?.attributes?.style_category || rightSlot?.category) {
    footerItems.push({
      cat: rightLabel,
      name: rightSlot?.attributes?.style_category ?? rightSlot?.category ?? rightLabel,
    });
  }
  if (accessory && mode !== "standard") {
    footerItems.push({
      cat: "ACCESSORY",
      name: accessory?.attributes?.style_category ?? accessory?.category ?? "Accessory",
    });
  }
  if (altSlot) {
    footerItems.push({
      cat: altLabel,
      name: altSlot?.attributes?.style_category ?? altSlot?.category ?? altLabel,
    });
  }

  return (
    <View style={[OC.card, isBest && OC.cardBest]}>
      <View style={OC.panels}>
        <View style={OC.panelLeft}>
          {leftSlot?.image_path ? (
            <Image
              source={{ uri: leftSlot.image_path }}
              style={OC.panelImg}
              resizeMode="contain"
            />
          ) : (
            <Text style={OC.panelEmoji}>
              {leftLabel === "BOTTOM" ? "👖" : leftLabel === "SHOES" ? "👟" : "👕"}
            </Text>
          )}
          <View style={OC.panelLabel}>
            <Text style={OC.panelLabelTxt}>{leftLabel}</Text>
          </View>
        </View>

        <View style={OC.divider} />

        <View style={OC.panelRight}>
          {rightSlot?.image_path ? (
            <Image
              source={{ uri: rightSlot.image_path }}
              style={OC.panelImg}
              resizeMode="contain"
            />
          ) : (
            <Text style={OC.panelEmoji}>
              {rightLabel === "SHOES" ? "👟" : rightLabel === "BOTTOM" ? "👖" : "👕"}
            </Text>
          )}
          <View style={OC.panelLabel}>
            <Text style={OC.panelLabelTxt}>{rightLabel}</Text>
          </View>
        </View>

        <View style={[OC.rankBadge, isBest && OC.rankBadgeBest]}>
          <Text style={[OC.rankTxt, isBest && OC.rankTxtBest]}>{rankLabel}</Text>
        </View>

        {scoreInt !== null && (
          <View style={[OC.scoreBadge, isBest && OC.scoreBadgeBest]}>
            <Text style={[OC.scoreNum, isBest && OC.scoreNumBest]}>{scoreInt}</Text>
            <Text style={[OC.scorePts, isBest && OC.scorePtsBest]}>pts</Text>
          </View>
        )}
      </View>

      {hasRow2 && (
        <View style={OC.panels2}>
          <View style={OC.panel2Cell}>
            {row2Left?.image_path ? (
              <Image
                source={{ uri: row2Left.image_path }}
                style={OC.panelImg2}
                resizeMode="contain"
              />
            ) : row2Left ? (
              <Text style={OC.panelEmoji}>👜</Text>
            ) : (
              <View style={OC.panelEmpty} />
            )}
            <View style={OC.panelLabel}>
              <Text style={OC.panelLabelTxt}>{row2LeftLabel}</Text>
            </View>
          </View>

          <View style={OC.divider} />

          <View style={[OC.panel2Cell, OC.panel2CellRight]}>
            {row2Right?.image_path ? (
              <Image
                source={{ uri: row2Right.image_path }}
                style={OC.panelImg2}
                resizeMode="contain"
              />
            ) : row2Right ? (
              <Text style={OC.panelEmoji}>
                {row2RightLabel.startsWith("BEST ALT") ? "🔄" : "👟"}
              </Text>
            ) : (
              <View style={OC.panelEmpty} />
            )}
            <View style={OC.panelLabel}>
              <Text style={OC.panelLabelTxt}>{row2RightLabel}</Text>
            </View>
          </View>
        </View>
      )}

      <View style={OC.footer}>
        <View style={OC.names}>
          {footerItems.map((fi, i) => (
            <View key={i} style={OC.nameRow}>
              <Text style={OC.nameCat}>{fi.cat}</Text>
              <Text style={OC.nameVal} numberOfLines={1}>
                {fi.name}
              </Text>
            </View>
          ))}
        </View>

        {(reasons?.length ?? 0) > 0 && (
          <View style={OC.chips}>
            {(reasons as string[]).slice(0, 3).map((r, i) => (
              <View key={i} style={OC.chip}>
                <Text style={OC.chipTxt}>{r}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

function OutfitCard({ data }: { data: any }) {
  if (!data) return null;

  const { scenario, outfits, upper_outfits, lower_outfits } = data;

  if (scenario === "PROMPT_ONLY") {
    const list: any[] = (outfits ?? []).slice(0, 3);
    if (list.length === 0) return null;

    return (
      <View style={OC.resultSection}>
        <View style={OC.sectionHdr}>
          <Text style={OC.sectionTitle}>Curated Looks</Text>
          <Text style={OC.sectionSub}>
            {list.length} outfit{list.length !== 1 ? "s" : ""}
          </Text>
        </View>
        <View style={{ gap: 16 }}>
          {list.map((o, i) => (
            <SplitPanelCard key={i} outfitWrap={o} rank={i + 1} mode="standard" />
          ))}
        </View>
      </View>
    );
  }

  const upperList: any[] = (upper_outfits ?? []).slice(0, 2);
  const lowerList: any[] = (lower_outfits ?? []).slice(0, 2);
  const fallbackList: any[] = (outfits ?? []).slice(0, 2);

  if (
    upperList.length === 0 &&
    lowerList.length === 0 &&
    fallbackList.length === 0
  ) {
    return null;
  }

  if (upperList.length === 0 && lowerList.length === 0) {
    return (
      <View style={OC.resultSection}>
        <View style={OC.sectionHdr}>
          <Text style={OC.sectionTitle}>Curated Looks</Text>
          <Text style={OC.sectionSub}>
            {fallbackList.length} outfit{fallbackList.length !== 1 ? "s" : ""}
          </Text>
        </View>
        <View style={{ gap: 16 }}>
          {fallbackList.map((o, i) => (
            <SplitPanelCard key={i} outfitWrap={o} rank={i + 1} mode="standard" />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={OC.resultSection}>
      {upperList.length > 0 && (
        <View>
          <View style={OC.sectionHdr}>
            <Text style={OC.sectionTitle}>Styled Around Your Top</Text>
            <Text style={OC.sectionSub}>
              {upperList.length} look{upperList.length !== 1 ? "s" : ""}
            </Text>
          </View>
          <Text style={OC.sectionHint}>
            Main panels show other segments · BEST ALT TOP shows the best shirt/t-shirt alternative
          </Text>
          <View style={{ gap: 16 }}>
            {upperList.map((o, i) => (
              <SplitPanelCard
                key={`upper_${i}`}
                outfitWrap={o}
                rank={i + 1}
                mode="upper"
              />
            ))}
          </View>
        </View>
      )}

      {upperList.length > 0 && lowerList.length > 0 && <View style={OC.bigDivider} />}

      {lowerList.length > 0 && (
        <View>
          <View style={OC.sectionHdr}>
            <Text style={OC.sectionTitle}>Styled Around Your Bottom</Text>
            <Text style={OC.sectionSub}>
              {lowerList.length} look{lowerList.length !== 1 ? "s" : ""}
            </Text>
          </View>
          <Text style={OC.sectionHint}>
            Main panels show other segments · BEST ALT BOTTOM shows the best lower alternative
          </Text>
          <View style={{ gap: 16 }}>
            {lowerList.map((o, i) => (
              <SplitPanelCard
                key={`lower_${i}`}
                outfitWrap={o}
                rank={i + 1}
                mode="lower"
              />
            ))}
          </View>
        </View>
      )}
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
    boxShadow: "0px 10px 20px rgba(0,0,0,0.4)",
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
    boxShadow: `0px 0px 8px ${C.primary}4D`,
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
    boxShadow: `0px 0px 8px ${C.primary}26`,
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
  resultSection: { gap: 16 },
  sectionHdr: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 4,
  },
  sectionTitle: {
    color: C.onSurface,
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  sectionSub: { color: "rgba(229,225,228,0.4)", fontSize: 11 },
  sectionHint: {
    color: "rgba(229,225,228,0.4)",
    fontSize: 10,
    lineHeight: 14,
    marginBottom: 12,
    fontStyle: "italic",
  },
  bigDivider: {
    height: 1,
    backgroundColor: "rgba(71,70,74,0.3)",
    marginVertical: 20,
  },

  card: {
    width: CARD_W,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: C.surfaceContainerLow,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    elevation: 6,
  },
  cardBest: { borderColor: `${C.primary}60` },

  panels: {
    flexDirection: "row",
    height: PANEL_H,
    backgroundColor: "#F1EDE7",
    position: "relative",
    overflow: "hidden",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#C8BFB5",
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
  panelImg: { width: HALF_W, height: PANEL_H - 28 },
  panelEmoji: { fontSize: 56, textAlign: "center" },
  panelLabel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
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
  panelEmpty: { flex: 1 },

  divider: {
    width: StyleSheet.hairlineWidth,
    height: "100%" as any,
    backgroundColor: "#C8BFB5",
  },

  panels2: {
    flexDirection: "row",
    height: PANEL_H2,
    backgroundColor: "#F1EDE7",
    overflow: "hidden",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#C8BFB5",
  },
  panel2Cell: {
    width: HALF_W,
    height: PANEL_H2,
    backgroundColor: "#EDE8E2",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  panel2CellRight: { backgroundColor: "#E8E3DC" },
  panelImg2: { width: HALF_W, height: PANEL_H2 - 26 },

  rankBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: "rgba(20,20,20,0.78)",
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  rankBadgeBest: { backgroundColor: C.primary, borderColor: "transparent" },
  rankTxt: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  rankTxtBest: { color: C.surfaceContainerLowest },

  scoreBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "rgba(20,20,20,0.78)",
    borderRadius: 14,
    paddingHorizontal: 11,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "baseline",
    gap: 2,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  scoreBadgeBest: { backgroundColor: C.primary, borderColor: "transparent" },
  scoreNum: { color: C.onSurface, fontSize: 17, fontWeight: "800" },
  scoreNumBest: { color: C.surfaceContainerLowest },
  scorePts: {
    color: "rgba(229,225,228,0.4)",
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  scorePtsBest: { color: "rgba(20,20,20,0.7)" },

  footer: {
    backgroundColor: C.surfaceContainerLow,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 12,
  },
  names: { gap: 5, marginBottom: 10 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  nameCat: {
    width: 80,
    fontSize: 9,
    fontWeight: "700",
    color: C.primary,
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  nameVal: { flex: 1, fontSize: 13, fontWeight: "500", color: C.onSurface },

  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    backgroundColor: "rgba(255,182,139,0.15)",
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: "rgba(255,182,139,0.2)",
  },
  chipTxt: { color: C.tertiary, fontSize: 11 },
});
