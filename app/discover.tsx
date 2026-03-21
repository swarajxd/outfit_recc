// app/discover.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import SearchBar from "../src/components/SearchBar";
import PostCard from "../src/components/PostCard";
import { supabase } from "../lib/supabase";

type DiscoverPost = {
  id: string;
  image: { uri: string };
  author: string | null;
  caption: string | null;
};

export default function Discover() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState("");
  const [posts, setPosts] = useState<DiscoverPost[]>([]);
  const [loading, setLoading] = useState(true);

  const columnWidth = width > 1400 ? 260 : width > 900 ? 220 : 180;

  useEffect(() => {
    let cancelled = false;
    async function fetchPosts() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("posts")
          .select("id,image_url,owner_clerk_id,caption,created_at")
          .order("created_at", { ascending: false })
          .limit(50);
        if (error) throw error;
        if (cancelled) return;

        const mapped: DiscoverPost[] =
          (data ?? []).map((p: any) => ({
            id: String(p.id),
            image: { uri: String(p.image_url) },
            author: p.owner_clerk_id ?? null,
            caption: p.caption ?? null,
          })) ?? [];
        setPosts(mapped);
      } catch (e) {
        console.error("discover fetch posts error", e);
        if (!cancelled) setPosts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchPosts();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredPosts = posts.filter((post) =>
    (post.caption || "").toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <View style={styles.page}>
      <SearchBar value={query} onChange={setQuery} />

      <ScrollView contentContainerStyle={styles.scroll}>
        {loading ? (
          <View style={{ paddingTop: 40, alignItems: "center" }}>
            <ActivityIndicator color="#fff" />
          </View>
        ) : (
          <View style={styles.grid}>
            {filteredPosts.map((item) => (
              <View key={item.id} style={{ width: columnWidth }}>
                <PostCard
                  post={item}
                  onPress={(p: { id: string }) =>
                    router.push(`/post/${encodeURIComponent(p.id)}`)
                  }
                />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#0b0b0f",
  },
  scroll: {
    paddingTop: 30,
    paddingHorizontal: 32,
    paddingBottom: 120,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 22,
  },
});
