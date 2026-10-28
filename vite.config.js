import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Deux pages : le jeu (index.html) et l'interface admin (admin/index.html, servie à /admin, voir vercel.json)
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        admin: resolve(import.meta.dirname, 'admin/index.html'),
      },
    },
  },
});
