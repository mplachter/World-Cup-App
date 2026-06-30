// On Node 22+, the experimental global `localStorage` shadows jsdom's
// window.localStorage (vitest's jsdom environment can't overwrite the
// non-configurable Node accessor), breaking anything that touches
// localStorage at module-load time (see src/store.ts). Forcing it back to
// jsdom's implementation is a no-op on older Node versions that never
// defined the global in the first place.
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: window.localStorage,
});
