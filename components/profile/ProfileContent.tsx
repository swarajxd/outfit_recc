import React, { useMemo } from "react";
import {
  View,
  Image,
  Text,
  FlatList,
  TouchableOpacity,
  Dimensions,
  ListRenderItem,
  ImageSourcePropType,
} from "react-native";
import { useRouter } from "expo-router";

interface ProfileContentProps {
  activeTab: "posts" | "wardrobe" | "outfits" | "saved";
}

interface PostItem {
  id: number;
  image: ImageSourcePropType;
  index: number;
}

interface WardrobeItem {
  id: number;
  name: string;
  image: ImageSourcePropType;
}

type ContentItem = PostItem | WardrobeItem;

/* ---------- LOCAL IMAGES ---------- */

const images: ImageSourcePropType[] = [
  require("../../assets/img1.jpg"),
  require("../../assets/img2.jpg"),
  require("../../assets/img3.jpg"),
  require("../../assets/img4.jpg"),
  require("../../assets/img5.jpg"),
  require("../../assets/img6.jpg"),
  require("../../assets/img7.jpg"),
  require("../../assets/img8.jpg"),
  require("../../assets/img9.jpg"),
  require("../../assets/img10.jpg"),
];

/* ---------- MOCK DATA ---------- */

const mockPosts: PostItem[] = images.map((img, index) => ({
  id: index + 1,
  image: img,
  index,
}));

const mockWardrobe: WardrobeItem[] = images.slice(0, 6).map((img, index) => ({
  id: index + 1,
  name: index % 2 === 0 ? "Shirt (F)" : "Pants (F)",
  image: img,
}));

export default function ProfileContent({ activeTab }: ProfileContentProps) {
  const router = useRouter();

  const screenWidth = Dimensions.get("window").width;
  const itemSize = (screenWidth - 32) / 3;

  const data: ContentItem[] = useMemo(() => {
    switch (activeTab) {
      case "posts":
      case "saved":
        return mockPosts;
      case "wardrobe":
      case "outfits":
        return mockWardrobe;
      default:
        return [];
    }
  }, [activeTab]);

  const renderItem: ListRenderItem<ContentItem> = ({
    item,
    index,
  }) => {
    const isLastColumn = (index + 1) % 3 === 0;

    // Wardrobe items (not clickable to posts)
    if ("name" in item) {
      return (
        <View
          style={{
            width: itemSize,
            marginBottom: 14,
            marginRight: isLastColumn ? 0 : 8,
          }}
        >
          <TouchableOpacity
            style={{
              width: "100%",
              height: itemSize,
              borderRadius: 12,
              overflow: "hidden",
              backgroundColor: "#111",
              marginBottom: 6,
            }}
          >
            <Image
              source={item.image}
              style={{ width: "100%", height: "100%" }}
              resizeMode="cover"
            />
          </TouchableOpacity>

          <Text
            style={{
              color: "#aaa",
              fontSize: 11,
              textAlign: "center",
            }}
          >
            {item.name}
          </Text>
        </View>
      );
    }

    // Posts → Clickable
    return (
      <TouchableOpacity
        onPress={() =>
          router.push({
            pathname: "/posts",
            params: { index: item.index.toString() },
          })
        }
        style={{
          width: itemSize,
          height: itemSize,
          marginBottom: 8,
          marginRight: isLastColumn ? 0 : 8,
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <Image
          source={item.image}
          style={{ width: "100%", height: "100%" }}
          resizeMode="cover"
        />
      </TouchableOpacity>
    );
  };

  return (
    <View
      style={{
        backgroundColor: "#000",
        flex: 1,
        paddingHorizontal: 8,
        paddingTop: 16,
      }}
    >
      <FlatList
        data={data}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        numColumns={3}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
