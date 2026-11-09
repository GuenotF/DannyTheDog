import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/DannyTheDog/',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Danny the DOG',
        short_name: 'Danny',
        description: 'Suivi de séances de musculation',
        lang: 'fr',
        start_url: '/DannyTheDog/',
        scope: '/DannyTheDog/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0F1012',
        theme_color: '#0F1012',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,json,webmanifest}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts', expiration: { maxEntries: 20 } }
          }
        ]
      }
    })
  ],
  test: {
    environment: 'node'
  }
} as any);
