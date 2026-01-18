// src/components/PostCard.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { AntDesign, Feather } from "@expo/vector-icons";

type Post = {
  id: string;
  image: string;
  author?: string;
  avatar?: string | null;
  likes?: number;
  liked?: boolean;
  saves?: number;
  saved?: boolean;
  caption?: string;
};

type Props = {
  post: Post;
  columnWidth: number; // provided by parent
  onLike?: (postId: string, newLiked: boolean) => Promise<void> | void;
  onSave?: (postId: string, newSaved: boolean) => Promise<void> | void;
  onPress?: (post: Post) => void;
};

export default function PostCard({ post, columnWidth, onLike, onSave, onPress }: Props) {
  const [height, setHeight] = useState<number | null>(null);
  const [loadingImage, setLoadingImage] = useState(true);

  const [liked, setLiked] = useState(Boolean(post.liked));
  const [likesCount, setLikesCount] = useState(typeof post.likes === "number" ? post.likes : 0);

  const [saved, setSaved] = useState(Boolean(post.saved));
  const [savesCount, setSavesCount] = useState(typeof post.saves === "number" ? post.saves : 0);

  useEffect(() => {
    setLiked(Boolean(post.liked));
    setLikesCount(typeof post.likes === "number" ? post.likes : likesCount);
  }, [post.liked, post.likes]);

  useEffect(() => {
    setSaved(Boolean(post.saved));
    setSavesCount(typeof post.saves === "number" ? post.saves : savesCount);
  }, [post.saved, post.saves]);

  // compute height from image intrinsic ratio
  useEffect(() => {
    let active = true;
    if (!post.image) {
      setHeight(columnWidth * 1.2);
      setLoadingImage(false);
      return;
    }

    // Image.getSize works with remote urls
    Image.getSize(
      post.image,
      (w, h) => {
        if (!active) return;
        const ratio = h / w;
        const targetH = Math.max(120, Math.round(columnWidth * ratio));
        setHeight(targetH);
        setLoadingImage(false);
      },
      () => {
        if (!active) return;
        // fallback fixed height
        setHeight(Math.round(columnWidth * 1.2));
        setLoadingImage(false);
      }
    );

    return () => {
      active = false;
    };
  }, [post.image, columnWidth]);

  async function handleLike() {
    const newLiked = !liked;
    // optimistic
    setLiked(newLiked);
    setLikesCount(c => (newLiked ? c + 1 : Math.max(0, c - 1)));
    try {
      if (onLike) await onLike(post.id, newLiked);
    } catch (err) {
      // revert on error
      setLiked(s => !s);
      setLikesCount(c => (newLiked ? Math.max(0, c - 1) : c + 1));
      console.warn("like failed", err);
    }
  }

  async function handleSave() {
    const newSaved = !saved;
    setSaved(newSaved);
    setSavesCount(c => (newSaved ? c + 1 : Math.max(0, c - 1)));
    try {
      if (onSave) await onSave(post.id, newSaved);
    } catch (err) {
      setSaved(s => !s);
      setSavesCount(c => (newSaved ? Math.max(0, c - 1) : c + 1));
      console.warn("save failed", err);
    }
  }

  return (
    <View style={[styles.card, { width: columnWidth }]}>
      <TouchableOpacity activeOpacity={0.9} onPress={() => onPress?.(post)}>
        <View style={{ backgroundColor: "#000", borderRadius: 12, overflow: "hidden" }}>
          {height ? (
            <>
              <Image
                source={{ uri: post.image }}
                style={{ width: columnWidth, height, resizeMode: "cover", backgroundColor: "#111" }}
                onLoadStart={() => setLoadingImage(true)}
                onLoadEnd={() => setLoadingImage(false)}
              />
              {loadingImage && (
                <View style={[styles.imageLoader, { width: columnWidth, height }]}>
                  <ActivityIndicator />
                </View>
              )}
            </>
          ) : (
            <View style={[{ width: columnWidth, height: 180, backgroundColor: "#111", justifyContent: "center", alignItems: "center" }]}>
              <ActivityIndicator />
            </View>
          )}
        </View>
      </TouchableOpacity>

      <View style={styles.footer}>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={styles.authorText}>
            {post.author ?? "Unknown"}
          </Text>
          {post.caption ? <Text numberOfLines={2} style={styles.captionText}>{post.caption}</Text> : null}
        </View>

        <View style={styles.actionColumn}>
          <TouchableOpacity onPress={handleLike} style={styles.iconBtn} accessibilityRole="button">
            <AntDesign name={liked ? "heart" : "hearto"} size={20} color={liked ? "#ff2d55" : "#fff"} />
            <Text style={styles.countText}>{likesCount}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleSave} style={[styles.iconBtn, { marginTop: 8 }]} accessibilityRole="button">
            <Feather name={saved ? "bookmark" : "bookmark"} size={18} color={saved ? "#f08a2e" : "#fff"} />
            <Text style={styles.countText}>{savesCount}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    margin: 8,
  },
  footer: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  authorText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
  captionText: {
    color: "#cfcfcf",
    fontSize: 12,
    marginTop: 2,
  },
  actionColumn: {
    marginLeft: 8,
    justifyContent: "flex-start",
    alignItems: "center",
  },
  iconBtn: {
    alignItems: "center",
  },
  countText: {
    color: "#ddd",
    fontSize: 11,
    marginTop: 2,
  },
  imageLoader: {
    position: "absolute",
    left: 0,
    top: 0,
    justifyContent: "center",
    alignItems: "center",
  },
});
