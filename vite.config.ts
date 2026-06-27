import { defineConfig } from 'vite';

export default defineConfig({
  // Base path matches the GitHub Pages repo subpath.
  // Local dev always serves from '/', so this only affects the built output.
  base: process.env.GITHUB_ACTIONS ? '/World-Cup-App/' : '/',
});
