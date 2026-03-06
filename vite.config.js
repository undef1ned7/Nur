import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
    plugins: [
        react(),
        tailwindcss(),
        VitePWA({
            strategies: 'injectManifest',
            registerType: 'autoUpdate',
            manifestFilename: 'site.webmanifest',
            includeAssets: [
                'favicon.ico',
                'favicon.svg',
                'favicon-96x96.png',
                'apple-touch-icon.png',
                'web-app-manifest-192x192.png',
                'web-app-manifest-512x512.png',
                'favicon.png',
            ],
            manifest: {
                name: 'NurCRM',
                short_name: 'NurCRM',
                description: 'NurCRM',
                start_url: '/',
                scope: '/',
                display: 'standalone',
                background_color: '#080707',
                theme_color: '#000000',
                icons: [
                    {
                        src: '/web-app-manifest-192x192.png',
                        sizes: '192x192',
                        type: 'image/png',
                        purpose: 'maskable',
                    },
                    {
                        src: '/web-app-manifest-512x512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'maskable',
                    },
                ],
            },
            srcDir: 'src',
            filename: 'sw.js',
            injectManifest: {
                // keep defaults, but avoid missing large assets if needed later
                maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
            },
            devOptions: {
                enabled: true,
            },
        }),
    ],
    resolve: {
        alias: {
            '@': '/src',
        },
    },
    server: {
        port: 3000,
        open: true,
        allowedHosts: ["dd2836a80d13.ngrok-free.app"]
    },
    build: {
        outDir: 'build',
        sourcemap: true,
    },
    css: {
        preprocessorOptions: {
            scss: {
                additionalData: `@use "@/assets/scss/main.scss" as *; @use "@/assets/scss/_mixin.scss" as *; @use "@/assets/scss/_variables.scss" as *;`
            }
        }
    }
})