import { defineConfig } from 'vite';

export default defineConfig({
  // For GitHub Pages: set to '/<repo-name>/' when deploying
  // e.g. base: '/GLABCounterStrike/'
  base: './',
  build: {
    outDir: 'dist',
  },
});
