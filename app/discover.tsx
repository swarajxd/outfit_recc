// app/discover.tsx
import React, { useMemo, useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import SearchBar from "../src/components/SearchBar";
import PostCard from "../src/components/PostCard";

export default function Discover() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState("");


  const columnWidth = width > 1400 ? 260 : width > 900 ? 220 : 180;


  const posts = useMemo(() => {
    const images = [
      require("../assets/img1.jpg"),
      require("../assets/img2.jpg"),
      require("../assets/img3.jpg"),
      require("../assets/img4.jpg"),
      require("../assets/img5.jpg"),
      require("../assets/img6.jpg"),
      require("../assets/img7.jpg"),
      require("../assets/img8.jpg"),
      require("../assets/img9.jpg"),
      require("../assets/img10.jpg"),
    ];

    return images.map((image, index) => ({
      id: `local-${index}`,
      image,
      author: `User${index + 1}`,
      caption: `Look ${index + 1}`,
    }));
  }, []);

  const filteredPosts = posts.filter((post) =>
    post.caption.toLowerCase().includes(query.toLowerCase())
  );


  // Create columns for masonry layout
  const columns = Array.from({ length: numColumns }, () => []);
  
  filteredPosts.forEach((post, index) => {
    columns[index % numColumns].push(post);
  });


  return (
    <View style={styles.page}>
      <SearchBar value={query} onChange={setQuery} />

      <ScrollView contentContainerStyle={styles.scroll}>

        <View style={styles.grid}>
          {filteredPosts.map((item) => (
            <View key={item.id} style={{ width: columnWidth }}>
              <PostCard
                post={item}
                onPress={(p) =>
                  router.push(`/post/${encodeURIComponent(p.id)}`)
                }
              />

            </View>
          ))}
        </View>
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
