// app.config.js
require('dotenv').config();

module.exports = {
  expo: {
    name: "fitsense-auth",
    slug: "fitsense-auth",
    version: "1.0.0",
    scheme: "fitsenseauth",
    icon: "./assets/images/icon.png", // adjust path if needed
    extra: {
      CLERK_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
    },
  },
};
