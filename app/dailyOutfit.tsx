import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

const PRIMARY = "#FF6B00";
const BG = "#000";
const [savedOutfits, setSavedOutfits] = useState<any>({});
export default function DailyOutfit() {
  const router = useRouter();
  const { wardrobe, day, date } = useLocalSearchParams();

  const parsedWardrobe = wardrobe ? JSON.parse(wardrobe as string) : {};

  const [selected, setSelected] = useState<any>({
    top: null,
    bottom: null,
    footwear: null,
    outerwear: null,
    accessory: null,
  });

  // flatten wardrobe into one grid
const wardrobeItems = useMemo(() => {
  return [
    ...(parsedWardrobe.tops || []).map((i: any) => ({ ...i, category: "top" })),
    ...(parsedWardrobe.bottoms || []).map((i: any) => ({ ...i, category: "bottom" })),
    ...(parsedWardrobe.footwear || []).map((i: any) => ({ ...i, category: "footwear" })),
    ...(parsedWardrobe.outerwear || []).map((i: any) => ({ ...i, category: "outerwear" })),
    ...(parsedWardrobe.accessories || []).map((i: any) => ({ ...i, category: "accessory" })),
  ];
}, [parsedWardrobe]);

const selectItem = (item: any) => {
  setSelected((prev: any) => ({
    ...prev,
    [item.category]: item,
  }));
};

const saveOutfit = async () => {
  const key = `fitsense_outfit_${day}_${date}`;

  const outfitData = {
    ...selected,
    date,
    day,
  };

  try {
    await AsyncStorage.setItem(key, JSON.stringify(outfitData));
    router.back();
  } catch (e) {
    console.log("Error saving outfit", e);
  }
};

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.title}>Create Outfit</Text>
        <Text style={styles.date}>
          {day}, {date}
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* WARDROBE GRID */}
        <Text style={styles.section}>Your Wardrobe</Text>

        <View style={styles.grid}>
          {wardrobeItems.map((item: any, i: number) => {
            const isSelected = selected[item.category]?.id === item.id;

            return (
<TouchableOpacity
  key={i}
  style={[
    styles.itemCard,
    isSelected && styles.selectedCard,
  ]}
  onPress={() => selectItem(item)}
>
  {/* CATEGORY TAG */}
  <View style={styles.tag}>
    <Text style={styles.tagText}>{item.category}</Text>
  </View>

  {item.image ? (
    <Image
      source={{ uri: item.image }}
      style={styles.image}
      resizeMode="contain"
    />
  ) : (
    <Text style={styles.emoji}>{item.emoji}</Text>
  )}
</TouchableOpacity>
            );
          })}
        </View>

        {/* PREVIEW */}
        <Text style={styles.section}>Outfit Preview</Text>

        <View style={styles.preview}>
          {Object.values(selected).map((item: any, i) => {
            if (!item) return null;

            return (
              <View key={i} style={styles.previewItem}>
                {item.image ? (
                  <Image
                    source={{ uri: item.image }}
                    style={styles.previewImage}
                  />
                ) : (
                  <Text style={{ fontSize: 26 }}>{item.emoji}</Text>
                )}
                <Text style={styles.previewText}>{item.name}</Text>
              </View>
            );
          })}
        </View>

        {/* SAVE BUTTON */}
        <TouchableOpacity style={styles.saveBtn} onPress={saveOutfit}>
          <Text style={styles.saveText}>Save Outfit</Text>
        </TouchableOpacity>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
    paddingHorizontal: 20,
    paddingTop: 60,
  },

  header: {
    marginBottom: 20,
  },

  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#fff",
  },

  date: {
    color: "#888",
    marginTop: 4,
  },

  section: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 14,
    marginTop: 20,
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },

  

  selectedCard: {
    borderColor: PRIMARY,
  },

  image: {
    width: "90%",
    height: "90%",
  },

  emoji: {
    fontSize: 28,
  },

  preview: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },

  previewItem: {
    width: "30%",
    alignItems: "center",
  },

  previewImage: {
    width: 50,
    height: 50,
    marginBottom: 6,
  },

  previewText: {
    color: "#aaa",
    fontSize: 12,
  },

  saveBtn: {
    marginTop: 30,
    backgroundColor: PRIMARY,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },

  saveText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  
  

tag: {
  position: "absolute",
  top: 8,
  left: 8,
  backgroundColor: "rgba(255,107,0,0.15)",
  borderWidth: 1,
  borderColor: "rgba(255,107,0,0.5)",
  paddingHorizontal: 6,
  paddingVertical: 2,
  borderRadius: 6,
},

tagText: {
  color: "#FF6B00",
  fontSize: 10,
  fontWeight: "700",
  textTransform: "capitalize",
},
itemCard: {
  width: "45%",
  aspectRatio: 1,
  backgroundColor: "#111",
  borderRadius: 18,
  borderWidth: 2,
  borderColor: "transparent",
  justifyContent: "center",
  alignItems: "center",
  padding: 10,
  overflow: "hidden",
},
});