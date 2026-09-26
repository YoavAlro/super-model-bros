import { defineConfig } from 'vite';

// Relative base so the build works on GitHub Pages under /<repo>/.
export default defineConfig({
  base: './',
  build: {
    // three.js alone is ~600 kB minified; one chunk is fine for a game.
    chunkSizeWarningLimit: 1000,
  },
});
