import { useAuth, useUser } from "@clerk/clerk-expo"; // useAuth may provide a method to get token
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
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
import { SERVER_BASE } from "./utils/config";

export default function CreatePostScreen() {
  const router = useRouter();
  const { user } = useUser();
  const { getToken } = useAuth();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState("");
  const [tagsText, setTagsText] = useState("");

  async function pickImage() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (!res.canceled) setImageUri(res.assets?.[0]?.uri || null);
  }

  async function uploadToCloudinary(localUri: string) {
    // 1) request signature from server
    const signResp = await fetch(`${SERVER_BASE}/api/cloudinary-sign`, {
      method: "POST",
    });
    if (!signResp.ok) throw new Error("failed to get signature");
    const signJson = await signResp.json();
    const { signature, timestamp, api_key, cloud_name } = signJson;

    // 2) build form data for Cloudinary
    const data = new FormData();
    if (Platform.OS === "web") {
      // On web we can safely fetch as blob
      const fetched = await fetch(localUri);
      const blob = await fetched.blob();
      if (!blob || (blob as any).size === 0) {
        throw new Error("Empty file");
      }
      data.append("file", blob as any);
    } else {
      // On native we must send { uri, name, type }
      const uri = localUri;
      const ext = uri.split(".").pop() || "jpg";
      const mime =
        ext === "jpg" || ext === "jpeg" ? "image/jpeg" : `image/${ext}`;
      const file: any = {
        uri,
        name: `upload.${ext}`,
        type: mime,
      };
      data.append("file", file);
    }

    data.append("api_key", api_key);
    data.append("timestamp", String(timestamp));
    data.append("signature", signature);
    data.append("folder", "posts");

    // 3) upload to Cloudinary
    const url = `https://api.cloudinary.com/v1_1/${cloud_name}/image/upload`;
    const uploadResp = await fetch(url, { method: "POST", body: data });
    const uploadJson = await uploadResp.json();
    if (!uploadResp.ok) {
      throw new Error(uploadJson.error?.message || "upload failed");
    }
    return uploadJson;
  }

  async function handleSubmit() {
    if (!imageUri) return Alert.alert("Pick an image first");
    if (!user?.id) return Alert.alert("Please sign in");

    setUploading(true);
    try {
      // 1) Upload to Cloudinary
      const cloudResp = await uploadToCloudinary(imageUri);
      const imageUrl = cloudResp.secure_url || cloudResp.url;
      const publicId = cloudResp.public_id;

      // 2) Tags: user input only (server will generate rich outfit_data + vectors)
      const userTags = tagsText
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      const tags = [...new Set(userTags)];

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
      style={{ flex: 1, backgroundColor: "#000" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.backIcon}>←</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Create Post</Text>
            <View style={{ width: 34 }} />
          </View>

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
                  Uploading…
                </Text>
              </View>
            ) : (
              <Text style={styles.btnText}>Upload</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 40,
    justifyContent: "center",
    backgroundColor: "#000",
  },
  card: {
    borderRadius: 18,
    padding: 18,
    backgroundColor: "#050505",
    borderWidth: 1,
    borderColor: "#1f2933",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  backIcon: { color: "#fff", fontSize: 16, fontWeight: "800" },
  title: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  imageBox: {
    height: 190,
    borderRadius: 12,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: 12,
  },
  preview: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
  },
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
