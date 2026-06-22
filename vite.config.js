import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  // loadEnv без префикса — читает DEV_BACKEND из .env / .env.local
  const env = loadEnv(mode, process.cwd(), "");
  const backendUrl = env.DEV_BACKEND || "http://localhost:8000";

  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        strategies: "injectManifest",
        registerType: "autoUpdate",
        manifestFilename: "site.webmanifest",
        includeAssets: [
          "favicon.ico",
          "favicon.svg",
          "favicon-96x96.png",
          "apple-touch-icon.png",
          "web-app-manifest-192x192.png",
          "web-app-manifest-512x512.png",
          "favicon.png",
        ],
        manifest: {
          name: "NurCRM",
          short_name: "NurCRM",
          description: "NurCRM",
          start_url: "/",
          scope: "/",
          display: "standalone",
          background_color: "#080707",
          theme_color: "#000000",
          icons: [
            {
              src: "/web-app-manifest-192x192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "maskable",
            },
            {
              src: "/web-app-manifest-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
        srcDir: "src",
        filename: "sw.js",
        injectManifest: {
          maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        },
        devOptions: {
          enabled: true,
        },
      }),
    ],
    resolve: {
      alias: {
        "@": "/src",
      },
    },
    server: {
      port: 3000,
      open: true,
      allowedHosts: ["dd2836a80d13.ngrok-free.app"],
      proxy: {
        // REST API — активируется когда VITE_API_URL=/api в .env.local
        "/api": {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
        },
        // WebSocket — активируется когда VITE_WS_API_URL пустой (window.location.host)
        "/ws": {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
          ws: true,
        },
        // Медиафайлы — всегда с прода
        "/media": {
          target: "https://app.nurcrm.kg",
          changeOrigin: true,
          secure: true,
        },
      },
    },
    build: {
      outDir: "build",
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("node_modules")) {
              if (
                id.includes("/react/") ||
                id.includes("/react-dom/") ||
                id.includes("/react-is/") ||
                id.includes("/scheduler/")
              ) {
                return "vendor-react";
              }
              if (id.includes("swiper")) return "vendor-swiper";
              if (id.includes("/chart.js/")) {
                return "vendor-charts";
              }
              return undefined;
            }
            return undefined;
          },
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
  };
});
