import { useAuth, useUser } from "@clerk/clerk-expo"; // useAuth may provide a method to get token
import Constants from "expo-constants";
import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { v4 as uuidv4 } from "uuid";

const SERVER_BASE =
  (Constants.expoConfig?.extra as any)?.API_BASE_URL ?? "http://localhost:4000";

export default function CreatePostScreen() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [caption, setCaption] = useState("");
  const [tagsText, setTagsText] = useState("");

  async function pickImage() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (!res.canceled) setImageUri(res.assets?.[0]?.uri || null);
  }

  async function runOutfitAnalysis(localUri: string): Promise<Record<string, unknown> | null> {
    // Fetch as blob so server receives actual file data (works on web + native)
    const fileResp = await fetch(localUri);
    const blob = await fileResp.blob();
    const formData = new FormData();
    formData.append("image", blob as any, "image.jpg");
    const resp = await fetch(`${SERVER_BASE}/api/outfit-analysis`, {
      method: "POST",
      body: formData,
      // Do not set Content-Type; let browser set multipart/form-data with boundary
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error || "Outfit analysis failed");
    }
    return resp.json();
  }

  async function uploadToCloudinary(localUri: string) {
    // 1) request signature from server
    const signResp = await fetch(`${SERVER_BASE}/api/cloudinary-sign`, {
      method: "POST",
    });
    if (!signResp.ok) throw new Error("failed to get signature");
    const signJson = await signResp.json();
    const { signature, timestamp, api_key, cloud_name } = signJson;

    // 2) fetch blob from local uri
    const fetched = await fetch(localUri);
    const blob = await fetched.blob();
    const filename = `${uuidv4()}.jpg`;

    // 3) build form data for Cloudinary
    const data = new FormData();
    data.append("file", blob as any); // React Native FormData may accept blob
    data.append("api_key", api_key);
    data.append("timestamp", String(timestamp));
    data.append("signature", signature);

    // optionally put image in folder 'posts'
    data.append("folder", "posts");

    // 4) upload to Cloudinary
    const url = `https://api.cloudinary.com/v1_1/${cloud_name}/image/upload`;
    const uploadResp = await fetch(url, { method: "POST", body: data });
    const uploadJson = await uploadResp.json();
    if (!uploadResp.ok)
      throw new Error(uploadJson.error?.message || "upload failed");
    // uploadJson contains: secure_url, public_id, etc.
    return uploadJson; // return object
  }

  async function handleSubmit() {
    if (!imageUri) return Alert.alert("Pick an image first");
    if (!user?.id) return Alert.alert("Please sign in");

    setUploading(true);
    try {
      // 1) Run outfit model on image (server writes result.json)
      setAnalyzing(true);
      let tagsFromAnalysis: string[] = [];
      try {
        const result = await runOutfitAnalysis(imageUri);
        if (result) {
          const wearing = (result.wearing as string[]) || [];
          const colors = (result.colors as Record<string, string[]>) || {};
          const colorList = Object.values(colors).flat();
          tagsFromAnalysis = [...wearing, ...colorList].map((s) => String(s).trim().toLowerCase()).filter(Boolean);
        }
      } catch (e) {
        console.warn("Outfit analysis failed, continuing without:", e);
      } finally {
        setAnalyzing(false);
      }

      // 2) Upload to Cloudinary
      const cloudResp = await uploadToCloudinary(imageUri);
      const imageUrl = cloudResp.secure_url || cloudResp.url;
      const publicId = cloudResp.public_id;

      // 3) Tags: user input + auto from analysis
      const userTags = tagsText
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      const tags = [...new Set([...userTags, ...tagsFromAnalysis])];

      // 3) Get Clerk token to authenticate request to server
      // In development we support dev token format: "dev:<clerkUserId>"
      let authHeader = "Bearer dev:" + user.id;
      try {
        if (getToken) {
          const token = await getToken({ template: "supabase" });
          authHeader = `Bearer ${token}`;
        }
      } catch (e) {
        // fallback to dev token
        authHeader = `Bearer dev:${user.id}`;
      }

      // 4) Create post record in Supabase
      const createResp = await fetch(`${SERVER_BASE}/api/create-post`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify({
          image_url: imageUrl,
          image_public_id: publicId,
          caption,
          tags,
        }),
      });

      const createJson = await createResp.json();
      if (!createResp.ok) {
        throw new Error(createJson.error || JSON.stringify(createJson));
      }

      Alert.alert("Success", "Post uploaded");
      // reset UI
      setImageUri(null);
      setCaption("");
      setTagsText("");
    } catch (err: any) {
      console.error(err);
      Alert.alert("Upload failed", err.message || String(err));
    } finally {
      setUploading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Create Post</Text>

        <TouchableOpacity style={styles.imageBox} onPress={pickImage}>
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={styles.preview}
              resizeMode="cover"
            />
          ) : (
            <Text style={{ color: "#fff" }}>Tap to pick an image</Text>
          )}
        </TouchableOpacity>

        <TextInput
          placeholder="Caption"
          placeholderTextColor="#aaa"
          value={caption}
          onChangeText={setCaption}
          style={styles.input}
        />
        <TextInput
          placeholder="Tags (comma separated) e.g. hoodie, black"
          placeholderTextColor="#aaa"
          value={tagsText}
          onChangeText={setTagsText}
          style={styles.input}
        />

        <TouchableOpacity
          style={styles.button}
          onPress={handleSubmit}
          disabled={uploading}
        >
          {uploading ? (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <ActivityIndicator color="#fff" />
              <Text style={[styles.btnText, { marginLeft: 8 }]}>
                {analyzing ? "Analyzing outfit…" : "Uploading…"}
              </Text>
            </View>
          ) : (
            <Text style={styles.btnText}>Upload</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingTop: 40,
    minHeight: "100%",
    backgroundColor: "#000",
  },
  title: { color: "#fff", fontSize: 20, fontWeight: "700", marginBottom: 16 },
  imageBox: {
    height: 240,
    borderRadius: 12,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: 12,
  },
  preview: { width: "100%", height: "100%" },
  input: {
    backgroundColor: "#0b0b0b",
    color: "#fff",
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#222",
  },
  button: {
    backgroundColor: "#111827",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "700" },
});
