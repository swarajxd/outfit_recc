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
import { useLocalSearchParams } from "expo-router";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
const PRIMARY = "#FF6B00";
const BG = "#000000";
const [message, setMessage] = useState("");
type Outfit = {
  top?: any;
  bottom?: any;
  footwear?: any;
  outerwear?: any;
  accessory?: any;
};
import { forceRegenerateOutfit } from "../utils/outfitEngine";

export default function OutfitMaker() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
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
    let missingItems = false;

if (filteredWardrobe.tops.length === 0) missingItems = true;
if (filteredWardrobe.bottoms.length === 0) missingItems = true;
if (filteredWardrobe.footwear.length === 0) missingItems = true;
if (missingItems) {
  setMessage(
    "You don’t have items exactly matching this request in your wardrobe. Showing the closest outfit instead."
  );
} else {
  setMessage("");
}

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
const renderItem = (item:any)=>(
<View style={styles.item}>
<Image source={{uri:item.image}} style={styles.image}/>
<Text style={styles.itemText}>{item.name}</Text>
</View>
)
return (
<View style={[styles.container,{paddingTop: insets.top}]}>

{/* HEADER */}
<View style={styles.header}>
<Text style={styles.logo}>
FIT<Text style={{color:PRIMARY}}>SENSE</Text>
</Text>
</View>

<ScrollView
showsVerticalScrollIndicator={false}
contentContainerStyle={{paddingBottom:120}}
>

{/* GLASS PANEL */}
<View style={styles.panel}>

<Text style={styles.title}>Outfit Maker</Text>
<Text style={styles.subtitle}>AI generates outfits from your wardrobe</Text>

<Text style={styles.label}>Describe your vision</Text>

<TextInput
placeholder="e.g. summer brunch outfit"
placeholderTextColor="#777"
style={styles.input}
value={prompt}
onChangeText={setPrompt}
/>

<Text style={styles.label}>Occasion</Text>

<View style={styles.options}>
{["Casual","Formal","Party","Gym"].map(item=>(
<TouchableOpacity
key={item}
style={[
styles.option,
answers.occasion===item && styles.selected
]}
onPress={()=>selectOption("occasion",item)}
>
<Text style={styles.optionText}>{item}</Text>
</TouchableOpacity>
))}
</View>

<Text style={styles.label}>Weather</Text>

<View style={styles.options}>
{["Hot","Moderate","Cold","Rainy"].map(item=>(
<TouchableOpacity
key={item}
style={[
styles.option,
answers.weather===item && styles.selected
]}
onPress={()=>selectOption("weather",item)}
>
<Text style={styles.optionText}>{item}</Text>
</TouchableOpacity>
))}
</View>

<Text style={styles.label}>Style</Text>

<View style={styles.options}>
{["Minimal","Trendy","Sporty","Streetwear"].map(item=>(
<TouchableOpacity
key={item}
style={[
styles.option,
answers.style===item && styles.selected
]}
onPress={()=>selectOption("style",item)}
>
<Text style={styles.optionText}>{item}</Text>
</TouchableOpacity>
))}
</View>

<TouchableOpacity style={styles.button} onPress={generateOutfit}>
<Text style={styles.buttonText}>Generate Outfit</Text>
</TouchableOpacity>

</View>

{/* RESULT */}
{message !== "" && (
  <View style={styles.warningBox}>
    <Text style={styles.warningText}>{message}</Text>
  </View>
)}
{outfit && (
<View style={styles.resultCard}>

<Text style={styles.resultTitle}>Generated Outfit</Text>

{outfit.top && renderItem(outfit.top)}
{outfit.bottom && renderItem(outfit.bottom)}
{outfit.footwear && renderItem(outfit.footwear)}
{outfit.accessory && renderItem(outfit.accessory)}
{outfit.outerwear && renderItem(outfit.outerwear)}

</View>
)}

</ScrollView>



</View>
)
}

const styles = StyleSheet.create({

container:{
flex:1,
backgroundColor:BG
},

header:{
padding:20,
alignItems:"center"
},

logo:{
fontSize:22,
fontWeight:"800",
color:"#fff",
letterSpacing:3
},

panel:{
marginHorizontal:16,
backgroundColor:"rgba(255,255,255,0.04)",
borderRadius:20,
padding:20,
borderWidth:1,
borderColor:"rgba(255,255,255,0.08)"
},

title:{
fontSize:24,
fontWeight:"800",
color:"#fff"
},

subtitle:{
color:"rgba(255,255,255,0.5)",
marginBottom:20
},

label:{
color:"#fff",
marginTop:20,
marginBottom:10,
fontWeight:"700"
},

input:{
backgroundColor:"#1a1a1a",
borderRadius:12,
padding:14,
color:"#fff",
borderWidth:1,
borderColor:PRIMARY
},

options:{
flexDirection:"row",
flexWrap:"wrap",
gap:10
},

option:{
backgroundColor:"#1a1a1a",
padding:10,
borderRadius:10,
borderWidth:1,
borderColor:"#333"
},

selected:{
backgroundColor:PRIMARY
},

optionText:{
color:"#fff"
},

button:{
backgroundColor:PRIMARY,
padding:16,
borderRadius:12,
alignItems:"center",
marginTop:30
},

buttonText:{
color:"#fff",
fontWeight:"800"
},

resultCard:{
margin:20,
backgroundColor:"#1a1a1a",
borderRadius:20,
padding:20
},

resultTitle:{
color:PRIMARY,
fontWeight:"800",
marginBottom:20
},

item:{
alignItems:"center",
marginBottom:20
},

image:{
width:140,
height:140,
borderRadius:10,
borderWidth:2,
borderColor:PRIMARY
},

itemText:{
color:"#fff",
fontWeight:"700"
},

navbar:{
position:"absolute",
bottom:0,
left:0,
right:0,
height:80,
backgroundColor:"#0a0a0a",
borderTopWidth:1,
borderColor:"#222",
flexDirection:"row",
justifyContent:"space-around",
alignItems:"center"
},

navIcon:{
fontSize:24,
color:"#fff"
},

warningBox:{
backgroundColor:"rgba(255,107,0,0.2)",
borderRadius:12,
padding:16,
marginHorizontal:20,
marginVertical:10,
borderWidth:1,
borderColor:PRIMARY
},

warningText:{
color:PRIMARY,
fontWeight:"600"
}

})

