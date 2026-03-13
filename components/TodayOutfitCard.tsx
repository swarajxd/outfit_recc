import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";

export default function TodayOutfitCard({ outfit, onRegenerate, loading }: any) {

  if (!outfit) {
    return (
      <View style={styles.card}>
        <Text>No outfit generated</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>

      {outfit.top && (
        <Text style={styles.item}>👕 Top: {outfit.top.name}</Text>
      )}

      {outfit.bottom && (
        <Text style={styles.item}>👖 Bottom: {outfit.bottom.name}</Text>
      )}

      {outfit.footwear && (
        <Text style={styles.item}>👟 Footwear: {outfit.footwear.name}</Text>
      )}

      {outfit.outerwear && (
        <Text style={styles.item}>🧥 Outerwear: {outfit.outerwear.name}</Text>
      )}

      {outfit.accessory && (
        <Text style={styles.item}>⌚ Accessory: {outfit.accessory.name}</Text>
      )}

      <TouchableOpacity style={styles.button} onPress={onRegenerate}>
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.buttonText}>Regenerate Outfit</Text>
        )}
      </TouchableOpacity>

    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    marginTop: 10
  },

  item: {
    fontSize: 16,
    marginBottom: 6
  },

  button: {
    marginTop: 12,
    backgroundColor: "#000",
    padding: 10,
    borderRadius: 8,
    alignItems: "center"
  },

  buttonText: {
    color: "white",
    fontWeight: "600"
  }
});