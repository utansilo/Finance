import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Flowra — Every Flow, Accounted For.',
        short_name: 'Flowra',
        description: 'Catat transaksi, petty cash, budget, utang & dana darurat. Sinkron laptop ↔ HP.',
        theme_color: '#0f172a',
        background_color: '#f1f5f9',
        display: 'standalone',
        start_url: '.',
        icons: [
          { src: 'logo.png', sizes: 'any', type: 'image/png' },
          { src: 'logo.png', sizes: 'any', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
  server: { host: true },
})
