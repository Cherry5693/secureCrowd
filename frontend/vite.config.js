import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: {
        name: 'SecureCrowd',
        short_name: 'SecureCrowd',
        description: 'Real-time emergency communication system',
        theme_color: '#07080c',
        background_color: '#07080c',
        display: 'standalone',
        icons: [
          {
            src: '/shield.svg',
            sizes: '192x192 512x512',
            type: 'image/svg+xml'
          }
        ]
      }
    })
  ]
})
