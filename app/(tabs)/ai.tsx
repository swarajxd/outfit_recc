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

const PRIMARY = "#FF6B00";
const BG = "#0a0908";
const CHARCOAL = "#1a1a1a";
const ACCENT_DARK = "#1f1812";
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
    role: "ai",
    content:
      "Hello! I'm Sense AI, your personal Zara Stylist. ✦\n\nI can help you find the perfect outfit from our curated Zara collection. You can type what you're looking for, or even upload a photo of a piece you love and I'll build a whole look around it!",
    time: "Just now",
  },
];

const QUICK_CHIPS = [
  { icon: "👗", label: "Zara Party Look" },
  { icon: "👔", label: "Smart Casual" },
  { icon: "✨", label: "Summer Chic" },
];

export default function AIScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // Get user avatar - prefer Cloudinary URL from metadata, fallback to Clerk imageUrl
  const userAvatar =
    (user?.unsafeMetadata as { profileImageUrl?: string })?.profileImageUrl ||
    user?.imageUrl ||
    DEFAULT_AVATAR;

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      const newUris = result.assets.map((a) => a.uri);
      setSelectedImages((prev) => [...prev, ...newUris]);
    }
  };

  const sendMessage = async (text: string, imageUris?: string[]) => {
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
        content: text,
        time,
        imageUris,
      },
    ]);
    setInput("");
    setSelectedImages([]);
    setIsUploading(true);

    // AI "Typing" indicator
    const aiMsgId = (Date.now() + 1).toString();
    setMessages((prev) => [
      ...prev,
      { id: aiMsgId, role: "ai", content: "", time, isTyping: true },
    ]);

    try {
      const formData = new FormData();
      formData.append("user_id", user?.id || "anonymous");
      if (text) formData.append("query", text);

      if (imageUris && imageUris.length > 0) {
        imageUris.forEach((uri, index) => {
          const filename = uri.split("/").pop();
          const match = /\.(\w+)$/.exec(filename || "");
          const type = match ? `image/${match[1]}` : `image`;
          formData.append("files", {
            uri: uri,
            name: filename || `image_${index}.jpg`,
            type,
          } as any);
        });
      }

      console.log(
        "[AI] Sending request to:",
        `${SERVER_BASE}/api/recommend-zara`,
      );
      const response = await fetch(`${SERVER_BASE}/api/recommend-zara`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[AI] Server error:", response.status, errorText);
        throw new Error(`Server responded with ${response.status}`);
      }

      const result = await response.json();
      console.log("[AI] Received result:", result.success);

      if (result.success && result.outfits?.length > 0) {
        const best = result.outfits[0];
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId
              ? {
                  ...m,
                  isTyping: false,
                  content: `I've found some amazing pieces from Zara that perfectly match your style! Here's a curated look featuring ${best.reasons.length > 0 ? best.reasons[0].toLowerCase() : "the perfect blend of items"}.`,
                  outfitCard: true,
                  outfitData: best,
                }
              : m,
          ),
        );
      } else {
        throw new Error(result.error || "No matching outfits found.");
      }
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsgId
            ? {
                ...m,
                isTyping: false,
                content: `I'm sorry, I couldn't find a matching outfit from the Zara dataset right now. ${err.message}`,
              }
            : m,
        ),
      );
    } finally {
      setIsUploading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn}>
          <Text style={{ color: "#fff", fontSize: 18 }}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.aiStatus}>
            <View style={styles.pulseDot} />
            <Text style={styles.aiName}>Sense AI</Text>
          </View>
          <Text style={styles.aiSubtitle}>ZARA STYLIST</Text>
        </View>
        <TouchableOpacity style={styles.headerBtn}>
          <Text style={{ color: "#fff", fontSize: 20 }}>⋮</Text>
        </TouchableOpacity>
      </View>

      {/* Chat Messages */}
      <ScrollView
        ref={scrollRef}
        style={styles.chatArea}
        contentContainerStyle={{
          paddingVertical: 20,
          gap: 20,
          paddingBottom: 12,
        }}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() =>
          scrollRef.current?.scrollToEnd({ animated: false })
        }
      >
        {messages.map((msg) => (
          <View key={msg.id}>
            {msg.role === "ai" ? (
              <View style={styles.aiBubbleWrapper}>
                <View style={styles.aiBubbleMeta}>
                  <View style={styles.aiAvatar}>
                    <Text style={{ color: BG, fontSize: 12 }}>✦</Text>
                  </View>
                  <Text style={styles.msgTime}>Sense AI · {msg.time}</Text>
                </View>
                <View style={styles.aiBubble}>
                  {msg.isTyping ? (
                    <ActivityIndicator size="small" color={PRIMARY} />
                  ) : (
                    <Text style={styles.aiBubbleText}>{msg.content}</Text>
                  )}
                </View>
                {msg.outfitCard && msg.outfitData && (
                  <OutfitCard data={msg.outfitData} />
                )}
              </View>
            ) : (
              <View style={styles.userBubbleWrapper}>
                <View style={styles.userBubbleMeta}>
                  <Text style={styles.msgTime}>You · {msg.time}</Text>
                  <Image
                    source={{
                      uri: userAvatar,
                    }}
                    style={styles.userAvatarSmall}
                  />
                </View>
                <View style={styles.userBubble}>
                  {msg.imageUris && msg.imageUris.length > 0 && (
                    <View style={styles.userMsgImageContainer}>
                      {msg.imageUris.map((uri, i) => (
                        <Image
                          key={i}
                          source={{ uri }}
                          style={styles.userMsgImage}
                        />
                      ))}
                    </View>
                  )}
                  {msg.content ? (
                    <Text style={styles.userBubbleText}>{msg.content}</Text>
                  ) : null}
                </View>
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      {/* Bottom Input Area */}
      <View style={[styles.bottomArea, { paddingBottom: insets.bottom || 16 }]}>
        {/* Selected Image Preview */}
        {selectedImages.length > 0 && (
          <ScrollView
            horizontal
            style={styles.imagePreviewList}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
            showsHorizontalScrollIndicator={false}
          >
            {selectedImages.map((uri, index) => (
              <View key={index} style={styles.imagePreviewContainer}>
                <Image source={{ uri }} style={styles.imagePreview} />
                <TouchableOpacity
                  style={styles.removeImageBtn}
                  onPress={() =>
                    setSelectedImages((prev) =>
                      prev.filter((_, i) => i !== index),
                    )
                  }
                >
                  <Text
                    style={{ color: "#fff", fontWeight: "bold", fontSize: 10 }}
                  >
                    ✕
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Quick Chips */}
        {selectedImages.length === 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            {QUICK_CHIPS.map((chip) => (
              <TouchableOpacity
                key={chip.label}
                style={styles.chip}
                onPress={() => sendMessage(chip.label)}
              >
                <Text style={styles.chipIcon}>{chip.icon}</Text>
                <Text style={styles.chipText}>{chip.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Input Row */}
        <View style={styles.inputRow}>
          <View style={styles.inputContainer}>
            <TouchableOpacity style={styles.inputIconBtn} onPress={pickImage}>
              <Text
                style={{
                  color:
                    selectedImages.length > 0
                      ? PRIMARY
                      : "rgba(255,255,255,0.4)",
                  fontSize: 20,
                }}
              >
                ⊕
              </Text>
            </TouchableOpacity>
            <TextInput
              style={styles.textInput}
              placeholder="Message Sense AI..."
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={input}
              onChangeText={setInput}
              onSubmitEditing={() =>
                sendMessage(
                  input,
                  selectedImages.length > 0 ? selectedImages : undefined,
                )
              }
              multiline
            />
            <TouchableOpacity style={styles.inputIconBtn}>
              <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 18 }}>
                🎙️
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.sendBtn}
            onPress={() =>
              sendMessage(
                input,
                selectedImages.length > 0 ? selectedImages : undefined,
              )
            }
            disabled={isUploading}
          >
            {isUploading ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Text style={{ color: "#000", fontSize: 18, fontWeight: "800" }}>
                ↑
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function OutfitCard({ data }: { data: any }) {
  if (!data || !data.outfit) return null;
  const outfit = data.outfit;

  const top = outfit.top;
  const bottom = outfit.bottom;
  const shoes = outfit.shoes;
  const outer = outfit.outerwear;
  const acc = outfit.accessory;

  const renderItemImage = (item: any, style: any, isMain: boolean = false) => {
    if (!item) return null;
    const isUserUpload = item.item_id?.toString().startsWith("user_upload_");
    return (
      <View style={[style, isUserUpload ? styles.userItemBorder : null]}>
        <Image
          source={{ uri: item.image_path }}
          style={isMain ? styles.mainImage : styles.miniImage}
          resizeMode="cover"
        />
        {isUserUpload && (
          <View style={styles.userPieceBadge}>
            <Text style={styles.userPieceText}>LOCKED</Text>
          </View>
        )}
      </View>
    );
  };

  // Logic to determine what to show in the main 'Vibe' grid
  // We want to prioritize showing the user's locked pieces if they exist.
  const mainPiece1 = outer || top;
  const mainPiece2 = bottom;

  return (
    <View style={styles.outfitCard}>
      <View style={styles.collageContainer}>
        {/* Left Side: The "Vibe" / Main Pieces */}
        <View style={styles.mainOutfitSection}>
          <View style={styles.lookGrid}>
            <View style={styles.lookColumn}>
              {renderItemImage(mainPiece1, styles.mainItemLarge, true)}
            </View>
            {mainPiece2 && (
              <View style={styles.lookColumn}>
                {renderItemImage(mainPiece2, styles.mainItemLarge, true)}
              </View>
            )}
          </View>
        </View>

        {/* Right Side: Details & Accessories */}
        <View style={styles.outfitDetailsSection}>
          <View style={styles.detailsHeader}>
            <Text style={styles.outfitTitle}>Sense Selection</Text>
            <View style={styles.matchBadge}>
              <Text style={styles.matchBadgeText}>
                {Math.round(data.score * 100)}% Match
              </Text>
            </View>
          </View>

          <View style={styles.miniItemsGrid}>
            {shoes && (
              <View style={styles.miniItemBox}>
                {renderItemImage(shoes, styles.miniItemImageWrap)}
                <Text style={styles.miniLabel}>Shoes</Text>
              </View>
            )}
            {acc && (
              <View style={styles.miniItemBox}>
                {renderItemImage(acc, styles.miniItemImageWrap)}
                <Text style={styles.miniLabel}>Accessory</Text>
              </View>
            )}
          </View>

          <TouchableOpacity style={styles.viewDetailsBtn}>
            <Text style={styles.viewDetailsText}>Get the Look ✓</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: `${PRIMARY}1a`,
    backgroundColor: "rgba(10,9,8,0.9)",
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: { alignItems: "center" },
  aiStatus: { flexDirection: "row", alignItems: "center", gap: 6 },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: PRIMARY,
    shadowColor: PRIMARY,
    shadowRadius: 4,
    shadowOpacity: 0.8,
  },
  aiName: { color: "#fff", fontSize: 17, fontWeight: "800" },
  aiSubtitle: {
    color: PRIMARY,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginTop: 2,
  },
  chatArea: { flex: 1, paddingHorizontal: 16 },
  aiBubbleWrapper: { maxWidth: "85%", gap: 6 },
  aiBubbleMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  aiAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
  },
  msgTime: { color: "rgba(255,255,255,0.35)", fontSize: 11, fontWeight: "500" },
  aiBubble: {
    backgroundColor: CHARCOAL,
    borderRadius: 18,
    borderTopLeftRadius: 4,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  aiBubbleText: { color: "#e8e8e8", fontSize: 14, lineHeight: 22 },
  userBubbleWrapper: { maxWidth: "85%", alignSelf: "flex-end", gap: 6 },
  userBubbleMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
    justifyContent: "flex-end",
  },
  userAvatarSmall: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${PRIMARY}55`,
  },
  userBubble: {
    backgroundColor: PRIMARY,
    borderRadius: 18,
    borderTopRightRadius: 4,
    padding: 14,
    shadowColor: PRIMARY,
    shadowRadius: 4,
    shadowOpacity: 0.2,
  },
  userMsgImageContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
    maxWidth: 220,
  },
  userMsgImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  userBubbleText: {
    color: "#000",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "600",
  },
  outfitCard: {
    backgroundColor: CHARCOAL,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    marginTop: 12,
    width: "100%",
  },
  collageContainer: {
    flexDirection: "row",
    height: 280,
  },
  mainOutfitSection: {
    flex: 1.4,
    backgroundColor: "#121212",
    padding: 6,
  },
  lookGrid: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
  },
  lookColumn: {
    flex: 1,
    gap: 6,
  },
  mainItemLarge: {
    flex: 1,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#1a1a1a",
  },
  mainImage: {
    width: "100%",
    height: "100%",
  },
  userItemBorder: {
    borderWidth: 2,
    borderColor: PRIMARY,
  },
  userPieceBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: PRIMARY,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    zIndex: 10,
  },
  userPieceText: {
    color: "#000",
    fontSize: 8,
    fontWeight: "900",
  },
  outfitDetailsSection: {
    flex: 1,
    padding: 16,
    justifyContent: "space-between",
    backgroundColor: CHARCOAL,
  },
  detailsHeader: {
    gap: 6,
  },
  outfitTitle: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  miniItemsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginVertical: 10,
  },
  miniItemBox: {
    alignItems: "center",
    gap: 4,
  },
  miniItemImageWrap: {
    width: 48,
    height: 60,
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  miniImage: {
    width: "100%",
    height: "100%",
  },
  miniLabel: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 8,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  viewDetailsBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    shadowColor: PRIMARY,
    shadowRadius: 8,
    shadowOpacity: 0.3,
  },
  viewDetailsText: {
    color: "#000",
    fontSize: 13,
    fontWeight: "800",
  },
  outfitImageBg: { height: 180, position: "relative" },
  outfitImage: { width: "100%", height: "100%", resizeMode: "cover" },
  outfitOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  outfitLabel: {
    position: "absolute",
    bottom: 12,
    left: 12,
    right: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  outfitSub: { color: "rgba(255,255,255,0.65)", fontSize: 12, marginTop: 2 },
  matchBadge: {
    backgroundColor: `${PRIMARY}33`,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: `${PRIMARY}55`,
  },
  matchBadgeText: {
    color: PRIMARY,
    fontSize: 9,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  outfitItems: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
  },
  outfitItemImage: {
    width: 60,
    height: 80,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  outfitItemWrapper: {
    alignItems: "center",
    gap: 4,
  },
  itemCategory: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  wearBtn: {
    margin: 12,
    marginTop: 0,
    backgroundColor: PRIMARY,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: "center",
  },
  wearBtnText: { color: "#000", fontSize: 15, fontWeight: "800" },
  bottomArea: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    paddingTop: 10,
    paddingHorizontal: 16,
    backgroundColor: "rgba(10,9,8,0.98)",
  },
  imagePreviewList: {
    maxHeight: 80,
    marginBottom: 10,
  },
  imagePreviewContainer: {
    position: "relative",
    width: 60,
    height: 60,
  },
  imagePreview: {
    width: 60,
    height: 60,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  removeImageBtn: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: "rgba(0,0,0,0.8)",
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  chipsRow: { gap: 8, paddingBottom: 10 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: CHARCOAL,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  chipIcon: { fontSize: 13 },
  chipText: { color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: "600" },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  inputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: CHARCOAL,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  inputIconBtn: { padding: 8 },
  textInput: {
    flex: 1,
    color: "#fff",
    fontSize: 14,
    paddingVertical: 8,
    maxHeight: 100,
  },
  sendBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: PRIMARY,
    shadowRadius: 10,
    shadowOpacity: 0.4,
  },
});
