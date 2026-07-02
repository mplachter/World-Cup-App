# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

**World Cup 2026 Tracker** — a live, real-time tracker for the FIFA World Cup with live scores, projected brackets, squad data, and match events. Built with **Preact** (TypeScript, JSX), compiled via Vite, deployed to GitHub Pages.

See [README.md](README.md) for full feature list, data sources, and browser support.

---

## Commands

```bash
npm run dev        # Vite dev server, HMR → http://localhost:5173
npm run build      # Production build → dist/ (with GitHub Pages base path)
npm run preview    # Serve dist/ locally to test production build
npm run typecheck  # TypeScript type check (strict: false for gradual adoption)
npm run lint       # ESLint on src/
```

---

## Architecture

The app is organized by responsibility across a handful of layers:

### Layer 0: Types & Primitives

- **`types.ts`** — all shared interfaces (Store, Cache, Match, Player, etc.)
- **`store.ts`** — tiny reactive layer: `createStore<T>`, `persistedStore<T>`, `persistedCache<T>`
- **`dom.ts`** — legacy DOM helpers (`ce`, `div`, `span`, `btn`, `inp`, `svg`, `path` + `Attrs` type). Views have migrated to Preact JSX; `dom.ts` is only still used by `src/ui/squad.ts`.
- **`router.ts`** — minimal client-side navigation (tab + selected-team routing)

### Layer 1: Configuration & State

- **`constants.ts`** — world data (FIFA rankings, FLAGS, GROUPS, LEAGUES), name normalization utilities, bracket topology (`BRACKET_BL`/`BRACKET_BR`/`BRACKET_FEEDS`/`BRACKET_NEXT`/`BRACKET_SIBLING`)
- **`state.ts`** — all reactive stores (`$data`, `$tab`, `$espn`, `$bracketRound`, etc.) + validation, persistence, navigation helpers
- **`design/`** — design tokens, style mixins, and shared components (e.g. `FilterButton`) used across views

### Layer 2: Data & Domain Logic

- **`data.ts`** — fetch schedule & squads from openfootball (JSON), race between CDNs
- **`espn.ts`** — fetch & parse ESPN live scores (polled 60s) and match summaries (lazy, cached)
- **`suspensions.ts`** — compute player suspensions (yellows, reds) across 3 FIFA discipline blocks
- **`simulation.ts`** — Monte Carlo bracket projection (5,000 sims on data change), Elo + Poisson sampling
- **`hooks/useStore.ts`** — Preact hook that subscribes a component to a `store.ts` store

### Layer 3: UI Views

Preact components stored in `src/ui/`, each exporting a component function:

