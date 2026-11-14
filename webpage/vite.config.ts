import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    // Small enough that inlining tiny assets as data: URIs is not worth the CSP exception.
    assetsInlineLimit: 0,
    target: 'es2022',
    // scripts/prerender.mjs reads it to preload the page language's string chunk.
    manifest: true,
  },
});
