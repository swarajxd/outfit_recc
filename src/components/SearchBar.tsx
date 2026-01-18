// src/components/SearchBar.tsx
import React, { useEffect, useState } from "react";
import { View, TextInput, StyleSheet, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";

type Props = {
  value?: string;
  onChange: (q: string) => void;
  placeholder?: string;
};

export default function SearchBar({ value = "", onChange, placeholder = "Search looks, tags..." }: Props) {
  const [text, setText] = useState(value);

  // debounce local changes to avoid querying on every keystroke
  useEffect(() => {
    const t = setTimeout(() => onChange(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);

  useEffect(() => setText(value), [value]);

  return (
    <View style={styles.container}>
      <Feather name="search" size={18} color="#999" style={{ marginRight: 8 }} />
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={placeholder}
        placeholderTextColor="#888"
        style={styles.input}
        returnKeyType="search"
        autoCapitalize="none"
        keyboardAppearance="dark"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: "#111",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
    alignItems: "center",
    marginHorizontal: 12,
    marginTop: 12,
  },
  input: {
    flex: 1,
    color: "#fff",
    fontSize: 16,
    minHeight: 20,
  },
});
