import type { Store, Cache, CacheOpts } from './types';

// ─── TINY REACTIVE UI ─────────────────────────────────────────────────────────
const _subs = new Map<number, Set<(s: unknown) => void>>();
let _uid = 0;
export function createStore<T>(init: T): Store<T> {
  let state = init;
  const id = _uid++;
  _subs.set(id, new Set());
  return {
    get: () => state,
    set: (next) => {
      state = typeof next === 'function' ? (next as (prev: T) => T)(state) : next;
      _subs.get(id)!.forEach((fn) => fn(state));
    },
    sub: (fn) => {
      _subs.get(id)!.add(fn as (s: unknown) => void);
      return () => _subs.get(id)!.delete(fn as (s: unknown) => void);
    },
  };
}

// Wrap createStore with localStorage persistence. Hydrates the initial value
// from `key`, then auto-saves on every change. Optional `validate` rejects
// stale/invalid persisted values (e.g. an old tab id that was renamed) and
// falls back to the default. Storage failures (private mode, quota) silently
// degrade to in-memory only.
export function persistedStore<T>(
  key: string,
  defaultValue: T,
  validate?: (v: unknown) => boolean,
): Store<T> {
  let initial = defaultValue;
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      const parsed: unknown = JSON.parse(raw);
      if (!validate || validate(parsed)) initial = parsed as T;
    }
  } catch {}
  const store = createStore(initial);
  store.sub((v) => {
    try {
      localStorage.setItem(key, JSON.stringify(v));
    } catch {}
  });
  return store;
}

// persistedCache(prefix, opts) — keyed cache backed by localStorage.
// Entries stored as JSON: { v: value, ts: writeTime, exp: expireTime|0 }.
// On QuotaExceededError, evicts oldest 20% of entries in this prefix and retries.
// gc() on init removes expired entries to keep the store tidy.
export function persistedCache<T = unknown>(prefix: string, opts?: CacheOpts): Cache<T> {
  opts = opts || {};
  const ttl = opts.ttl || Infinity; // milliseconds
  const maxEntries = opts.maxEntries || 200;
  const fullPrefix = prefix + ':';
  function keyFor(id: string) {
    return fullPrefix + id;
  }
  function listKeys() {
    const out: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(fullPrefix)) out.push(k);
    }
    return out;
  }
  function evictOldest(n: number) {
    const items: { k: string; ts: number }[] = [];
    listKeys().forEach((k) => {
      try {
        const obj = JSON.parse(localStorage.getItem(k)!);
        items.push({ k, ts: (obj && obj.ts) || 0 });
      } catch {
        localStorage.removeItem(k);
      }
    });
    items.sort((a, b) => a.ts - b.ts);
    items.slice(0, n).forEach((it) => {
      try {
        localStorage.removeItem(it.k);
      } catch {}
    });
  }
  function gc() {
    listKeys().forEach((k) => {
      try {
        const obj = JSON.parse(localStorage.getItem(k)!);
        if (obj && obj.exp && Date.now() > obj.exp) localStorage.removeItem(k);
      } catch {
        localStorage.removeItem(k);
      }
    });
  }
  gc();
  return {
    get(id: string): T | null {
      try {
        const raw = localStorage.getItem(keyFor(id));
        if (!raw) return null;
        const obj: { v: T; exp: number } = JSON.parse(raw);
        if (obj.exp && Date.now() > obj.exp) {
          localStorage.removeItem(keyFor(id));
          return null;
        }
        return obj.v;
      } catch {
        return null;
      }
    },
    set(id: string, value: T, overrideTtl?: number): void {
      const t = overrideTtl === undefined ? ttl : overrideTtl;
      const obj = { v: value, ts: Date.now(), exp: t === Infinity ? 0 : Date.now() + t };
      const json = JSON.stringify(obj);
      try {
        localStorage.setItem(keyFor(id), json);
      } catch (e) {
        if (e instanceof Error && e.name === 'QuotaExceededError') {
          console.warn('[cache]', prefix, 'quota hit, evicting');
          evictOldest(Math.ceil(maxEntries * 0.2));
          try {
            localStorage.setItem(keyFor(id), json);
          } catch (e2) {
            console.warn(
              '[cache]',
              prefix,
              'persist failed after eviction:',
              (e2 as Error).message,
            );
          }
        }
      }
    },
    del(id: string) {
      try {
        localStorage.removeItem(keyFor(id));
      } catch {}
    },
    listKeys,
    size() {
      return listKeys().length;
    },
  };
}
