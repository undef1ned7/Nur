import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: {
            '@': '/src',
        },
    },
    server: {
        port: 3000,
        open: true,
        allowedHosts: ["e654d2600b88.ngrok-free.app"]
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