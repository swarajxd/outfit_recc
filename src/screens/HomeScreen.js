// src/screens/HomeScreen.js

import React, { useState, useEffect } from "react";
import { View, Text, Button, StyleSheet } from "react-native";
import { useUser, useClerk } from "@clerk/clerk-expo";

import {
  FALLBACK_WARDROBE,
  buildWardrobeFromItems,
} from "../utils/outfitEngine";

const SERVER_BASE = "http://localhost:4000";

export default function HomeScreen() {
  const { user } = useUser();
  const { signOut } = useClerk();

  const [items, setItems] = useState([]);

  // Fetch wardrobe items
  useEffect(() => {
    if (!user?.id) return;

    fetch(`${SERVER_BASE}/api/profile/segmented/${user.id}`)
      .then((res) => res.json())
      .then((data) => setItems(data.items || []))
      .catch((err) => console.log("Wardrobe fetch error:", err));
  }, [user]);

  // Convert wardrobe items to outfit engine format
  const userWardrobe =
    items.length > 0
      ? buildWardrobeFromItems(items)
      : FALLBACK_WARDROBE;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        Welcome{user?.firstName ? `, ${user.firstName}` : ""}!
      </Text>

      <Text style={{ marginBottom: 16 }}>
        This is your protected home screen.
      </Text>

      <Text>Wardrobe Items Loaded: {items.length}</Text>

      <Button title="Sign out" onPress={() => signOut()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 8 },
});