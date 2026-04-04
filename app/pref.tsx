// app/pref.tsx
import { useUser } from "@clerk/clerk-expo";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  ImageBackground,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import "../assets/pref/streetwear.png";

const { width: W, height: H } = Dimensions.get("window");
const ORANGE = "#E8620A";
const ORANGE_DIM = "rgba(232,98,10,0.15)";
const ORANGE_GLOW = "rgba(232,98,10,0.35)";

const C = {
  bg: "#080808",
  bg2: "#111111",
  surface: "#161616",
  border: "#242424",
  borderSelected: ORANGE,
  text: "#FFFFFF",
  textMuted: "#666666",
  textSub: "#999999",
  accent: ORANGE,
};

interface Profile {
  gender: string | null;
  styles: string[];
  favoriteColors: string[];
  dislikedColors: string[];
  fit: string | null;
  bodyType: string | null;
  skinTone: string | null;
  height: string | null;
  budget: string | null;
  avoidItems: string[];
  occasions: string[];
  goals: string[];
}

const defaultProfile: Profile = {
  gender: null,
  styles: [],
  favoriteColors: [],
  dislikedColors: [],
  fit: null,
  bodyType: null,
  skinTone: null,
  height: null,
  budget: null,
  avoidItems: [],
  occasions: [],
  goals: [],
};

const ProfileCtx = createContext<{
  profile: Profile;
  set: (key: keyof Profile, val: any) => void;
}>({ profile: defaultProfile, set: () => {} });

function useEntryAnim(delay = 0) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 300,
      delay,
      useNativeDriver: true,
    }).start();
  }, []);
  return anim;
}

function useFloatAnim(distance = 8, duration = 2800) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration, useNativeDriver: true }),
      ]),
    ).start();
  }, []);
  return anim.interpolate({ inputRange: [0, 1], outputRange: [0, -distance] });
}

// Smooth press: quick timing down, gentle spring up
function useSpringBounce() {
  const scale = useRef(new Animated.Value(1)).current;
  const bounce = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.96, duration: 80, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
    ]).start();
  };
  return { scale, bounce };
}

