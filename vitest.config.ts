import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: {
    jsxImportSource: 'preact',
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
  },
});
