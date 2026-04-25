// app.config.js
require("dotenv").config();

// Set this to your PC's local Wi-Fi IP for physical device testing
const LOCAL_IP = "192.168.0.109"; // <-- CHANGE THIS to your actual PC IP

module.exports = {
  expo: {
    name: "fitsense-auth",
    slug: "fitsense-auth",
    version: "1.0.0",
    scheme: "fitsenseauth",
    icon: "./assets/images/icon.png",
    extra: {
      CLERK_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
      // Use env var if set, otherwise default to your PC's local IP for physical device
      API_BASE_URL: process.env.API_BASE_URL || `http://${LOCAL_IP}:4000`,
      SUPABASE_URL:
        process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
      SUPABASE_ANON_KEY:
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
        process.env.SUPABASE_ANON_KEY ||
        process.env.SUPABASE_SERVICE_ANON_KEY,
    },
  },
};