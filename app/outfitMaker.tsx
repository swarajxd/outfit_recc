import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
type Outfit = {
  top?: any;
  bottom?: any;
  footwear?: any;
  outerwear?: any;
  accessory?: any;
};
import { forceRegenerateOutfit } from "./utils/outfitEngine";

export default function OutfitMaker() {
  const router = useRouter();
    const { wardrobe } = useLocalSearchParams();

const parsedWardrobe = wardrobe
  ? JSON.parse(wardrobe as string)
  : null;
  const [prompt, setPrompt] = useState("");

  const [answers, setAnswers] = useState({
    occasion: "",
    weather: "",
    style: ""
  });

  const [outfit, setOutfit] = useState<Outfit | null>(null);

  const selectOption = (question: string, value: string) => {
    setAnswers({ ...answers, [question]: value });
  };

const generateOutfit = async () => {
  if (!parsedWardrobe) {
    console.log("No wardrobe found");
    return;
  }

  try {
    let filteredWardrobe = { ...parsedWardrobe };

    const promptLower = prompt.toLowerCase();

    // Infer prompt-based defaults (do not mutate state directly)
    const inferredAnswers = { ...answers };

    // infer occasion from prompt
    if (promptLower.includes("wedding") || promptLower.includes("formal")) {
      inferredAnswers.occasion = "Formal";
    } else if (promptLower.includes("gym") || promptLower.includes("workout")) {
      inferredAnswers.occasion = "Gym";
    }

    // infer weather
    if (promptLower.includes("winter") || promptLower.includes("cold")) {
      inferredAnswers.weather = "Cold";
    } else if (promptLower.includes("summer") || promptLower.includes("hot")) {
      inferredAnswers.weather = "Hot";
    }

    // Sync inferred answers back into state if they changed
    if (
      inferredAnswers.occasion !== answers.occasion ||
      inferredAnswers.weather !== answers.weather
    ) {
      setAnswers(inferredAnswers);
    }

    // WEATHER FILTER
    if (inferredAnswers.weather === "Hot") {
      filteredWardrobe.outerwear = [];
    } else if (inferredAnswers.weather === "Cold") {
      if (parsedWardrobe.outerwear.length === 0) {
        console.log("No jackets available");
      }
    }

    // OCCASION FILTER
    if (inferredAnswers.occasion === "Formal") {
      const formalTops = parsedWardrobe.tops.filter((item: any) =>
        item.name.toLowerCase().includes("shirt") ||
        item.name.toLowerCase().includes("blazer")
      );

      if (formalTops.length > 0) {
        filteredWardrobe.tops = formalTops;
      }
    } else if (inferredAnswers.occasion === "Gym") {
      filteredWardrobe.bottoms = parsedWardrobe.bottoms.filter((item: any) =>
        item.name.toLowerCase().includes("short") ||
        item.name.toLowerCase().includes("jogger")
      );
    }

    // STYLE FILTER
    if (answers.style === "Minimal") {
      filteredWardrobe.accessories = [];
    }

    const outfit = await forceRegenerateOutfit(filteredWardrobe);

    setOutfit(outfit);
  } catch (err) {
    console.log("Error generating outfit", err);
  }
};
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <TouchableOpacity
        onPress={() => router.back()}
        style={styles.backBtn}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Text style={styles.backIcon}>←</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Outfit Maker</Text>
      <Text style={styles.subtitle}>Create your perfect look instantly</Text>

      <Text style={styles.label}>Describe your vision</Text>

      <TextInput
        placeholder="E.g., stylish summer outfit for brunch"
        placeholderTextColor="#666"
        style={styles.input}
        value={prompt}
        onChangeText={setPrompt}
      />

      <Text style={styles.label}>Occasion</Text>

      <View style={styles.options}>
        {["Casual", "Formal", "Party", "Gym"].map((item) => (
          <TouchableOpacity
            key={item}
            style={[
              styles.option,
              answers.occasion === item && styles.selected
            ]}
            onPress={() => selectOption("occasion", item)}
          >
            <Text style={styles.optionText}>{item}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Weather</Text>

      <View style={styles.options}>
        {["Hot", "Moderate", "Cold", "Rainy"].map((item) => (
          <TouchableOpacity
            key={item}
            style={[
              styles.option,
              answers.weather === item && styles.selected
            ]}
            onPress={() => selectOption("weather", item)}
          >
            <Text style={styles.optionText}>{item}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Style</Text>

      <View style={styles.options}>
        {["Minimal", "Trendy", "Sporty", "Streetwear"].map((item) => (
          <TouchableOpacity
            key={item}
            style={[
              styles.option,
              answers.style === item && styles.selected
            ]}
            onPress={() => selectOption("style", item)}
          >
            <Text style={styles.optionText}>{item}</Text>
          </TouchableOpacity>
        ))}
      </View>

    <TouchableOpacity style={styles.button} onPress={generateOutfit}>
    <Text style={styles.buttonText}>Generate Outfit</Text>
    </TouchableOpacity>

      {outfit && (
        <View style={styles.resultCard}>

          <Text style={styles.resultTitle}>Your Outfit</Text>

          {outfit.top && (
            <View style={styles.item}>
              <Image source={{ uri: outfit.top.image }} style={styles.image}/>
              <Text style={styles.itemText}>{outfit.top.name}</Text>
            </View>
          )}

          {outfit.bottom && (
            <View style={styles.item}>
              <Image source={{ uri: outfit.bottom.image }} style={styles.image}/>
              <Text style={styles.itemText}>{outfit.bottom.name}</Text>
            </View>
          )}

          {outfit.footwear && (
            <View style={styles.item}>
            <Image source={{ uri: outfit.footwear.image }} style={styles.image}/>
            <Text style={styles.itemText}>{outfit.footwear.name}</Text>
            </View>
            )}

        {outfit.accessory && (
        <View style={styles.item}>
        <Image source={{ uri: outfit.accessory.image }} style={styles.image}/>
        <Text style={styles.itemText}>{outfit.accessory.name}</Text>
        </View>
        )}

        {outfit.outerwear && (
        <View style={styles.item}>
        <Image source={{ uri: outfit.outerwear.image }} style={styles.image}/>
        <Text style={styles.itemText}>{outfit.outerwear.name}</Text>
        </View>
        )}
        </View>
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: "#0a0a0a",
    padding: 20,
    position: "relative",
  },
  backBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  backIcon: { color: "#fff", fontSize: 16, fontWeight: "800" },

  title: {
    fontSize: 32,
    color: "#fff",
    fontWeight: "900",
    marginBottom: 8,
    letterSpacing: -0.5
  },

  subtitle: {
    fontSize: 14,
    color: "#ff9933",
    fontWeight: "600",
    marginBottom: 24
  },

  label: {
    color: "#fff",
    marginTop: 20,
    marginBottom: 12,
    fontSize: 15,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5
  },

  input: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 14,
    color: "#fff",
    fontSize: 15,
    borderWidth: 1.5,
    borderColor: "#ff7a00",
    marginBottom: 8
  },

  options: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 16,
    gap: 10
  },

  option: {
    backgroundColor: "#1a1a1a",
    padding: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#333",
    justifyContent: "center",
    alignItems: "center"
  },

  selected: {
    backgroundColor: "#ff7a00",
    borderColor: "#ff7a00"
  },

  optionText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14
  },

  button: {
    backgroundColor: "#ff7a00",
    padding: 18,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 28,
    marginBottom: 40,
    shadowColor: "#ff7a00",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8
  },

  buttonText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 16,
    letterSpacing: 0.5
  },

  resultCard: {
    marginTop: 32,
    backgroundColor: "#1a1a1a",
    padding: 24,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#ff7a00",
    marginBottom: 40
  },

  resultTitle: {
    color: "#ff9933",
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 20,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },

  item: {
    marginBottom: 20,
    backgroundColor: "#0a0a0a",
    padding: 16,
    borderRadius: 12,
    alignItems: "center"
  },

  image: {
    width: 140,
    height: 140,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "#ff7a00"
  },

  itemText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center"
  }

});