function Shell({
  step, total, onBack, onSkip, onContinue, canContinue, children, hideProgress = false,
}: {
  step: number; total: number; onBack: () => void; onSkip: () => void;
  onContinue: () => void; canContinue: boolean; children: React.ReactNode; hideProgress?: boolean;
}) {
  const progressAnim = useRef(new Animated.Value(0)).current;
  const continueScale = useRef(new Animated.Value(canContinue ? 1 : 0.96)).current;
  const continueOpacity = useRef(new Animated.Value(canContinue ? 1 : 0.4)).current;
  const headerAnim = useEntryAnim(0);

  useEffect(() => {
    Animated.timing(progressAnim, { toValue: step / total, duration: 500, useNativeDriver: false }).start();
  }, [step]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(continueScale, { toValue: canContinue ? 1 : 0.96, duration: 200, useNativeDriver: true }),
      Animated.timing(continueOpacity, { toValue: canContinue ? 1 : 0.4, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [canContinue]);

  const blob1Y = useFloatAnim(10, 3500);
  const blob2Y = useFloatAnim(14, 4200);

  return (
    <View style={ss.shell}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={["#080808", "#0D0D0D", "#080808"]} style={StyleSheet.absoluteFill} />
      <Animated.View style={[ss.blob1, { transform: [{ translateY: blob1Y }] }]}>
        <LinearGradient colors={["rgba(232,98,10,0.22)", "transparent"]} style={{ width: 300, height: 300, borderRadius: 150 }} />
      </Animated.View>
      <Animated.View style={[ss.blob2, { transform: [{ translateY: blob2Y }] }]}>
        <LinearGradient colors={["rgba(200,70,10,0.14)", "transparent"]} style={{ width: 220, height: 220, borderRadius: 110 }} />
      </Animated.View>
      <SafeAreaView style={ss.safeArea}>
        <Animated.View style={[ss.header, { opacity: headerAnim, transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }] }]}>
          <TouchableOpacity onPress={onBack} style={ss.iconBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="arrow-back" size={22} color="#FFF" />
          </TouchableOpacity>
          <Text style={ss.headerTitle}>Sense AI</Text>
          <TouchableOpacity onPress={onSkip} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={ss.skipBtn}>SKIP</Text>
          </TouchableOpacity>
        </Animated.View>
        {!hideProgress && (
          <View style={ss.progressSection}>
            <View style={ss.progressLabels}>
              <Text style={ss.stepLabel}>STEP {String(step).padStart(2, "0")} OF {total}</Text>
              <Text style={ss.pctLabel}>{Math.round((step / total) * 100)}%</Text>
            </View>
            <View style={ss.track}>
              <Animated.View style={[ss.fill, { width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }]}>
                <LinearGradient colors={[ORANGE, "#FF8C42"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
              </Animated.View>
            </View>
          </View>
        )}
        <View style={{ flex: 1 }}>{children}</View>
        <Animated.View style={{ transform: [{ scale: continueScale }], opacity: continueOpacity, marginBottom: 8 }}>
          <TouchableOpacity activeOpacity={0.85} onPress={canContinue ? onContinue : undefined} disabled={!canContinue}>
            <BlurView intensity={25} tint="dark" style={ss.continueBtn}>
              <LinearGradient
                colors={canContinue ? ["rgba(50,50,50,0.95)", "rgba(22,22,22,0.98)"] : ["rgba(28,28,28,0.9)", "rgba(18,18,18,0.9)"]}
                style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              />
              <Text style={ss.continueTxt}>CONTINUE</Text>
              <Ionicons name="arrow-forward" size={15} color="#FFF" style={{ marginLeft: 8 }} />
            </BlurView>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

function WelcomeScreen({ onStart }: { onStart: () => void }) {
  const titleY = useFloatAnim(6, 3000);
  const glowAnim = useRef(new Animated.Value(0)).current;
  const titleAnim = useEntryAnim(200);
  const subAnim = useEntryAnim(400);
  const btnAnim = useEntryAnim(600);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ]),
    ).start();
  }, []);

  const FASHION_WORDS = ["MINIMAL", "LUXURY", "STREET", "ELEGANT", "BOLD", "AESTHETIC"];
  const [wordIdx, setWordIdx] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => { setWordIdx((i) => (i + 1) % FASHION_WORDS.length); }, 1800);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={ss.shell}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={["#050505", "#0F0905", "#080808"]} style={StyleSheet.absoluteFill} />
      <View style={[ss.decorCircle, { top: -100, right: -100, width: 380, height: 380, borderRadius: 190 }]}>
        <LinearGradient colors={["rgba(232,98,10,0.18)", "transparent"]} style={StyleSheet.absoluteFill} />
      </View>
      <View style={[ss.decorCircle, { bottom: 40, left: -80, width: 280, height: 280, borderRadius: 140 }]}>
        <LinearGradient colors={["rgba(180,50,10,0.12)", "transparent"]} style={StyleSheet.absoluteFill} />
      </View>
      <View style={ss.gridOverlay} pointerEvents="none">
        {[...Array(6)].map((_, i) => (<View key={i} style={[ss.gridLine, { top: (H / 6) * i }]} />))}
      </View>
      <SafeAreaView style={[ss.safeArea, { justifyContent: "center", alignItems: "center" }]}>
        <Animated.View style={[ss.logoMark, { opacity: titleAnim }]}>
          <LinearGradient colors={[ORANGE, "#FF6B20"]} style={ss.logoGrad}>
            <Text style={ss.logoTxt}>S</Text>
          </LinearGradient>
        </Animated.View>
        <Animated.View style={{ opacity: titleAnim, transform: [{ translateY: titleAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }, { translateY: titleY }], alignItems: "center", marginTop: 24 }}>
          <Text style={ss.welcomeTitle}>Your Personal</Text>
          <Text style={ss.welcomeTitle}>Fashion AI</Text>
          <View style={ss.accentWordBox}>
            <Text style={ss.accentWord}>{FASHION_WORDS[wordIdx]}</Text>
          </View>
        </Animated.View>
        <Animated.Text style={[ss.welcomeSub, { opacity: subAnim, transform: [{ translateY: subAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }]}>
          Discover your unique style identity.{"\n"}Curated looks crafted just for you.
        </Animated.Text>
        <Animated.View style={{ opacity: btnAnim, transform: [{ scale: btnAnim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }], width: "100%", paddingHorizontal: 24, marginTop: 48 }}>
          <TouchableOpacity activeOpacity={0.88} onPress={onStart}>
            <LinearGradient colors={[ORANGE, "#C54D00"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={ss.startBtn}>
              <Text style={ss.startBtnTxt}>Get Started</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFF" style={{ marginLeft: 10 }} />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
        <Animated.Text style={[ss.termsText, { opacity: subAnim }]}>Free · No credit card required</Animated.Text>
      </SafeAreaView>
    </View>
  );
}

const GENDERS = [
  { id: "masculine", label: "Masculine", icon: "gender-male" },
  { id: "feminine", label: "Feminine", icon: "gender-female" },
  { id: "androgynous", label: "Androgynous", icon: "gender-non-binary" },
  { id: "mixed", label: "Mixed", icon: "gender-male-female" },
  { id: "no_preference", label: "No Preference", icon: "infinity" },
];

function GenderScreen({ step, total, onBack, onSkip, onContinue }: StepProps) {
  const { profile, set } = useContext(ProfileCtx);
  const selected = profile.gender;
  const cardAnims = useRef(GENDERS.map(() => new Animated.Value(0))).current;
  useEffect(() => {
    Animated.stagger(60, cardAnims.map((a) => Animated.timing(a, { toValue: 1, duration: 250, useNativeDriver: true }))).start();
  }, []);
  const selScales = useRef(GENDERS.reduce((acc, g) => { acc[g.id] = new Animated.Value(1); return acc; }, {} as Record<string, Animated.Value>)).current;

  // Smooth: quick press-down then gentle spring up
  const select = (id: string) => {
    set("gender", id);
    Animated.sequence([
      Animated.timing(selScales[id], { toValue: 0.97, duration: 80, useNativeDriver: true }),
      Animated.spring(selScales[id], { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
    ]).start();
  };

  return (
    <Shell step={step} total={total} onBack={onBack} onSkip={onSkip} onContinue={onContinue} canContinue={!!selected}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4 }}>
        <ScreenTitle title={"How do you express\nyour style?"} sub="Select the aesthetic direction that feels most authentic to you." />
        <View style={{ gap: 12 }}>
          {GENDERS.map((g, i) => {
            const isSel = selected === g.id;
            return (
              <Animated.View key={g.id} style={{ opacity: cardAnims[i], transform: [{ translateY: cardAnims[i].interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }, { scale: selScales[g.id] }] }}>
                <TouchableOpacity activeOpacity={0.85} onPress={() => select(g.id)}>
                  <View style={[ss.pillCard, isSel && ss.pillCardSel]}>
                    {isSel && <LinearGradient colors={["rgba(232,98,10,0.10)", "rgba(232,98,10,0.04)"]} style={StyleSheet.absoluteFill} />}
                    <View style={[ss.pillIcon, isSel && ss.pillIconSel]}>
                      <MaterialCommunityIcons name={g.icon as any} size={20} color={isSel ? ORANGE : "#777"} />
                    </View>
                    <Text style={[ss.pillLabel, isSel && ss.pillLabelSel]}>{g.label}</Text>
                    {isSel ? (
                      <View style={ss.selBadge}>
                        <Text style={ss.selBadgeTxt}>SELECTED</Text>
                        <Ionicons name="checkmark-circle" size={18} color={ORANGE} />
                      </View>
                    ) : (
                      <Ionicons name="chevron-forward" size={18} color="#444" />
                    )}
                  </View>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>
      </ScrollView>
    </Shell>
  );
}

const STYLES = [
  { id: "streetwear", label: "Streetwear", image: require("../assets/streetwear.jpg"), colors: ["#1A1A1A", "#2A2A2A"] },
  { id: "minimal", label: "Minimal", image: require("../assets/minimal.jpg"), colors: ["#202020", "#303030"] },
  { id: "old_money", label: "Old Money", image: require("../assets/oldmoney.jpg"), colors: ["#2B2118", "#3A2C20"] },
  { id: "korean", label: "Korean Fashion", image: require("../assets/korean.jpg"), colors: ["#1C1C1C", "#2C2C2C"] },
  { id: "y2k", label: "Y2K", image: require("../assets/y2k.jpg"), colors: ["#181818", "#2A2A2A"] },
  { id: "luxury", label: "Luxury", image: require("../assets/luxury.jpg"), colors: ["#251A12", "#3A281B"] },
  { id: "casual", label: "Casual", image: require("../assets/casual.jpg"), colors: ["#1A1A1A", "#262626"] },
  { id: "sporty", label: "Sporty", image: require("../assets/sporty.jpg"), colors: ["#1A1A1A", "#2F2F2F"] },
  { id: "smart_casual", label: "Smart Casual", image: require("../assets/smartcasual.jpg"), colors: ["#1F1B18", "#2C2622"] },
  { id: "dark_academia", label: "Dark Academia", image: require("../assets/darkacademia.jpg"), colors: ["#1B1714", "#2B2420"] },
  { id: "techwear", label: "Techwear", image: require("../assets/techwear.jpg"), colors: ["#121212", "#222222"] },
  { id: "oversized", label: "Oversized", image: require("../assets/oversized.jpg"), colors: ["#181818", "#282828"] },
];

function StylesScreen({ step, total, onBack, onSkip, onContinue }: StepProps) {
  const { profile, set } = useContext(ProfileCtx);
  const selected = profile.styles;
  const toggle = (id: string) => { set("styles", selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]); };
  return (
    <Shell step={step} total={total} onBack={onBack} onSkip={onSkip} onContinue={onContinue} canContinue={selected.length > 0}>
      <ScreenTitle title={"What's your\nfashion vibe?"} sub="Pick all the styles that speak to you. Multi-select allowed." px={20} />
      <FlatList
        data={STYLES} numColumns={2} keyExtractor={(i) => i.id} showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
        columnWrapperStyle={{ gap: 10, marginBottom: 10 }}
        renderItem={({ item, index }) => {
          const isSel = selected.includes(item.id);
          return <StyleCard item={item} isSel={isSel} onPress={() => toggle(item.id)} index={index} />;
        }}
      />
    </Shell>
  );
}

function StyleCard({ item, isSel, onPress, index }: any) {
  const anim = useRef(new Animated.Value(0)).current;
  const { scale, bounce } = useSpringBounce();

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 250,
      delay: index * 40,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View
      style={{
        flex: 1,
        opacity: anim,
        transform: [
          { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
          { scale },
        ],
      }}
    >
      <TouchableOpacity activeOpacity={0.85} onPress={() => { bounce(); onPress(); }}>
        <View style={[ss.styleCard, isSel && ss.styleCardSel]}>
          <ImageBackground
            source={item.image}
            style={[StyleSheet.absoluteFillObject, { opacity: 0.9 }]}
            imageStyle={{ borderRadius: 18 }}
            resizeMode="cover"
          >
            <LinearGradient
              colors={["rgba(0,0,0,0.05)", "rgba(0,0,0,0.15)", "rgba(0,0,0,0.9)"]}
              style={StyleSheet.absoluteFill}
            />
          </ImageBackground>
          {isSel && <View style={ss.styleCardGlow} />}
          <View style={{ marginTop: "auto" }}>
            <Text style={ss.styleEmoji}>{item.emoji}</Text>
            <Text style={[ss.styleLabel, isSel && { color: "#FFF" }]}>{item.label}</Text>
          </View>
          {isSel && (
            <View style={ss.styleCheck}>
              <Ionicons name="checkmark" size={12} color="#FFF" />
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const COLOR_PALETTE = [
  { id: "black", label: "Black", hex: "#1a1a1a" },
  { id: "white", label: "White", hex: "#F5F5F5" },
  { id: "grey", label: "Grey", hex: "#9E9E9E" },
  { id: "navy", label: "Navy", hex: "#1B2A4A" },
  { id: "cobalt", label: "Cobalt", hex: "#0047AB" },
  { id: "sky", label: "Sky Blue", hex: "#87CEEB" },
  { id: "emerald", label: "Emerald", hex: "#1A6B4A" },
  { id: "sage", label: "Sage", hex: "#8FAF8F" },
  { id: "olive", label: "Olive", hex: "#6B6B2A" },
  { id: "burgundy", label: "Burgundy", hex: "#722F37" },
  { id: "red", label: "Red", hex: "#C0392B" },
  { id: "blush", label: "Blush", hex: "#E8A598" },
  { id: "caramel", label: "Caramel", hex: "#C6823A" },
  { id: "mustard", label: "Mustard", hex: "#DFAF2C" },
  { id: "cream", label: "Cream", hex: "#EDE0C8" },
  { id: "brown", label: "Brown", hex: "#6F4E37" },
  { id: "lilac", label: "Lilac", hex: "#A78FC0" },
  { id: "pink", label: "Pink", hex: "#E87F9E" },
  { id: "orange", label: "Orange", hex: "#E8620A" },
  { id: "mint", label: "Mint", hex: "#98DBC6" },
];

function ColorsScreen({ step, total, onBack, onSkip, onContinue, title, subKey }: StepProps & { title: string; subKey: keyof Profile }) {
  const { profile, set } = useContext(ProfileCtx);
  const selected = profile[subKey] as string[];
  const toggle = (id: string) => { set(subKey, selected.includes(id) ? selected.filter((c) => c !== id) : [...selected, id]); };
  return (
    <Shell step={step} total={total} onBack={onBack} onSkip={onSkip} onContinue={onContinue} canContinue={selected.length > 0}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <ScreenTitle title={title} sub="Tap to select all that apply." px={20} />
        <View style={ss.colorGrid}>
          {COLOR_PALETTE.map((c, i) => {
            const isSel = selected.includes(c.id);
            return <ColorChip key={c.id} color={c} isSel={isSel} onPress={() => toggle(c.id)} index={i} />;
          })}
        </View>
      </ScrollView>
    </Shell>
  );
}

function ColorChip({ color, isSel, onPress, index }: any) {
  const { scale, bounce } = useSpringBounce();
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 220, delay: index * 25, useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View style={{ opacity: anim, transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }, { scale }] }}>
      <TouchableOpacity activeOpacity={0.8} onPress={() => { bounce(); onPress(); }} style={ss.colorChipWrap}>
        <View style={[ss.colorChip, { backgroundColor: color.hex }, isSel && ss.colorChipSel]}>
          {isSel && <Ionicons name="checkmark" size={16} color={isDark(color.hex) ? "#FFF" : "#000"} />}
        </View>
        <Text style={[ss.colorLabel, isSel && { color: "#FFF" }]} numberOfLines={1}>{color.label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

function isDark(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 128;
}

const FITS = [
  {
    id: "oversized",
    label: "Oversized",
    image: require("../assets/pref/oversized.png"),
    shape: [40, 70, 60, 70, 40],
    icon: "🧥",
    desc: "Loose, relaxed silhouette",
  },
  {
    id: "slim",
    label: "Slim Fit",
    image: require("../assets/pref/slimfit.png"),
    shape: [30, 50, 45, 50, 30],
    icon: "👔",
    desc: "Close to the body",
  },
  {
    id: "relaxed",
    label: "Relaxed",
    image: require("../assets/pref/relaxedfit.png"),
    shape: [36, 60, 54, 60, 36],
    icon: "😌",
    desc: "Comfortable, easy fit",
  },
  {
    id: "boxy",
    label: "Boxy",
    image: require("../assets/pref/boxy.png"),
    shape: [45, 55, 55, 55, 45],
    icon: "📦",
    desc: "Square, straight cut",
  },
  {
    id: "tailored",
    label: "Tailored",
    image: require("../assets/pref/tailored.png"),
    shape: [28, 52, 44, 52, 28],
    icon: "✂️",
    desc: "Sharp, structured lines",
  },
  {
    id: "layered",
    label: "Layered",
    image: require("../assets/pref/layered.png"),
    shape: [42, 65, 58, 65, 42],
    icon: "🧣",
    desc: "Multi-piece styling",
  },
];


function FitScreen({ step, total, onBack, onSkip, onContinue }: StepProps) {
  const { profile, set } = useContext(ProfileCtx);
  const selected = profile.fit;
  const fitAnims = useRef(FITS.map(() => new Animated.Value(0))).current;
  useEffect(() => {
    Animated.stagger(70, fitAnims.map((a) => Animated.timing(a, { toValue: 1, duration: 250, useNativeDriver: true }))).start();
  }, []);
  return (
    <Shell step={step} total={total} onBack={onBack} onSkip={onSkip} onContinue={onContinue} canContinue={!!selected}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
        <ScreenTitle title={"What's your\npreferred fit?"} sub="This helps us match the right silhouette for you." px={20} />
        <View style={ss.fitGrid}>
          {FITS.map((f, i) => {
            const isSel = selected === f.id;
            return (
              <Animated.View key={f.id} style={{ width: (W - 52) / 2, opacity: fitAnims[i], transform: [{ scale: fitAnims[i].interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }] }}>
                <TouchableOpacity activeOpacity={0.85} onPress={() => set("fit", f.id)}>
                 
  <View style={[ss.fitCard, isSel && ss.fitCardSel]}>
  <ImageBackground
    source={f.image}
    style={StyleSheet.absoluteFillObject}
    imageStyle={{ borderRadius: 18 }}
    resizeMode="cover"
  >
    <LinearGradient
      colors={[
        "rgba(0,0,0,0.05)",
        "rgba(0,0,0,0.2)",
        "rgba(0,0,0,0.6)",
      ]}
      style={StyleSheet.absoluteFill}
    />
  </ImageBackground>

  {isSel && (
    <LinearGradient
      colors={[ORANGE_DIM, "transparent"]}
      style={StyleSheet.absoluteFill}
    />
  )}

  <View style={{ flex: 1, justifyContent: "space-between" }}>
    <Text style={ss.fitEmoji}>{f.icon}</Text>

    <View>
      <Text style={[ss.fitName, isSel && { color: "#FFF" }]}>
        {f.label}
      </Text>

      <Text style={ss.fitDesc}>
        {f.desc}
      </Text>
    </View>
  </View>
</View>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>
      </ScrollView>
    </Shell>
  );
}

function FitSilhouette({ widths, selected }: { widths: number[]; selected: boolean }) {
  return (
    <View style={{ alignItems: "center", gap: 3 }}>
      {widths.map((w, i) => (
        <View key={i} style={{ width: w, height: i === 0 ? 10 : i === 2 ? 14 : 10, backgroundColor: selected ? ORANGE : "#333", borderRadius: 4 }} />
      ))}
    </View>
  );
}

const BODY_TYPES = [
  { id: "lean", label: "Lean", emoji: "🧍" },
  { id: "athletic", label: "Athletic", emoji: "💪" },
  { id: "broad", label: "Broad Shoulders", emoji: "🏋️" },
  { id: "curvy", label: "Curvy", emoji: "🌙" },
  { id: "pear", label: "Pear", emoji: "🍐" },
  { id: "hourglass", label: "Hourglass", emoji: "⌛" },
  { id: "petite", label: "Petite", emoji: "🌸" },
  { id: "tall", label: "Tall", emoji: "📏" },
  { id: "plus", label: "Plus Size", emoji: "🌊" },
  { id: "average", label: "Average", emoji: "👤" },
];

function BodyScreen({ step, total, onBack, onSkip, onContinue }: StepProps) {
  const { profile, set } = useContext(ProfileCtx);
  const selected = profile.bodyType;
  return (
    <Shell step={step} total={total} onBack={onBack} onSkip={onSkip} onContinue={onContinue} canContinue={!!selected}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <ScreenTitle title={"Your body\ntype?"} sub="Helps us recommend the most flattering styles." px={20} />
        <View style={ss.bodyGrid}>
          {BODY_TYPES.map((b, i) => {
            const isSel = selected === b.id;
            return <BodyCard key={b.id} item={b} isSel={isSel} onPress={() => set("bodyType", b.id)} index={i} />;
          })}
        </View>
      </ScrollView>
    </Shell>
  );
}

function BodyCard({ item, isSel, onPress, index }: any) {
  const { scale, bounce } = useSpringBounce();
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 230, delay: index * 35, useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View style={{ opacity: anim, transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }, { scale }], width: (W - 60) / 3 }}>
      <TouchableOpacity activeOpacity={0.8} onPress={() => { bounce(); onPress(); }}>
        <View style={[ss.bodyCard, isSel && ss.bodyCardSel]}>
          {isSel && <LinearGradient colors={[ORANGE_DIM, "transparent"]} style={StyleSheet.absoluteFill} />}
          <Text style={ss.bodyEmoji}>{item.emoji}</Text>
          <Text style={[ss.bodyLabel, isSel && { color: "#FFF" }]} numberOfLines={2}>{item.label}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const SKIN_TONES = [
  { id: "t1", hex: "#FDDBB4", label: "Fair" },
  { id: "t2", hex: "#F5C89A", label: "Light" },
  { id: "t3", hex: "#E8A878", label: "Light Medium" },
  { id: "t4", hex: "#D4895C", label: "Medium" },
  { id: "t5", hex: "#C07040", label: "Medium Tan" },
  { id: "t6", hex: "#A85A2C", label: "Tan" },
  { id: "t7", hex: "#8B4218", label: "Deep Tan" },
  { id: "t8", hex: "#6B3010", label: "Brown" },
  { id: "t9", hex: "#4A1E08", label: "Deep Brown" },
  { id: "t10", hex: "#2A0E04", label: "Deep" },
];

function SkinToneScreen({ step, total, onBack, onSkip, onContinue }: StepProps) {
  const { profile, set } = useContext(ProfileCtx);
  const selected = profile.skinTone;
  const selectedScale = useRef(
    SKIN_TONES.reduce((acc, t) => { acc[t.id] = new Animated.Value(1); return acc; }, {} as Record<string, Animated.Value>)
  ).current;

  // Smooth: quick scale up then settle
  const selectTone = (id: string) => {
    set("skinTone", id);
    Animated.sequence([
      Animated.timing(selectedScale[id], { toValue: 1.15, duration: 100, useNativeDriver: true }),
      Animated.spring(selectedScale[id], { toValue: 1, friction: 6, tension: 100, useNativeDriver: true }),
    ]).start();
  };

  return (
    <Shell step={step} total={total} onBack={onBack} onSkip={onSkip} onContinue={onContinue} canContinue={!!selected}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
        <ScreenTitle title={"What's your\nskin tone?"} sub="Helps us suggest colors and palettes that complement you." />
        <View style={ss.toneRow}>
          {SKIN_TONES.map((t) => {
            const isSel = selected === t.id;
            return (
              <Animated.View key={t.id} style={{ transform: [{ scale: selectedScale[t.id] }], alignItems: "center" }}>
                <TouchableOpacity onPress={() => selectTone(t.id)} activeOpacity={0.8}>
                  <View style={[ss.toneSwatch, { backgroundColor: t.hex }, isSel && ss.toneSwatchSel]}>
                    {isSel && <Ionicons name="checkmark" size={14} color="rgba(0,0,0,0.6)" />}
                  </View>
                </TouchableOpacity>
                {isSel && <Text style={ss.toneLabel}>{t.label}</Text>}
              </Animated.View>
            );
          })}
        </View>
        {selected && (
          <View style={ss.toneInfo}>
            <Text style={ss.toneInfoTxt}>Selected: {SKIN_TONES.find((t) => t.id === selected)?.label}</Text>
          </View>
        )}
      </ScrollView>
    </Shell>
  );
}

const HEIGHTS = ["4'8\"", "4'10\"", "5'0\"", "5'2\"", "5'4\"", "5'6\"", "5'8\"", "5'10\"", "6'0\"", "6'2\"", "6'4\"+"];

function HeightScreen({ step, total, onBack, onSkip, onContinue }: StepProps) {
  const { profile, set } = useContext(ProfileCtx);
  const selected = profile.height;
  return (
    <Shell step={step} total={total} onBack={onBack} onSkip={onSkip} onContinue={onContinue} canContinue={!!selected}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
        <ScreenTitle title={"How tall\nare you?"} sub="Used for proportional outfit recommendations." />
        <View style={ss.heightGrid}>
          {HEIGHTS.map((h, i) => {
            const isSel = selected === h;
            return <HeightChip key={h} label={h} isSel={isSel} onPress={() => set("height", h)} index={i} />;
          })}
        </View>
      </ScrollView>
    </Shell>
  );
}

function HeightChip({ label, isSel, onPress, index }: any) {
  const { scale, bounce } = useSpringBounce();
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 220, delay: index * 35, useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View style={{ opacity: anim, transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] }) }, { scale }] }}>
      <TouchableOpacity activeOpacity={0.8} onPress={() => { bounce(); onPress(); }}>
        <View style={[ss.heightChip, isSel && ss.heightChipSel]}>
          {isSel && <LinearGradient colors={[ORANGE, "#C54D00"]} style={StyleSheet.absoluteFill} />}
          <Text style={[ss.heightTxt, isSel && { color: "#FFF", fontWeight: "700" }]}>{label}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const BUDGETS = [
  { id: "budget", label: "Budget Friendly", sub: "Under $50", icon: "💚", colors: ["#0d1a10", "#102015"] },
  { id: "mid", label: "Mid Range", sub: "$50 – $200", icon: "💛", colors: ["#1a1700", "#201e00"] },
  { id: "premium", label: "Premium", sub: "$200 – $600", icon: "🧡", colors: ["#1a0e00", "#201408"] },
  { id: "luxury", label: "Luxury", sub: "$600+", icon: "💜", colors: ["#120a1a", "#1a1026"] },
  { id: "depends", label: "Depends on Item", sub: "Varies", icon: "🤍", colors: ["#141414", "#1e1e1e"] },
];

function BudgetScreen({ step, total, onBack, onSkip, onContinue }: StepProps) {
  const { profile, set } = useContext(ProfileCtx);
  const selected = profile.budget;
  const budgetAnims = useRef(BUDGETS.map(() => new Animated.Value(0))).current;
  useEffect(() => {
    Animated.stagger(80, budgetAnims.map((a) => Animated.timing(a, { toValue: 1, duration: 260, useNativeDriver: true }))).start();
  }, []);
  return (
    <Shell step={step} total={total} onBack={onBack} onSkip={onSkip} onContinue={onContinue} canContinue={!!selected}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
        <ScreenTitle title={"What's your\nshopping budget?"} sub="We'll show you options within your comfort zone." />
        {BUDGETS.map((b, i) => {
          const isSel = selected === b.id;
          return (
            <Animated.View key={b.id} style={{ opacity: budgetAnims[i], transform: [{ translateY: budgetAnims[i].interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] }}>
              <TouchableOpacity activeOpacity={0.85} onPress={() => set("budget", b.id)}>
                <LinearGradient colors={b.colors as any} style={[ss.budgetCard, isSel && ss.budgetCardSel]}>
                  {isSel && <LinearGradient colors={["rgba(232,98,10,0.12)", "transparent"]} style={StyleSheet.absoluteFill} />}
                  <Text style={ss.budgetEmoji}>{b.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[ss.budgetLabel, isSel && { color: "#FFF" }]}>{b.label}</Text>
                    <Text style={ss.budgetSub}>{b.sub}</Text>
                  </View>
                  {isSel && <Ionicons name="checkmark-circle" size={22} color={ORANGE} />}
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </ScrollView>
    </Shell>
  );
}

const AVOID_ITEMS = [
  "Skinny Jeans", "Ripped Jeans", "Sandals", "Graphic Prints", "Heavy Patterns",
  "Denim", "Formal Wear", "Shorts", "Crop Tops", "Turtlenecks", "Hoodies",
  "Tracksuits", "Floral Prints", "Animal Print", "Neon Colors", "Suits",
  "Mini Skirts", "Cargo Pants", "Biker Jackets", "Trench Coats",
];

function AvoidScreen({ step, total, onBack, onSkip, onContinue }: StepProps) {
  const { profile, set } = useContext(ProfileCtx);
  const selected = profile.avoidItems;
  const toggle = (item: string) => { set("avoidItems", selected.includes(item) ? selected.filter((i) => i !== item) : [...selected, item]); };
  return (
    <Shell step={step} total={total} onBack={onBack} onSkip={onSkip} onContinue={onContinue} canContinue={true}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}>
        <ScreenTitle title={"Anything you\nnever want to wear?"} sub="We'll remove these from your recommendations." />
        <View style={ss.chipWrap}>
          {AVOID_ITEMS.map((item, i) => (
            <AvoidChip key={item} label={item} isSel={selected.includes(item)} onPress={() => toggle(item)} index={i} />
          ))}
        </View>
      </ScrollView>
    </Shell>
  );
}

function AvoidChip({ label, isSel, onPress, index }: any) {
  const { scale, bounce } = useSpringBounce();
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 220, delay: index * 25, useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View style={{ opacity: anim, transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] }) }, { scale }] }}>
      <TouchableOpacity activeOpacity={0.8} onPress={() => { bounce(); onPress(); }}>
        <View style={[ss.avoidChip, isSel && ss.avoidChipSel]}>
          {isSel && <LinearGradient colors={["rgba(200,50,50,0.2)", "rgba(200,50,50,0.08)"]} style={StyleSheet.absoluteFill} />}
          <Text style={[ss.avoidTxt, isSel && ss.avoidTxtSel]}>{label}</Text>
          {isSel && <Ionicons name="close" size={14} color="#E05050" style={{ marginLeft: 4 }} />}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const OCCASIONS = [
  { id: "college", label: "College", icon: "🎓" },
  { id: "office", label: "Office", icon: "💼" },
  { id: "parties", label: "Parties", icon: "🎉" },
  { id: "dates", label: "Dates", icon: "💫" },
  { id: "weddings", label: "Weddings", icon: "💍" },
  { id: "gym", label: "Gym", icon: "🏋️" },
  { id: "travel", label: "Travel", icon: "✈️" },
  { id: "daily", label: "Daily Wear", icon: "☕" },
  { id: "photo", label: "Photoshoots", icon: "📸" },
  { id: "casual", label: "Casual Hangout", icon: "🛋️" },
  { id: "beach", label: "Beach", icon: "🏖️" },
  { id: "formal", label: "Formal Events", icon: "🎩" },
];

function OccasionsScreen({ step, total, onBack, onSkip, onContinue }: StepProps) {
  const { profile, set } = useContext(ProfileCtx);
  const selected = profile.occasions;
  const toggle = (id: string) => { set("occasions", selected.includes(id) ? selected.filter((o) => o !== id) : [...selected, id]); };
  return (
    <Shell step={step} total={total} onBack={onBack} onSkip={onSkip} onContinue={onContinue} canContinue={selected.length > 0}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
        <ScreenTitle title={"Where do you\nwear outfits?"} sub="Pick all the occasions you dress for." px={20} />
        <View style={ss.occasionGrid}>
          {OCCASIONS.map((o, i) => (
            <OccasionCard key={o.id} item={o} isSel={selected.includes(o.id)} onPress={() => toggle(o.id)} index={i} />
          ))}
        </View>
      </ScrollView>
    </Shell>
  );
}

function OccasionCard({ item, isSel, onPress, index }: any) {
  const { scale, bounce } = useSpringBounce();
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 230, delay: index * 35, useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View style={{ opacity: anim, transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }, { scale }], width: (W - 64) / 3 }}>
      <TouchableOpacity activeOpacity={0.8} onPress={() => { bounce(); onPress(); }}>
        <View style={[ss.occasionCard, isSel && ss.occasionCardSel]}>
          {isSel && <LinearGradient colors={[ORANGE_DIM, "transparent"]} style={StyleSheet.absoluteFill} />}
          <Text style={ss.occasionEmoji}>{item.icon}</Text>
          <Text style={[ss.occasionLabel, isSel && { color: "#FFF" }]} numberOfLines={2}>{item.label}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const GOALS = [
  { id: "outfits", label: "Outfit Suggestions", desc: "Daily curated looks", icon: "👗" },
  { id: "matching", label: "Better Matching", desc: "Mix & match pieces", icon: "🎨" },
  { id: "body", label: "Dress for My Body", desc: "Flattering styles", icon: "✨" },
  { id: "shopping", label: "Shopping Recs", desc: "Find the right buys", icon: "🛍️" },
  { id: "attractive", label: "Look More Attractive", desc: "Enhance your look", icon: "💎" },
  { id: "expensive", label: "Look More Expensive", desc: "Elevated aesthetics", icon: "👑" },
  { id: "confidence", label: "Build Confidence", desc: "Feel great daily", icon: "⚡" },
  { id: "celebrity", label: "Celebrity Looks", desc: "Inspired by icons", icon: "🌟" },
];

function GoalsScreen({ step, total, onBack, onSkip, onContinue }: StepProps) {
  const { profile, set } = useContext(ProfileCtx);
  const selected = profile.goals;
  const toggle = (id: string) => { set("goals", selected.includes(id) ? selected.filter((g) => g !== id) : [...selected, id]); };
  return (
    <Shell step={step} total={total} onBack={onBack} onSkip={onSkip} onContinue={onContinue} canContinue={selected.length > 0}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
        <ScreenTitle title={"What are your\nfashion goals?"} sub="We'll prioritize features based on your goals." px={20} />
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          {GOALS.map((g, i) => (
            <GoalCard key={g.id} item={g} isSel={selected.includes(g.id)} onPress={() => toggle(g.id)} index={i} />
          ))}
        </View>
      </ScrollView>
    </Shell>
  );
}

function GoalCard({ item, isSel, onPress, index }: any) {
  const { scale, bounce } = useSpringBounce();
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 250, delay: index * 50, useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View style={{ opacity: anim, transform: [{ translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }, { scale }] }}>
      <TouchableOpacity activeOpacity={0.85} onPress={() => { bounce(); onPress(); }}>
        <View style={[ss.goalCard, isSel && ss.goalCardSel]}>
          {isSel && <LinearGradient colors={["rgba(232,98,10,0.12)", "rgba(232,98,10,0.04)"]} style={StyleSheet.absoluteFill} />}
          <View style={[ss.goalIcon, isSel && ss.goalIconSel]}>
            <Text style={{ fontSize: 20 }}>{item.icon}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[ss.goalLabel, isSel && { color: "#FFF" }]}>{item.label}</Text>
            <Text style={ss.goalDesc}>{item.desc}</Text>
          </View>
          {isSel && <Ionicons name="checkmark-circle" size={22} color={ORANGE} />}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

function SummaryScreen({ step, total, onBack, onSkip, onFinish }: StepProps & { onFinish: () => void }) {
  const { profile } = useContext(ProfileCtx);
  const titleAnim = useEntryAnim(200);
  const subAnim = useEntryAnim(400);
  const float = useFloatAnim(6, 3000);
  const summaryItems = [
    { label: "Gender Expression", value: profile.gender?.replace("_", " ") || "—", icon: "👤" },
    { label: "Styles", value: profile.styles.length > 0 ? `${profile.styles.length} selected` : "—", icon: "✨" },
    { label: "Favorite Colors", value: profile.favoriteColors.length > 0 ? `${profile.favoriteColors.length} colors` : "—", icon: "🎨" },
    { label: "Preferred Fit", value: profile.fit?.replace("_", " ") || "—", icon: "👔" },
    { label: "Body Type", value: profile.bodyType || "—", icon: "🌟" },
    { label: "Height", value: profile.height || "—", icon: "📏" },
    { label: "Budget", value: profile.budget?.replace("_", " ") || "—", icon: "💎" },
    { label: "Occasions", value: profile.occasions.length > 0 ? `${profile.occasions.length} selected` : "—", icon: "🎯" },
    { label: "Goals", value: profile.goals.length > 0 ? `${profile.goals.length} goals` : "—", icon: "🚀" },
  ];
  return (
    <View style={ss.shell}>
      <LinearGradient colors={["#080808", "#0E0A06", "#080808"]} style={StyleSheet.absoluteFill} />
      <View style={[ss.blob1, { opacity: 0.6 }]}>
        <LinearGradient colors={["rgba(232,98,10,0.3)", "transparent"]} style={{ width: 300, height: 300, borderRadius: 150 }} />
      </View>
      <SafeAreaView style={ss.safeArea}>
        <Animated.View style={[{ alignItems: "center", paddingTop: 16, opacity: titleAnim, transform: [{ translateY: titleAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }, { translateY: float }] }]}>
          <View style={ss.summaryBadge}><Text style={ss.summaryBadgeTxt}>✓ PROFILE COMPLETE</Text></View>
          <Text style={ss.summaryTitle}>Your Style Profile{"\n"}is Ready</Text>
          <Text style={ss.summarySub}>We'll now personalize every recommendation for you.</Text>
        </Animated.View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}>
          <View style={{ gap: 10, marginTop: 8 }}>
            {summaryItems.map((item, i) => (<SummaryCard key={item.label} item={item} index={i} />))}
          </View>
        </ScrollView>
        <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
          <TouchableOpacity activeOpacity={0.88} onPress={onFinish}>
            <LinearGradient colors={[ORANGE, "#C54D00"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={ss.finishBtn}>
              <Text style={ss.finishBtnTxt}>Continue to My Wardrobe</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFF" style={{ marginLeft: 10 }} />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

function SummaryCard({ item, index }: any) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 260, delay: 200 + index * 60, useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View style={{ opacity: anim, transform: [{ translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] }}>
      <BlurView intensity={12} tint="dark" style={ss.summaryCard}>
        <LinearGradient colors={["rgba(40,40,40,0.6)", "rgba(20,20,20,0.6)"]} style={StyleSheet.absoluteFill} />
        <Text style={{ fontSize: 18, marginRight: 12 }}>{item.icon}</Text>
        <View style={{ flex: 1 }}>
          <Text style={ss.sumCardLabel}>{item.label}</Text>
          <Text style={ss.sumCardVal}>{item.value}</Text>
        </View>
      </BlurView>
    </Animated.View>
  );
}

function ScreenTitle({ title, sub, px = 0 }: { title: string; sub: string; px?: number }) {
  const anim = useEntryAnim(80);
  return (
    <Animated.View style={[{ marginBottom: 24, paddingHorizontal: px, opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}>
      <Text style={ss.screenTitle}>{title}</Text>
      <Text style={ss.screenSub}>{sub}</Text>
    </Animated.View>
  );
}

interface StepProps {
  step: number;
  total: number;
  onBack: () => void;
  onSkip: () => void;
  onContinue: () => void;
}

// ─── Main Navigator ───────────────────────────────────────────────────────────
export default function SenseAIOnboarding() {
  const [screen, setScreen] = useState(0);
  const [profile, setProfileState] = useState<Profile>(defaultProfile);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const router = useRouter();
  const { user } = useUser();

  const set = useCallback((key: keyof Profile, val: any) => {
    setProfileState((p) => ({ ...p, [key]: val }));
  }, []);

  const TOTAL = 14;

  // Smooth page transition: pure timing both ways, no spring chaining
  const goTo = (next: number) => {
    const isForward = next > screen;
    Animated.timing(slideAnim, {
      toValue: isForward ? -W : W,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      slideAnim.setValue(isForward ? W : -W);
      setScreen(next);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start();
    });
  };

  const next = () => goTo(screen + 1);
  const back = () => screen > 0 && goTo(screen - 1);
  const skip = () => goTo(TOTAL - 1);

  const stepProps = (s: number): StepProps => ({
    step: s, total: TOTAL, onBack: back, onSkip: skip, onContinue: next,
  });

  const handleFinish = async () => {
    try {
      const userId = user?.id;
      const apiBase = process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:4000";

      // 1. Save full preferences to database (source of truth for "onboarding done")
      if (userId) {
        try {
          await fetch(`${apiBase}/api/profile/preferences`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-user-id": userId,
            },
            body: JSON.stringify({
              clerk_id: userId,
              gender: profile.gender,
              styles: profile.styles,
              favoriteColors: profile.favoriteColors,
              dislikedColors: profile.dislikedColors,
              fit: profile.fit,
              bodyType: profile.bodyType,
              skinTone: profile.skinTone,
              height: profile.height,
              budget: profile.budget,
              avoidItems: profile.avoidItems,
              occasions: profile.occasions,
              goals: profile.goals,
            }),
          });
          console.log("[pref] Preferences saved to database for", userId);
        } catch (dbErr) {
          // Non-fatal — local cache will still mark done
          console.warn("[pref] Could not save preferences to DB (non-fatal):", dbErr);
        }
      }

      // 2. Mark locally so we don't re-check DB every cold start
      await AsyncStorage.setItem("fitsense_onboarding_complete", "true");
      await AsyncStorage.setItem("fitsense_user_profile", JSON.stringify(profile));

      // 3. Update Clerk metadata as a secondary flag
      await user?.update({
        unsafeMetadata: { onboardingComplete: true },
      });

      router.replace("/(tabs)/home");
    } catch (error) {
      console.error("Error saving preferences:", error);
      router.replace("/(tabs)/home");
    }
  };


  const screens = [
    <WelcomeScreen onStart={next} />,
    <GenderScreen {...stepProps(2)} />,
    <StylesScreen {...stepProps(3)} />,
    <ColorsScreen {...stepProps(4)} title={"Your favorite\ncolors?"} subKey="favoriteColors" />,
    <ColorsScreen {...stepProps(5)} title={"Colors you\nnever wear?"} subKey="dislikedColors" />,
    <FitScreen {...stepProps(6)} />,
    <BodyScreen {...stepProps(7)} />,
    <SkinToneScreen {...stepProps(8)} />,
    <HeightScreen {...stepProps(9)} />,
    <BudgetScreen {...stepProps(10)} />,
    <AvoidScreen {...stepProps(11)} />,
    <OccasionsScreen {...stepProps(12)} />,
    <GoalsScreen {...stepProps(13)} />,
    <SummaryScreen {...stepProps(TOTAL)} onFinish={handleFinish} />,
  ];

  return (
    <ProfileCtx.Provider value={{ profile, set }}>
      <Animated.View style={[{ flex: 1 }, { transform: [{ translateX: slideAnim }] }]}>
        {screens[screen]}
      </Animated.View>
    </ProfileCtx.Provider>
  );
}

const ss = StyleSheet.create({
  shell: { flex: 1, backgroundColor: "#080808" },
  safeArea: { flex: 1, paddingBottom: Platform.OS === "android" ? 20 : 0 },
  blob1: { position: "absolute", top: H * 0.3, right: -60, zIndex: 0 },
  blob2: { position: "absolute", bottom: H * 0.15, left: -50, zIndex: 0 },
  decorCircle: { position: "absolute", overflow: "hidden" },
  gridOverlay: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
  gridLine: { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: "rgba(255,255,255,0.02)" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 6, paddingBottom: 12 },
  iconBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: "#FFF", fontSize: 17, fontWeight: "700", letterSpacing: 0.3 },
  skipBtn: { color: ORANGE, fontSize: 13, fontWeight: "700", letterSpacing: 1.2 },
  progressSection: { paddingHorizontal: 20, marginBottom: 20 },
  progressLabels: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  stepLabel: { color: "#555", fontSize: 11, fontWeight: "600", letterSpacing: 1.5 },
  pctLabel: { color: ORANGE, fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  track: { height: 3, backgroundColor: "#1E1E1E", borderRadius: 2, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 2, overflow: "hidden" },
  continueBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: 50, paddingVertical: 18, marginHorizontal: 20, overflow: "hidden", borderWidth: 1, borderColor: "#252525" },
  continueTxt: { color: "#FFF", fontSize: 13, fontWeight: "700", letterSpacing: 2.5 },
  screenTitle: { color: "#FFF", fontSize: 30, fontWeight: "800", lineHeight: 38, letterSpacing: -0.5, marginBottom: 10 },
  screenSub: { color: "#666", fontSize: 14, lineHeight: 20 },
  logoMark: { width: 60, height: 60, borderRadius: 18, overflow: "hidden" },
  logoGrad: { flex: 1, alignItems: "center", justifyContent: "center" },
  logoTxt: { color: "#FFF", fontSize: 28, fontWeight: "900" },
  welcomeTitle: { color: "#FFF", fontSize: 38, fontWeight: "900", letterSpacing: -1, textAlign: "center", lineHeight: 46 },
  accentWordBox: { marginTop: 6, paddingHorizontal: 20, paddingVertical: 6, borderRadius: 20, backgroundColor: ORANGE_DIM, borderWidth: 1, borderColor: "rgba(232,98,10,0.3)" },
  accentWord: { color: ORANGE, fontSize: 15, fontWeight: "800", letterSpacing: 3 },
  welcomeSub: { color: "#666", fontSize: 16, textAlign: "center", lineHeight: 26, marginTop: 24, paddingHorizontal: 24 },
  startBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: 50, paddingVertical: 20, shadowColor: ORANGE, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 12 },
  startBtnTxt: { color: "#FFF", fontSize: 17, fontWeight: "800", letterSpacing: 0.5 },
  termsText: { color: "#444", fontSize: 13, marginTop: 20, letterSpacing: 0.5 },
  pillCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#141414", borderRadius: 50, paddingVertical: 18, paddingHorizontal: 20, borderWidth: 1.5, borderColor: "#222", overflow: "hidden" },
  pillCardSel: { borderColor: ORANGE, shadowColor: ORANGE, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 14, elevation: 8 },
  pillIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#1E1E1E", alignItems: "center", justifyContent: "center", marginRight: 16 },
  pillIconSel: { backgroundColor: ORANGE_DIM },
  pillLabel: { flex: 1, color: "#CCC", fontSize: 17, fontWeight: "600" },
  pillLabelSel: { color: "#FFF", fontWeight: "700" },
  selBadge: { flexDirection: "row", alignItems: "center", gap: 6 },
  selBadgeTxt: { color: ORANGE, fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  styleCard: { borderRadius: 18, padding: 16, aspectRatio: 0.85, justifyContent: "flex-end", overflow: "hidden", borderWidth: 1.5, borderColor: "#1E1E1E" },
  styleCardSel: { borderColor: ORANGE, shadowColor: ORANGE, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
  styleCardGlow: { ...StyleSheet.absoluteFillObject, backgroundColor: ORANGE_DIM },
  styleEmoji: { fontSize: 28, marginBottom: 8 },
  styleLabel: { color: "#AAA", fontSize: 13, fontWeight: "700", letterSpacing: 0.3 },
  styleCheck: { position: "absolute", top: 10, right: 10, width: 22, height: 22, borderRadius: 11, backgroundColor: ORANGE, alignItems: "center", justifyContent: "center" },
  colorGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 20, gap: 12, paddingBottom: 16 },
  colorChipWrap: { alignItems: "center", width: (W - 88) / 4 },
  colorChip: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "transparent" },
  colorChipSel: { borderColor: "#FFF", shadowColor: "#FFF", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: 6 },
  colorLabel: { color: "#555", fontSize: 10, marginTop: 5, textAlign: "center" },
  fitGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, gap: 10 },
  fitCard: {
  borderRadius: 18,
  padding: 16,
  backgroundColor: "#141414",
  borderWidth: 1.5,
  borderColor: "#222",
  overflow: "hidden",
  minHeight: 220,
},
  fitCardSel: { borderColor: ORANGE, shadowColor: ORANGE, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  fitEmoji: { fontSize: 22, marginBottom: 10 },
  silhouetteWrap: { marginVertical: 12, alignItems: "center" },
  fitName: { color: "#AAA", fontSize: 13, fontWeight: "700", textAlign: "center" },
  fitDesc: { color: "#555", fontSize: 11, textAlign: "center", marginTop: 3 },
  bodyGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, gap: 10, paddingBottom: 16 },
  bodyCard: { borderRadius: 16, padding: 16, backgroundColor: "#141414", borderWidth: 1.5, borderColor: "#222", alignItems: "center", overflow: "hidden" },
  bodyCardSel: { borderColor: ORANGE, shadowColor: ORANGE, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 },
  bodyEmoji: { fontSize: 28, marginBottom: 8 },
  bodyLabel: { color: "#888", fontSize: 12, fontWeight: "600", textAlign: "center" },
  toneRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 24 },
  toneSwatch: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "transparent" },
  toneSwatchSel: { borderColor: "rgba(255,255,255,0.6)", shadowColor: "#FFF", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 6 },
  toneLabel: { color: "#777", fontSize: 10, marginTop: 4, textAlign: "center" },
  toneInfo: { backgroundColor: "#141414", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#242424" },
  toneInfoTxt: { color: "#CCC", fontSize: 14, fontWeight: "600" },
  heightGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
  heightChip: { paddingHorizontal: 20, paddingVertical: 14, borderRadius: 50, backgroundColor: "#141414", borderWidth: 1.5, borderColor: "#222", overflow: "hidden" },
  heightChipSel: { borderColor: ORANGE, shadowColor: ORANGE, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6 },
  heightTxt: { color: "#AAA", fontSize: 15, fontWeight: "600" },
  budgetCard: { flexDirection: "row", alignItems: "center", borderRadius: 20, padding: 20, borderWidth: 1.5, borderColor: "#222", overflow: "hidden" },
  budgetCardSel: { borderColor: ORANGE, shadowColor: ORANGE, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 14, elevation: 8 },
  budgetEmoji: { fontSize: 28, marginRight: 16 },
  budgetLabel: { color: "#CCC", fontSize: 16, fontWeight: "700" },
  budgetSub: { color: "#555", fontSize: 13, marginTop: 2 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingBottom: 16 },
  avoidChip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 50, backgroundColor: "#141414", borderWidth: 1.5, borderColor: "#222", overflow: "hidden" },
  avoidChipSel: { borderColor: "#E05050" },
  avoidTxt: { color: "#888", fontSize: 13, fontWeight: "600" },
  avoidTxtSel: { color: "#E05050" },
  occasionGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, gap: 10, paddingBottom: 16 },
  occasionCard: { borderRadius: 18, padding: 14, backgroundColor: "#141414", borderWidth: 1.5, borderColor: "#222", alignItems: "center", overflow: "hidden" },
  occasionCardSel: { borderColor: ORANGE, shadowColor: ORANGE, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 },
  occasionEmoji: { fontSize: 26, marginBottom: 8 },
  occasionLabel: { color: "#888", fontSize: 11, fontWeight: "600", textAlign: "center" },
  goalCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#111", borderRadius: 18, padding: 18, borderWidth: 1.5, borderColor: "#1E1E1E", overflow: "hidden" },
  goalCardSel: { borderColor: ORANGE, shadowColor: ORANGE, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 8 },
  goalIcon: { width: 50, height: 50, borderRadius: 14, backgroundColor: "#1E1E1E", alignItems: "center", justifyContent: "center", marginRight: 16 },
  goalIconSel: { backgroundColor: ORANGE_DIM },
  goalLabel: { color: "#CCC", fontSize: 15, fontWeight: "700" },
  goalDesc: { color: "#555", fontSize: 12, marginTop: 2 },
  summaryBadge: { backgroundColor: "rgba(232,98,10,0.15)", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6, borderWidth: 1, borderColor: "rgba(232,98,10,0.3)", marginBottom: 16 },
  summaryBadgeTxt: { color: ORANGE, fontSize: 12, fontWeight: "800", letterSpacing: 1.5 },
  summaryTitle: { color: "#FFF", fontSize: 32, fontWeight: "900", textAlign: "center", letterSpacing: -0.5, lineHeight: 40, marginBottom: 12 },
  summarySub: { color: "#666", fontSize: 15, textAlign: "center", lineHeight: 22, paddingHorizontal: 24, marginBottom: 24 },
  summaryCard: { flexDirection: "row", alignItems: "center", borderRadius: 16, padding: 16, overflow: "hidden", borderWidth: 1, borderColor: "#1E1E1E" },
  sumCardLabel: { color: "#555", fontSize: 12, fontWeight: "600", letterSpacing: 0.5, marginBottom: 3 },
  sumCardVal: { color: "#CCC", fontSize: 14, fontWeight: "700", textTransform: "capitalize" },
  finishBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: 50, paddingVertical: 20, shadowColor: ORANGE, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.45, shadowRadius: 20, elevation: 12 },
  finishBtnTxt: { color: "#FFF", fontSize: 16, fontWeight: "800" },
});