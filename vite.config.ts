import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const NODE_URL = process.env.AINIZE_NODE_URL ?? 'http://localhost:3402';

export default defineConfig({
  plugins: [react()],
  /**
   * Only the `@` alias. `@ainize/core`'s barrel pulls ain-js and `node:module`'s createRequire into whatever
   * browser chunk touches it — the shipped bundle died with "(0 , C.createRequire) is not a function" and /chat,
   * /teach/lesson/:id and every route reaching the publish sheet rendered an empty #root. The web imports
   * `@ainize/core/browser` instead, a subpath that imports nothing at all, so a runtime value from any other core
   * module now fails to resolve here rather than white-screening in production.
   */
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: NODE_URL, changeOrigin: true },
      '/x402': { target: NODE_URL, changeOrigin: true },
      '/p2p': { target: NODE_URL, changeOrigin: true },
    },
  },
  build: { outDir: 'dist', sourcemap: false, target: 'es2022' },
});
