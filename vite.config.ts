import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Served from https://<user>.github.io/pf2e-tools/ on GitHub Pages
export default defineConfig({
  base: '/pf2e-tools/',
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
        start_url: '/pf2e-tools/',
        scope: '/pf2e-tools/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,json,svg}'] },
    }),
  ],
})
