// TEMPORARY verification config (scratchpad, never committed): identical to vite.config.ts except that
// '@ngram/core' resolves to a browser-safe shim, because the real barrel pulls ain-js (createRequire) into the
// browser bundle and white-screens /chat.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
export default defineConfig({
  plugins: [react()],
  resolve: { alias: [
    { find: '@ngram/core', replacement: '/tmp/claude-1000/-mnt-newdata-ainize/3b639ba8-d335-4ad4-b5d2-7c256d5ee8a0/scratchpad/chatux/core-shim.js' },
    { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
  ] },
  build: { outDir: '/tmp/claude-1000/-mnt-newdata-ainize/3b639ba8-d335-4ad4-b5d2-7c256d5ee8a0/scratchpad/chatux/dist', emptyOutDir: true, sourcemap: false, target: 'es2022' },
});
