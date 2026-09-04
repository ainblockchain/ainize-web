import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const NODE_URL = process.env.NGRAM_NODE_URL ?? 'http://localhost:3402';

export default defineConfig({
  plugins: [react()],
  /**
   * `@ngram/core` resolves to its barrel (dist/index.js), which pulls ain-js and `node:module`'s createRequire into
   * whatever browser chunk touches it: the shipped bundle died with "(0 , C.createRequire) is not a function" and
   * /chat, /teach/lesson/:id and every route that reaches the publish sheet rendered an empty #root. The web only ever
   * needs the domain types and the two constants beside them, all of which live in core's types module and depend on
   * nothing, so the browser build is pointed straight at it. A web file that imports a runtime value from any other
   * core module now fails the build loudly here instead of white-screening in production.
   */
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@ngram/core': fileURLToPath(new URL('../core/src/types.ts', import.meta.url)),
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
