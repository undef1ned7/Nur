import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.js"],
    include: [
      "src/**/*.{test,spec}.{js,jsx,ts,tsx}",
      "tools/**/*.{test,spec}.js",
    ],
    globals: false,
  },
});
