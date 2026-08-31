import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const NODE_URL = process.env.NGRAM_NODE_URL ?? 'http://localhost:3402';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
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
