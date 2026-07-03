import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare()],
  // Served at the root of the custom domain (cinepair.maydayprod.app), so assets must be
  // referenced from '/', not '/cinepair/'.
  base: '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    hmr: true,
  },
  build: {
    rollupOptions: {
      output: {
        // Split heavy vendors into separate, long-lived cacheable chunks so the app code
        // can change without re-downloading firebase/motion, and chunks load in parallel.
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          // Messaging is only pulled in lazily by ./push, so keep it out of the main firebase chunk.
          if (id.includes('@firebase/messaging') || id.includes('firebase/messaging')) return 'firebase-messaging';
          if (id.includes('@firebase') || id.includes('/firebase/')) return 'firebase';
          if (id.includes('/motion') || id.includes('framer-motion')) return 'motion';
          if (id.includes('react-router')) return 'router';
          if (id.includes('react-qr-code') || id.includes('/qrcode')) return 'qrcode';
          if (id.includes('lucide-react')) return 'icons';
          if (id.includes('/react-dom/') || id.includes('/react/') || id.includes('scheduler')) return 'react';
          return 'vendor';
        },
      },
    },
  },
});