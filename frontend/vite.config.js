import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Produktionsplanering',
        short_name: 'Planering',
        description: 'Produktionsplaneringsverktyg',
        theme_color: '#111827',
        start_url: './',
        display: 'standalone',
        background_color: '#111827',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
    proxy: {
      '/data': 'http://127.0.0.1:8000',
      '/plan': 'http://127.0.0.1:8000',
      '/default-goal': 'http://127.0.0.1:8000',
      '/employees': 'http://127.0.0.1:8000',
    },
  },
  preview: {
    host: '0.0.0.0',
  },
});
