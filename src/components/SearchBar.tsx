import React, { useEffect, useState } from "react";
import {
  View,
  TextInput,
  StyleSheet,
  Animated,
} from "react-native";
import { Feather } from "@expo/vector-icons";

type Props = {
  value?: string;
  onChange: (q: string) => void;
  placeholder?: string;
};

export default function SearchBar({
  value = "",
  onChange,
  placeholder = "Search looks...",
}: Props) {
  const [text, setText] = useState(value);
  const [focused, setFocused] = useState(false);
  const animated = useState(new Animated.Value(0))[0];

  useEffect(() => {
    const t = setTimeout(() => onChange(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);

  useEffect(() => {
    Animated.timing(animated, {
      toValue: focused ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [focused]);

  const borderColor = animated.interpolate({
    inputRange: [0, 1],
    outputRange: ["#1c1c22", "#7c5cff"],
  });

  return (
    <Animated.View style={[styles.container, { borderColor }]}>
      <Feather name="search" size={18} color="#aaa" />
      <TextInput
        value={text}
        onChangeText={setText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        placeholderTextColor="#666"
        style={styles.input}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: "#141418",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
    marginHorizontal: 40,
    marginTop: 20,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    color: "#fff",
    fontSize: 15,
    marginLeft: 10,
  },
});
