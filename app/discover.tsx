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

  // Responsive column calculation for Pinterest-style masonry
  let numColumns: number;
  let columnWidth: number;

  if (width > 1400) {
    numColumns = 5;
    columnWidth = (width - 80) / 5 - 12;
  } else if (width > 1000) {
    numColumns = 4;
    columnWidth = (width - 80) / 4 - 12;
  } else if (width > 600) {
    numColumns = 3;
    columnWidth = (width - 64) / 3 - 12;
  } else {
    numColumns = 2;
    columnWidth = (width - 32) / 2 - 10;
  }

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
        <View style={styles.header}>
          <View>
            <View style={styles.titleWrapper}>
              <View style={styles.titleDot}></View>
              <View>
                <View style={styles.titleLine1}></View>
                <View style={styles.titleLine2}></View>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.masonryContainer}>
          {columns.map((column, columnIndex) => (
            <View key={columnIndex} style={{ flex: 1 }}>
              {column.map((item) => (
                <View key={item.id} style={{ marginBottom: 14 }}>
                  <PostCard
                    post={item}
                    onPress={(p) =>
                      router.push(`/post/${encodeURIComponent(p.id)}`)
                    }
                  />
                </View>
              ))}
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
    backgroundColor: "#0a0a0a",
  },
  scroll: {
    paddingBottom: 120,
  },
  header: {
    paddingHorizontal: 32,
    paddingTop: 32,
    paddingBottom: 20,
  },
  titleWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  titleDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#fff",
  },
  titleLine1: {
    width: 140,
    height: 2.5,
    backgroundColor: "#fff",
    marginBottom: 8,
  },
  titleLine2: {
    width: 90,
    height: 2,
    backgroundColor: "#444",
  },
  masonryContainer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 14,
  },
});
