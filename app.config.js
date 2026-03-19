// app.config.js
require("dotenv").config();

module.exports = {
  expo: {
    name: "fitsense-auth",
    slug: "fitsense-auth",
    version: "1.0.0",
    scheme: "fitsenseauth",
    icon: "./assets/images/icon.png", // adjust path if needed
    extra: {
      CLERK_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
      API_BASE_URL: process.env.API_BASE_URL || "http://10.0.2.2:4000",
      // Supabase client config (safe to expose anon key to the app)
      SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
      SUPABASE_ANON_KEY:
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
        process.env.SUPABASE_ANON_KEY ||
        process.env.SUPABASE_SERVICE_ANON_KEY,
    },
  },
};
