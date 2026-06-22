import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000,
    open: true,
    proxy: {
      "/media": {
        target: "https://app.nurcrm.kg",
        changeOrigin: true,
        secure: true,
      },
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@use "@/assets/scss/main.scss" as *; @use "@/assets/scss/_mixin.scss" as *; @use "@/assets/scss/_variables.scss" as *;`,
      },
    },
  },
});