- **`ScheduleView.tsx`** — schedule view with day groups, match cards, live badge, live jump
- **`GroupsView.tsx`** — group standings, per-group match lists
- **`TeamsView.tsx`** — all 48 nations, squad detail, per-team bracket projection
- **`CatalogView.tsx`** — design/component catalog (dev reference, not part of the live app tabs)
- **`matchCard.tsx`** — expanded match card with goals, subs, cards, lineups, suspensions (`MatchCard`, reused by `ScheduleView`, `GroupsView`, and the bracket's `MatchDetailPanel`)
- **`squad.ts`** — squad roster by league, player rankings (still uses `dom.ts` helpers, not JSX)
- **`BracketView.tsx`** — round-by-round bracket pager (Round of 32 → 16 → QF → SF → Final). Desktop shows every remaining round and trims the passed one off as you step forward; mobile shows the focused round plus a next-round preview. Connector lines are computed from measured DOM positions, not precomputed pixel math. Focus round is persisted in `$bracketRound`.
- **`HTMLEl.tsx`** — small helper for interop between raw DOM nodes and Preact JSX

### Layer 4: Bootstrap

- **`main.tsx`** — app bootstrap: wire up data loads, side effects, mount to `#root`

### Dependency Flow

```
types.ts → store.ts / dom.ts / constants.ts
         ↓
      state.ts
         ↓
  data.ts / espn.ts / suspensions.ts / simulation.ts
         ↓
      ui/*.tsx
         ↓
    main.tsx
```

No circular dependencies.

---

## Key Patterns

### Reactive Stores

The app uses a hand-rolled **Redux-lite** for state management (no external dependencies).

```typescript
// createStore<T>(init: T) → { get: () => T, set: (next | fn) => void, sub: (fn) => unsub }
const $count = createStore(0);
$count.sub((count) => console.log(count)); // Subscribe
$count.set((c) => c + 1); // Set or mutate

// persistedStore wraps createStore with localStorage write-through
const $tab = persistedStore('wc2026:tab', 'schedule', (v) => VALID_TABS.includes(v));

// persistedCache is a keyed TTL cache with QuotaExceededError recovery
const cache = persistedCache('prefix', { ttl: 30 * 60 * 1000, maxEntries: 150 });
cache.set('key', value);
const val = cache.get('key'); // null if expired or not found
```

**See [`.claude/docs/state-management.md`](./.claude/docs/state-management.md) for deep dive.**

### Views: Preact JSX

Views are Preact function components using JSX and hooks (`useState`, `useEffect`, `useRef`), subscribed to `store.ts` stores via `useStore` (`src/hooks/useStore.ts`). Styling is inline `style={{...}}` objects rather than CSS classes/modules.

```typescript
export function SomeView() {
  const data = useStore($data);
  const [open, setOpen] = useState(false);
  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      <button onClick={() => setOpen((o) => !o)}>Toggle</button>
      {open && <span>{data.length} items</span>}
    </div>
  );
}
```

`src/ui/squad.ts` is the one remaining view still on the older `dom.ts` helper pattern (`ce`, `div`, `span`, `btn`, `inp`, `svg`, `path` — a single `ce(tag, attrs?, ...children)` function with recursively-flattened children). Treat it as legacy rather than the pattern for new views.

**See [`.claude/docs/dom-patterns.md`](./.claude/docs/dom-patterns.md) for the `dom.ts` helper details (relevant to `squad.ts` only).**

### Data Fetching

All network fetches use `AbortSignal.timeout(8000)` to prevent hanging connections. Schedule & squads fetch race two CDNs in parallel:

```typescript
// Race two CDNs; whichever responds first wins (via Promise.any)
const schedule = await Promise.any([
  fetch(`https://raw.githubusercontent.com/...`),
  fetch(`https://cdn.jsdelivr.net/...`),
]);
```

ESPN endpoints are polled every 60 seconds for live scores; match summaries are fetched lazily on card expand and cached forever for finalized games.

### Brackets & Simulation

The bracket changes dynamically as group games finish. Every time group scores update:

1. 5,000 Monte Carlo simulations predict which R32 slot each team lands in
2. Teams ranked by FIFA Elo; goals sampled from Poisson distribution
3. Bracket slots show probability bars (green = locked, blue = predicted)
4. Cached in localStorage so repeat visits are instant

The bracket is a single round-by-round pager (`BracketView.tsx`) rather than separate desktop/mobile layouts: desktop shows every remaining round at once and trims the passed round off as you page forward, mobile shows the focused round plus a next-round preview. Connector lines are drawn from measured DOM positions (refs + `getBoundingClientRect`), not precomputed geometry, since the true bracket convergence order crosses between draw halves at the semifinal stage.

---

## Development Workflow

### Branch Strategy

- **`main`** — production; CI/CD tests + deploys on push
- **Feature branches** — all work happens off branches; PR to main for review/merge

### Adding a Feature

1. Create feature branch: `git checkout -b feature-name`
2. Make changes, run `npm run typecheck && npm run lint && npm run build` locally
3. Commit with a clear message
4. Push and create PR via `git push -u origin HEAD` + `/pr` skill
5. Merge to main when green

### TypeScript Migration Notes

- `tsconfig.json` uses `strict: false` for **gradual adoption** (you can use `any` when needed, warns when unused vars)
- ESLint allows `@ts-nocheck` comments during migration (configured in `eslint.config.js`)
- Empty catch blocks are intentional (localStorage/fetch failures silently degrade) — `allowEmptyCatch: true`

### Testing & Verification

- **Unit tests**: `npm run test:unit` (Vitest) — see `src/simulation.test.ts` for the Elo/Poisson/qualification logic
- **E2E tests**: `npm run test:e2e` (Playwright, `e2e/`) — builds + serves `dist/` and drives the real app in Chromium; `e2e/bracket.spec.ts` covers bracket rendering, navigation, and live-match regressions
- **Manual verification**: Start `npm run dev`, open http://localhost:5173, interact with the app
- **CI checks**: typecheck + lint + build run on every PR; all must pass before merge

---

## Common Tasks

**Add a new store** → place it in `state.ts`, export it
**Add UI component** → create a `.tsx` file in `src/ui/`, export a Preact function component, import in a view
**Add a calculation** → put it in `constants.ts` (small utils) or a new module like `simulation.ts` (complex logic)
**Debug live data** → Window globals `__WC_DEBUG` and `__WC_ESPN_DUMPED` log ESPN responses to console
**Fix TypeScript error** → read the error, check `types.ts` for interfaces, cast when needed (use `as` sparingly)

---

## Important Files & References

| File                     | Purpose                                                         |
| ------------------------ | --------------------------------------------------------------- |
| `src/main.tsx`           | Bootstrap; orchestrates data loads & side effects               |
| `src/state.ts`           | Central hub for all reactive stores; state is here              |
| `src/constants.ts`       | World data, name normalization, bracket topology, utilities     |
| `src/store.ts`           | Tiny reactive layer (createStore/persistedStore/persistedCache) |
| `src/types.ts`           | All interfaces — the source of truth for data shapes            |
| `src/ui/BracketView.tsx` | Round-by-round bracket pager, connector-line measurement        |
| `vite.config.ts`         | Base path logic for GitHub Pages                                |

## Further Reading

- **[`.claude/docs/architecture.md`](./.claude/docs/architecture.md)** — detailed module breakdown, what each file does
- **[`.claude/docs/state-management.md`](./.claude/docs/state-management.md)** — how stores, persistence, and caching work
- **[`.claude/docs/dom-patterns.md`](./.claude/docs/dom-patterns.md)** — DOM helper functions and the Children type
- **[README.md](README.md)** — features, data sources, caching strategy, bracket projection details
