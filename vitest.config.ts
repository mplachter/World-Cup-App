import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: {
    jsxImportSource: 'preact',
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    // Node's own experimental global `localStorage` shadows jsdom's
    // window.localStorage and resolves to undefined, breaking anything that
    // touches localStorage at module-load time (see src/store.ts).
    execArgv: ['--no-experimental-webstorage'],
  },
});
