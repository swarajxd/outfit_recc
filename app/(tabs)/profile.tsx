import { useUser } from "@clerk/clerk-expo";
import * as ImagePicker from "expo-image-picker";
import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { v4 as uuidv4 } from "uuid";
import { SERVER_BASE } from "../utils/config";

const PRIMARY = "#FF6B00";
const BG = "#000000";
const WIDTH = Dimensions.get("window").width;
const GRID_ITEM = (WIDTH - 2) / 3;

const POST_IMAGES = [
  "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=300&q=80",
  "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=300&q=80",
  "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=300&q=80",
  "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=300&q=80",
  "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=300&q=80",
  "https://images.unsplash.com/photo-1550614000-4895a10e1bfd?w=300&q=80",
  "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=300&q=80",
  "https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?w=300&q=80",
  "https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=300&q=80",
];

const PROFILE_TABS = ["Posts", "Saved", "Wardrobe"];

// Default values for profile
const DEFAULT_NAME = "Style Enthusiast";
const DEFAULT_ROLE = "Fashion Explorer | Trend Seeker";
const DEFAULT_BIO =
  "Express your unique style and discover new fashion inspirations.";
const DEFAULT_AVATAR =
  "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&q=80";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState(0);
  const { user, isLoaded } = useUser();

  // Extract user data with defaults
  const userName =
    user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : user?.firstName || user?.lastName || DEFAULT_NAME;
  const userHandle = user?.username
    ? `@${user.username}`
    : user?.emailAddresses?.[0]?.emailAddress
      ? `@${user.emailAddresses[0].emailAddress.split("@")[0]}`
      : "@stylesense_user";
  // Prefer Cloudinary URL from unsafeMetadata, fallback to Clerk imageUrl
  const userAvatar =
    (user?.unsafeMetadata as { profileImageUrl?: string })?.profileImageUrl ||
    user?.imageUrl ||
    DEFAULT_AVATAR;

  // Edit profile state
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editRole, setEditRole] = useState("");

  // ── Wardrobe state ─────────────────────────────────────────────────────
  interface WardrobeItem {
    id: string;
    image: string;
    color?: string;
    pattern?: string;
    category?: string;
  }
  const [wardrobeItems, setWardrobeItems] = useState<WardrobeItem[]>([]);
  const [isWardrobeLoading, setIsWardrobeLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");

  // Stats state (followers / following / style score from backend)
  const [followers, setFollowers] = useState<number | null>(null);
  const [following, setFollowing] = useState<number | null>(null);
  const [styleScore, setStyleScore] = useState<number | null>(null);

  // Posts state (real backend instead of static images)
  interface PostItem {
    id: string;
    image_url: string;
    caption?: string | null;
  }
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [isPostsLoading, setIsPostsLoading] = useState(false);

  // Derive user_id from Clerk
  const userId = user?.id || "default_user";

  // ── Fetch profile stats (followers/following/style) ──────────────────────
  const fetchStats = useCallback(async () => {
    try {
      const resp = await fetch(
        `${SERVER_BASE}/api/profile/stats?user_id=${encodeURIComponent(userId)}`,
        {
          headers: {
            "X-User-Id": userId,
          },
        },
      );
      if (!resp.ok) throw new Error("Failed to fetch stats");
      const json = await resp.json();
      setFollowers(typeof json.followers === "number" ? json.followers : null);
      setFollowing(typeof json.following === "number" ? json.following : null);
      setStyleScore(
        typeof json.style_score === "number" ? json.style_score : null,
      );
    } catch (err) {
      console.warn("profile stats fetch error:", err);
      // leave defaults/nulls – UI will still show something
    }
  }, [userId]);

  useEffect(() => {
    if (isLoaded) {
      fetchStats();
    }
  }, [isLoaded, fetchStats]);

  // ── Fetch posts for profile (Supabase via Node) ──────────────────────────
  const fetchPosts = useCallback(async () => {
    setIsPostsLoading(true);
    try {
      const resp = await fetch(
        `${SERVER_BASE}/api/profile/posts?user_id=${encodeURIComponent(userId)}`,
        {
          headers: {
            "X-User-Id": userId,
          },
        },
      );
      if (!resp.ok) throw new Error("Failed to fetch posts");
      const json = await resp.json();
      const items: PostItem[] = (json.posts || []).map((p: any) => ({
        id: String(p.id ?? uuidv4()),
        image_url: p.image_url,
        caption: p.caption ?? null,
      }));
      setPosts(items);
    } catch (err) {
      console.warn("profile posts fetch error:", err);
    } finally {
      setIsPostsLoading(false);
    }
  }, [userId]);

  // Load posts when tab switches to "Posts"
  useEffect(() => {
    if (activeTab === 0) {
      fetchPosts();
    }
  }, [activeTab, fetchPosts]);

  // ── Fetch wardrobe items (segmented images from uploads dir) ───────────
  const fetchWardrobe = useCallback(async () => {
    setIsWardrobeLoading(true);
    try {
      const resp = await fetch(
        `${SERVER_BASE}/api/profile/wardrobe/${encodeURIComponent(userId)}`,
      );
      if (!resp.ok) throw new Error("Failed to fetch wardrobe");
      const json = await resp.json();

      const w = json?.wardrobe || {};
      const fetched: WardrobeItem[] = [];
      for (const key of Object.keys(w)) {
        const arr = Array.isArray(w[key]) ? w[key] : [];
        for (const item of arr) {
          fetched.push({
            id: item.id || uuidv4(),
            image: item.image,
            category: item.category || key.replace(/s$/, "") || "",
          });
        }
      }
      setWardrobeItems(fetched);
    } catch (err) {
      console.warn("wardrobe fetch error:", err);
    } finally {
      setIsWardrobeLoading(false);
    }
  }, [userId]);

  // Load wardrobe when tab switches to "Wardrobe"
  useEffect(() => {
    if (activeTab === 2) {
      fetchWardrobe();
    }
  }, [activeTab, fetchWardrobe]);

  // ── Upload image to wardrobe pipeline ──────────────────────────────────
  const uploadToWardrobe = async () => {
    const permResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permResult.granted) {
      Alert.alert(
        "Permission Required",
        "Allow access to your photo library to add wardrobe items.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 0.9,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setIsUploading(true);
    setUploadProgress("Uploading image…");

    try {
      // 1) Upload to server → Python pipeline
      const formData = new FormData();
      if (Platform.OS === "web") {
        const blob = await (await fetch(asset.uri)).blob();
        formData.append("image", blob, "wardrobe.jpg");
      } else {
        formData.append("image", {
          uri: asset.uri,
          type: "image/jpeg",
          name: "wardrobe.jpg",
        } as any);
      }
      formData.append("user_id", userId);

      const uploadResp = await fetch(
        `${SERVER_BASE}/api/profile/upload-wardrobe`,
        { method: "POST", body: formData },
      );
      if (!uploadResp.ok) throw new Error("Upload failed");
      const uploadJson = await uploadResp.json();
      const jobId = uploadJson.job_id;
      if (!jobId) throw new Error("No job_id returned");

      // 2) Poll job status
      setUploadProgress("Processing outfit…");
      let attempts = 0;
      const maxAttempts = 120; // ~2 min with 1s interval
      const poll = async (): Promise<void> => {
        attempts++;
        const statusResp = await fetch(
          `${SERVER_BASE}/api/profile/job/${encodeURIComponent(jobId)}`,
        );
        const statusJson = await statusResp.json();

        if (statusJson.status === "completed") {
          setUploadProgress("");
          setIsUploading(false);
          Alert.alert(
            "Success",
            `${statusJson.results?.items_total || 0} item(s) added to your wardrobe!`,
          );
          fetchWardrobe();
          return;
        }
        if (statusJson.status === "error") {
          throw new Error(statusJson.error || "Processing failed");
        }
        if (attempts >= maxAttempts) {
          throw new Error("Processing timed out");
        }
        await new Promise((r) => setTimeout(r, 1000));
        return poll();
      };
      await poll();
    } catch (err: any) {
      console.error("wardrobe upload error:", err);
      Alert.alert("Error", err.message || "Failed to process image");
      setIsUploading(false);
      setUploadProgress("");
    }
  };
  const [editBio, setEditBio] = useState("");
  const [editAvatarUri, setEditAvatarUri] = useState<string | null>(null);

  // Open edit modal and populate with current values
  const openEditModal = () => {
    setEditFirstName(user?.firstName || "");
    setEditLastName(user?.lastName || "");
    setEditUsername(user?.username || "");
    setEditRole(
      (user?.publicMetadata as { role?: string })?.role ||
        (user?.unsafeMetadata as { role?: string })?.role ||
        "",
    );
    setEditBio(
      (user?.publicMetadata as { bio?: string })?.bio ||
        (user?.unsafeMetadata as { bio?: string })?.bio ||
        "",
    );
    setEditAvatarUri(null);
    setIsEditModalVisible(true);
  };

  // Pick image from gallery
  const pickImage = async () => {
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert(
        "Permission Required",
        "Please allow access to your photo library to change your profile picture.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setEditAvatarUri(result.assets[0].uri);
    }
  };

  // Upload image to Cloudinary
  const uploadToCloudinary = async (
    localUri: string,
  ): Promise<{ secure_url: string; public_id: string }> => {
    // 1) Request signature from server with folder parameter
    const signResp = await fetch(`${SERVER_BASE}/api/cloudinary-sign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder: "profile_images" }),
    });
    if (!signResp.ok) throw new Error("Failed to get Cloudinary signature");
    const signJson = await signResp.json();
    const { signature, timestamp, api_key, cloud_name, folder } = signJson;

    // 2) Build form data for Cloudinary
    const filename = `profile_${uuidv4()}.jpg`;
    const data = new FormData();

    if (Platform.OS === "web") {
      // For web: fetch blob and append
      const response = await fetch(localUri);
      const blob = await response.blob();
      data.append("file", blob, filename);
    } else {
      // For React Native mobile: use uri/type/name object
      data.append("file", {
        uri: localUri,
        type: "image/jpeg",
        name: filename,
      } as any);
    }

    data.append("api_key", api_key);
    data.append("timestamp", String(timestamp));
    data.append("signature", signature);
    data.append("folder", folder);

    // 3) Upload to Cloudinary
    const url = `https://api.cloudinary.com/v1_1/${cloud_name}/image/upload`;
    const uploadResp = await fetch(url, { method: "POST", body: data });
    const uploadJson = await uploadResp.json();
    if (!uploadResp.ok) {
      throw new Error(uploadJson.error?.message || "Cloudinary upload failed");
    }
    return uploadJson;
  };

  // Save profile changes
  const saveProfile = async () => {
    if (!user) return;

    setIsSaving(true);
    try {
      let cloudinaryImageUrl: string | null = null;

      // Upload profile image to Cloudinary first if changed
      if (editAvatarUri) {
        console.log("Uploading to Cloudinary:", editAvatarUri);
        const cloudinaryResult = await uploadToCloudinary(editAvatarUri);
        cloudinaryImageUrl = cloudinaryResult.secure_url;
        console.log("Cloudinary upload success:", cloudinaryImageUrl);
      }

      // Update basic info
      await user.update({
        firstName: editFirstName || undefined,
        lastName: editLastName || undefined,
        username: editUsername || undefined,
      });

      // Update unsafeMetadata with role, bio, and cloudinary image URL
      await user.update({
        unsafeMetadata: {
          ...user.unsafeMetadata,
          role: editRole,
          bio: editBio,
          ...(cloudinaryImageUrl
            ? { profileImageUrl: cloudinaryImageUrl }
            : {}),
        },
      });

      // Also set the profile image in Clerk for native imageUrl support
      if (editAvatarUri) {
        try {
          const response = await fetch(editAvatarUri);
          const blob = await response.blob();
          // Create a File-like object for Clerk
          const file = new File([blob], `profile_${Date.now()}.jpg`, {
            type: "image/jpeg",
          });
          await user.setProfileImage({ file });
        } catch (clerkImageError) {
          // Cloudinary URL is already saved, so Clerk image failure is not critical
          console.warn(
            "Clerk profile image update failed, using Cloudinary URL:",
            clerkImageError,
          );
        }
      }

      Alert.alert("Success", "Profile updated successfully!");
      setIsEditModalVisible(false);
    } catch (error: any) {
      console.error("Error updating profile:", error);
      Alert.alert(
        "Error",
        error?.errors?.[0]?.message ||
          "Failed to update profile. Please try again.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Get role/bio from unsafeMetadata as fallback
  const displayRole =
    (user?.publicMetadata as { role?: string })?.role ||
    (user?.unsafeMetadata as { role?: string })?.role ||
    DEFAULT_ROLE;
  const displayBio =
    (user?.publicMetadata as { bio?: string })?.bio ||
    (user?.unsafeMetadata as { bio?: string })?.bio ||
    DEFAULT_BIO;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Top Bar */}
        <View style={styles.topBar}>
          <Text style={styles.topBarHandle}>{userHandle}</Text>
        </View>

        {/* Avatar */}
        <View style={styles.heroSection}>
          <View style={styles.avatarWrapper}>
            <View style={styles.avatarGlow} />
            <View style={styles.avatarBorder}>
              <Image
                source={{
                  uri: userAvatar,
                }}
                style={styles.avatarImage}
              />
            </View>
            <View style={styles.verifiedBadge}>
              <Text style={{ color: "#000", fontSize: 10 }}>✓</Text>
            </View>
          </View>

          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{userName}</Text>
            <Text style={styles.profileRole}>{displayRole}</Text>
            <Text style={styles.profileBio}>{displayBio}</Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.editBtn} onPress={openEditModal}>
              <Text style={styles.editBtnText}>Edit Profile</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          {PROFILE_TABS.map((tab, i) => (
            <TouchableOpacity
              key={tab}
              style={styles.tab}
              onPress={() => setActiveTab(i)}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === i && styles.tabTextActive,
                ]}
              >
                {tab}
              </Text>
              {activeTab === i && <View style={styles.tabIndicator} />}
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab Content */}
        {activeTab === 2 ? (
          /* ── Wardrobe Tab ─────────────────────────────────────────── */
          <View style={styles.wardrobeSection}>
            {/* Wardrobe grid */}
            {isWardrobeLoading ? (
              <View style={styles.wardrobeLoader}>
                <ActivityIndicator size="large" color={PRIMARY} />
                <Text style={styles.wardrobeLoaderText}>Loading wardrobe…</Text>
              </View>
            ) : wardrobeItems.length === 0 ? (
              <View style={styles.wardrobeEmpty}>
                <Text style={styles.wardrobeEmptyIcon}>👕</Text>
                <Text style={styles.wardrobeEmptyText}>
                  Your wardrobe is empty
                </Text>
                <Text style={styles.wardrobeEmptySubtext}>
                  Tap + to upload an outfit photo and our AI will segment
                  individual items into your digital wardrobe.
                </Text>
              </View>
            ) : (
              <View style={styles.wardrobeGrid}>
                {wardrobeItems.map((item) => (
                  <View key={item.id} style={styles.wardrobeItem}>
                    <Image
                      source={{ uri: item.image }}
                      style={styles.wardrobeImage}
                      resizeMode="contain"
                    />
                    <View style={styles.wardrobeItemInfo}>
                      {item.category ? (
                        <Text style={styles.wardrobeCategory}>
                          {item.category}
                        </Text>
                      ) : null}
                      {item.color ? (
                        <Text style={styles.wardrobeAttr}>{item.color}</Text>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : (
          /* ── Posts / Saved Grid ───────────────────────────────────── */
          <View style={styles.postsGrid}>
            {isPostsLoading ? (
              <View style={{ paddingVertical: 60, alignItems: "center" }}>
                <ActivityIndicator size="large" color={PRIMARY} />
                <Text style={{ color: "rgba(255,255,255,0.5)", marginTop: 8 }}>
                  Loading posts…
                </Text>
              </View>
            ) : posts.length === 0 ? (
              <View
                style={{ paddingVertical: 60, alignItems: "center", gap: 8 }}
              >
                <Text style={{ fontSize: 40 }}>📷</Text>
                <Text
                  style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}
                >
                  No posts yet
                </Text>
                <Text
                  style={{
                    color: "rgba(255,255,255,0.5)",
                    fontSize: 13,
                    textAlign: "center",
                    paddingHorizontal: 40,
                  }}
                >
                  Create a post from the Create tab to see your looks here.
                </Text>
              </View>
            ) : (
              posts.map((post) => (
                <TouchableOpacity key={post.id} style={styles.postItem}>
                  <Image
                    source={{ uri: post.image_url }}
                    style={styles.postImage}
                  />
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        visible={isEditModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsEditModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setIsEditModalVisible(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <TouchableOpacity onPress={saveProfile} disabled={isSaving}>
              {isSaving ? (
                <ActivityIndicator size="small" color={PRIMARY} />
              ) : (
                <Text style={styles.modalSaveText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Profile Image */}
            <View style={styles.modalAvatarSection}>
              <TouchableOpacity onPress={pickImage}>
                <View style={styles.modalAvatarWrapper}>
                  <Image
                    source={{ uri: editAvatarUri || userAvatar }}
                    style={styles.modalAvatar}
                  />
                  <View style={styles.modalAvatarOverlay}>
                    <Text style={styles.modalAvatarOverlayText}>📷</Text>
                  </View>
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={pickImage}>
                <Text style={styles.changePhotoText}>Change Photo</Text>
              </TouchableOpacity>
            </View>

            {/* Form Fields */}
            <View style={styles.formSection}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>First Name</Text>
                <TextInput
                  style={styles.textInput}
                  value={editFirstName}
                  onChangeText={setEditFirstName}
                  placeholder="Enter first name"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Last Name</Text>
                <TextInput
                  style={styles.textInput}
                  value={editLastName}
                  onChangeText={setEditLastName}
                  placeholder="Enter last name"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Username</Text>
                <TextInput
                  style={styles.textInput}
                  value={editUsername}
                  onChangeText={setEditUsername}
                  placeholder="Enter username"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Role / Title</Text>
                <TextInput
                  style={styles.textInput}
                  value={editRole}
                  onChangeText={setEditRole}
                  placeholder="e.g. Fashion Enthusiast | Style Creator"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Bio</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={editBio}
                  onChangeText={setEditBio}
                  placeholder="Tell us about yourself..."
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  topBarHandle: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  topBarIcon: { color: "#fff", fontSize: 20 },
  heroSection: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 28,
  },
  avatarWrapper: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarGlow: {
    position: "absolute",
    width: 136,
    height: 136,
    borderRadius: 68,
    backgroundColor: PRIMARY,
    opacity: 0.18,
    transform: [{ scale: 1.05 }],
  },
  avatarBorder: {
    width: 124,
    height: 124,
    borderRadius: 62,
    borderWidth: 3,
    borderColor: PRIMARY,
    padding: 4,
    overflow: "hidden",
  },
  avatarImage: { width: "100%", height: "100%", borderRadius: 56 },
  verifiedBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: PRIMARY,
    borderWidth: 3,
    borderColor: BG,
    alignItems: "center",
    justifyContent: "center",
  },
  profileInfo: { alignItems: "center", marginTop: 20, gap: 4 },
  profileName: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  profileRole: {
    color: PRIMARY,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 2,
  },
  profileBio: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    maxWidth: 240,
    marginTop: 8,
  },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 20, width: "100%" },
  editBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: PRIMARY,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: "center",
  },
  editBtnText: {
    color: PRIMARY,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  insightBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#f0f0f0",
    alignItems: "center",
    justifyContent: "center",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 32,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.015)",
  },
  statItem: { alignItems: "center", flex: 1 },
  statValueRow: { flexDirection: "row", alignItems: "baseline", gap: 2 },
  statValue: { color: "#fff", fontSize: 22, fontWeight: "800" },
  statPercent: { color: `${PRIMARY}99`, fontSize: 12, fontWeight: "800" },
  statLabel: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  tabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
    position: "relative",
  },
  tabText: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 13,
    fontWeight: "700",
  },
  tabTextActive: { color: "#fff" },
  tabIndicator: {
    position: "absolute",
    bottom: 0,
    left: "25%",
    right: "25%",
    height: 2,
    backgroundColor: PRIMARY,
    borderRadius: 99,
  },
  postsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 1,
  },
  postItem: {
    width: GRID_ITEM,
    height: GRID_ITEM,
    borderWidth: 0.5,
    borderColor: BG,
  },
  postImage: { width: "100%", height: "100%", resizeMode: "cover" },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: BG,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  modalCancelText: {
    color: "#fff",
    fontSize: 16,
  },
  modalTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  modalSaveText: {
    color: PRIMARY,
    fontSize: 16,
    fontWeight: "700",
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  modalAvatarSection: {
    alignItems: "center",
    paddingVertical: 24,
  },
  modalAvatarWrapper: {
    position: "relative",
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: "hidden",
  },
  modalAvatar: {
    width: "100%",
    height: "100%",
  },
  modalAvatarOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingVertical: 8,
    alignItems: "center",
  },
  modalAvatarOverlayText: {
    fontSize: 16,
  },
  changePhotoText: {
    color: PRIMARY,
    fontSize: 14,
    fontWeight: "600",
    marginTop: 12,
  },
  formSection: {
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#fff",
    fontSize: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  textArea: {
    minHeight: 100,
    paddingTop: 14,
  },
  // ── Wardrobe styles ────────────────────────────────────────────────────
  wardrobeSection: {
    paddingHorizontal: 12,
    paddingTop: 16,
  },
  addItemBtn: {
    borderWidth: 2,
    borderColor: PRIMARY,
    borderStyle: "dashed",
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  addItemInner: {
    alignItems: "center",
    gap: 4,
  },
  addItemPlus: {
    color: PRIMARY,
    fontSize: 36,
    fontWeight: "300",
    lineHeight: 40,
  },
  addItemLabel: {
    color: PRIMARY,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  addItemProgressText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    marginTop: 4,
  },
  wardrobeLoader: {
    alignItems: "center",
    paddingVertical: 60,
    gap: 12,
  },
  wardrobeLoaderText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 13,
  },
  wardrobeEmpty: {
    alignItems: "center",
    paddingVertical: 48,
    gap: 8,
  },
  wardrobeEmptyIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  wardrobeEmptyText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  wardrobeEmptySubtext: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 13,
    textAlign: "center",
    maxWidth: 260,
    lineHeight: 20,
  },
  wardrobeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  wardrobeItem: {
    width: (WIDTH - 32 - 8) / 2,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    overflow: "hidden",
  },
  wardrobeImage: {
    width: "100%",
    height: (WIDTH - 32 - 8) / 2,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  wardrobeItemInfo: {
    padding: 10,
    gap: 2,
  },
  wardrobeCategory: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  wardrobeAttr: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 11,
    textTransform: "capitalize",
  },
});
