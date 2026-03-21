import { useUser } from "@clerk/clerk-expo";
import React, { useRef, useState } from "react";
import {
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
};

const INITIAL_MESSAGES: Message[] = [
  {
    id: "1",
    role: "ai",
    content:
      "Good morning! 🌤️ It's a crisp 62°F today. Based on your calendar, I've curated a look that blends professional with effortless urban style. How does this feel for today?",
    time: "09:41 AM",
    outfitCard: true,
  },
  {
    id: "2",
    role: "user",
    content:
      "I love the jacket, but can we try different boots? Maybe something more rugged?",
    time: "09:43 AM",
  },
  {
    id: "3",
    role: "ai",
    content:
      "Absolutely! I found 3 rugged boot options in your wardrobe that pair seamlessly with the jacket. Here are my top picks 👇",
    time: "09:44 AM",
  },
];

const QUICK_CHIPS = [
  { icon: "✨", label: "Style these boots" },
  { icon: "🌤️", label: "Today's forecast" },
  { icon: "📦", label: "New arrivals" },
];

export default function AIScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const scrollRef = useRef<ScrollView>(null);

  // Get user avatar - prefer Cloudinary URL from metadata, fallback to Clerk imageUrl
  const userAvatar =
    (user?.unsafeMetadata as { profileImageUrl?: string })?.profileImageUrl ||
    user?.imageUrl ||
    DEFAULT_AVATAR;

  const sendMessage = (text: string) => {
    if (!text.trim()) return;
    const now = new Date();
    const time = now.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });

    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), role: "user", content: text, time },
    ]);
    setInput("");

    // Simulate AI response
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "ai",
          content:
            "Great choice! Let me analyze your wardrobe and put together the perfect outfit for you. ✦",
          time: new Date().toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 800);

    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
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
          <Text style={styles.aiSubtitle}>ONLINE STYLIST</Text>
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
                  <Text style={styles.aiBubbleText}>{msg.content}</Text>
                </View>
                {msg.outfitCard && <OutfitCard />}
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
                  <Text style={styles.userBubbleText}>{msg.content}</Text>
                </View>
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      {/* Bottom Input Area */}
      <View style={[styles.bottomArea, { paddingBottom: insets.bottom || 16 }]}>
        {/* Quick Chips */}
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

        {/* Input Row */}
        <View style={styles.inputRow}>
          <View style={styles.inputContainer}>
            <TouchableOpacity style={styles.inputIconBtn}>
              <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 20 }}>
                ⊕
              </Text>
            </TouchableOpacity>
            <TextInput
              style={styles.textInput}
              placeholder="Message Sense AI..."
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={input}
              onChangeText={setInput}
              onSubmitEditing={() => sendMessage(input)}
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
            onPress={() => sendMessage(input)}
          >
            <Text style={{ color: "#000", fontSize: 18, fontWeight: "800" }}>
              ↑
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function OutfitCard() {
  return (
    <View style={styles.outfitCard}>
      <View style={styles.outfitImageBg}>
        <Image
          source={{
            uri: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=600&q=80",
          }}
          style={styles.outfitImage}
        />
        <View style={styles.outfitOverlay} />
        <View style={styles.outfitLabel}>
          <View>
            <Text style={styles.outfitTitle}>Modern Urbanite</Text>
            <Text style={styles.outfitSub}>3 items from your wardrobe</Text>
          </View>
          <View style={styles.matchBadge}>
            <Text style={styles.matchBadgeText}>Match Found</Text>
          </View>
        </View>
      </View>
      <View style={styles.outfitItems}>
        {[
          "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=200&q=80",
          "https://images.unsplash.com/photo-1562157873-818bc0726f68?w=200&q=80",
          "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200&q=80",
        ].map((uri, i) => (
          <Image key={i} source={{ uri }} style={styles.outfitItemImage} />
        ))}
      </View>
      <TouchableOpacity style={styles.wearBtn}>
        <Text style={styles.wearBtnText}>Wear This ✓</Text>
      </TouchableOpacity>
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
    backgroundColor: BG,
    borderRadius: 18,
    borderTopRightRadius: 4,
    padding: 14,
    borderWidth: 1,
    borderColor: `${PRIMARY}66`,
  },
  userBubbleText: { color: "#e8e8e8", fontSize: 14, lineHeight: 22 },
  outfitCard: {
    backgroundColor: CHARCOAL,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    marginTop: 8,
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
  outfitTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },
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
    flex: 1,
    aspectRatio: 1,
    borderRadius: 10,
    backgroundColor: "#222",
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
