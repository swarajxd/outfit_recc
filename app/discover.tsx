// app/discover.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, Dimensions, RefreshControl, ActivityIndicator, StyleSheet } from "react-native";
import SearchBar from "../src/components/SearchBar";
import PostCard from "../src/components/PostCard";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { useUser } from "@clerk/clerk-expo";

const SCREEN_WIDTH = Dimensions.get("window").width;
const NUM_COLUMNS = 2;
const HORIZONTAL_PADDING = 16; // matches SearchBar marginHorizontal
const SAFE_GAP_PER_ITEM = 16; // margin around card

export default function Discover() {
  const router = useRouter();
  const { user } = useUser();

  const [query, setQuery] = useState("");
  const [posts, setPosts] = useState<any[]>([]);
  const [page, setPage] = useState(0);
  const LIMIT = 24;
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const API_BASE = (Constants.expoConfig?.extra as any)?.VITE_API_BASE_URL ?? "http://localhost:7000";

  // columnWidth calc (account for margins)
  const columnWidth = useMemo(() => {
    const totalHorizontal = HORIZONTAL_PADDING * 2 + SAFE_GAP_PER_ITEM * (NUM_COLUMNS * 2);
    return Math.floor((SCREEN_WIDTH - totalHorizontal) / NUM_COLUMNS);
  }, []);

  const fetchPosts = useCallback(async (reset = false, q = query) => {
    try {
      if (loading) return;
      setLoading(true);
      const offset = reset ? 0 : page * LIMIT;
      const url = new URL(`${API_BASE}/api/posts`);
      url.searchParams.set("limit", String(LIMIT));
      url.searchParams.set("offset", String(offset));
      if (q) url.searchParams.set("q", q);
      // optionally pass user id for personalised feed
      if (user?.id) url.searchParams.set("userId", user.id);

      const res = await fetch(url.toString());
      const json = await res.json();
      if (!res.ok) {
        console.warn("discover fetch failed", json);
        // fallback to empty
        setHasMore(false);
        setLoading(false);
        return;
      }

      const incoming = Array.isArray(json.posts) ? json.posts : (Array.isArray(json) ? json : json.items ?? []);
      if (reset) {
        setPosts(incoming);
        setPage(1);
      } else {
        setPosts(prev => [...prev, ...incoming]);
        setPage(p => p + 1);
      }
      setHasMore(incoming.length >= LIMIT);
    } catch (err) {
      console.error("discover fetch error", err);
      setHasMore(false);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [API_BASE, LIMIT, page, query, user?.id, loading]);

  useEffect(() => {
    // first load
    fetchPosts(true, "");
  }, []);

  // search effect: when query changes, reset feed
  useEffect(() => {
    const timeout = setTimeout(() => {
      setRefreshing(true);
      fetchPosts(true, query);
    }, 350);
    return () => clearTimeout(timeout);
  }, [query]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPosts(true, query);
  };

  const loadMore = () => {
    if (!hasMore || loading) return;
    fetchPosts(false, query);
  };

  const renderItem = ({ item }: { item: any }) => {
    // adapt item to Post type
    const post = {
      id: String(item.id ?? item._id),
      image: item.image_url || item.image || item.imagePath || item.imageUrl,
      author: item.author || item.username || item.user_name || item.userId,
      likes: item.likes ?? item.likeCount ?? 0,
      liked: item.liked ?? false,
      saves: item.saves ?? item.saves_count ?? 0,
      saved: item.isSaved ?? item.saved ?? false,
      caption: item.caption ?? "",
    };

    return (
      <PostCard
        post={post}
        columnWidth={columnWidth}
        onPress={(p) => {
          // navigate to a detail screen (implement as you like)
          router.push(`/post/${encodeURIComponent(p.id)}`);
        }}
        onLike={async (postId, newLiked) => {
          // optimistic handled in card; call backend
          try {
            await fetch(`${API_BASE}/api/interactions/${newLiked ? "like" : "unlike"}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userId: user?.id, postId }),
            });
          } catch (e) {
            console.warn("like api failed", e);
            throw e;
          }
        }}
        onSave={async (postId, newSaved) => {
          try {
            await fetch(`${API_BASE}/api/interactions/${newSaved ? "save" : "unsave"}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userId: user?.id, postId }),
            });
          } catch (e) {
            console.warn("save api failed", e);
            throw e;
          }
        }}
      />
    );
  };

  return (
    <View style={styles.page}>
      <SearchBar value={query} onChange={setQuery} />

      <FlatList
        data={posts}
        renderItem={renderItem}
        keyExtractor={(item) => String(item.id ?? item._id)}
        numColumns={NUM_COLUMNS}
        contentContainerStyle={{ paddingBottom: 120, paddingTop: 6 }}
        onEndReached={loadMore}
        onEndReachedThreshold={0.8}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
        ListEmptyComponent={() => (
          <View style={{ marginTop: 48, alignItems: "center" }}>
            {loading ? <ActivityIndicator /> : <Text style={{ color: "#888" }}>No posts found.</Text>}
          </View>
        )}
        ListFooterComponent={() => (
          <View style={{ padding: 16 }}>
            {loading ? <ActivityIndicator /> : hasMore ? <Text style={{ color: "#888", textAlign: "center" }}>Load more</Text> : null}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#000",
    paddingTop: 8,
  },
});
