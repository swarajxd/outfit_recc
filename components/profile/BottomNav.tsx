import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";

interface Props {
  active?: "home" | "profile";
}

export default function BottomNav({ active = "profile" }: Props) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.container}>
        {/* Left Icon */}
        <TouchableOpacity style={styles.iconWrapper}>
          <Feather
            name="home"
            size={24}
            color={active === "home" ? "#fff" : "#666"}
          />
        </TouchableOpacity>

        {/* Spacer */}
        <View style={{ width: 70 }} />

        {/* Right Icon */}
        <TouchableOpacity style={styles.iconWrapper}>
          <Ionicons
            name={active === "profile" ? "person" : "person-outline"}
            size={24}
            color={active === "profile" ? "#fff" : "#666"}
          />
        </TouchableOpacity>
      </View>

      {/* Center Floating Button */}
      <TouchableOpacity style={styles.fab}>
        <Feather name="plus" size={28} color="#000" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: "#000",
    paddingBottom: 20,
    paddingTop: 10,
    alignItems: "center",
  },

  container: {
    width: "85%",
    backgroundColor: "#111",
    borderRadius: 30,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 18,
    paddingHorizontal: 40,

    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },

  iconWrapper: {
    alignItems: "center",
    justifyContent: "center",
  },

  fab: {
    position: "absolute",
    bottom: 35,
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",

    shadowColor: "#fff",
    shadowOpacity: 0.3,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 6 },

    elevation: 12,
  },
});
