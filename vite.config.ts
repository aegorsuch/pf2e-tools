import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'PF2E Tools',
        short_name: 'PF2E Tools',
        display: 'standalone',
        background_color: '#1b1b1f',
        theme_color: '#7a1f1f',
        icons: [],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,json,svg}'] },
    }),
  ],
})
