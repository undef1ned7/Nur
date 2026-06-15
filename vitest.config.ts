import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
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
