import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Trois pages : le jeu (index.html), l'interface admin (admin/index.html, servie à /admin, voir vercel.json) et le
// visualiseur de modèles 3D (modeles/index.html, servi à /modeles)
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        admin: resolve(import.meta.dirname, 'admin/index.html'),
        modeles: resolve(import.meta.dirname, 'modeles/index.html'),
      },
    },
  },
});
