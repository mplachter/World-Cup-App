# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

**World Cup 2026 Tracker** — a live, real-time tracker for the FIFA World Cup with live scores, projected brackets, squad data, and match events. Built as a TypeScript app (no framework), compiled via Vite, deployed to GitHub Pages.

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

The app is split into **18 focused modules** organized by responsibility:

### Layer 0: Types & Primitives
- **`types.ts`** — all shared interfaces (Store, Cache, Match, Player, etc.) + DOM types (Child, Children)
- **`store.ts`** — tiny reactive layer: `createStore<T>`, `persistedStore<T>`, `persistedCache<T>`
- **`dom.ts`** — DOM helpers: `ce`, `div`, `span`, `btn`, `inp`, `svg`, `path` + `Attrs` type

### Layer 1: Configuration & State
- **`constants.ts`** — world data (FIFA rankings, FLAGS, GROUPS, LEAGUES), name normalization utilities
- **`state.ts`** — all reactive stores (`$data`, `$tab`, `$espn`, etc.) + validation, persistence, navigation helpers

### Layer 2: Data & Domain Logic
- **`data.ts`** — fetch schedule & squads from openfootball (JSON), race between CDNs
- **`espn.ts`** — fetch & parse ESPN live scores (polled 60s) and match summaries (lazy, cached)
- **`suspensions.ts`** — compute player suspensions (yellows, reds) across 3 FIFA discipline blocks
- **`simulation.ts`** — Monte Carlo bracket projection (5,000 sims on data change), Elo + Poisson sampling

### Layer 3: UI Views
All functions export a single DOM element; stored in `src/ui/`:
- **`schedule.ts`** — schedule view with day groups, match cards, live badge, live jump
- **`groups.ts`** — group standings, per-group match lists
- **`teams.ts`** — all 48 nations, squad detail, per-team bracket projection
- **`matchCard.ts`** — expanded match card with goals, subs, cards, lineups, suspensions (~400 lines, largest single function)
- **`squad.ts`** — squad roster by league, player rankings
- **`bracket.ts`** — desktop (SVG grid) and mobile (round pager) bracket views with probability bars

### Layer 4: Bootstrap
- **`main.ts`** — app bootstrap: wire up data loads, side effects, mount to `#root`

### Dependency Flow
```
types.ts → store.ts / dom.ts / constants.ts
         ↓
      state.ts
         ↓
  data.ts / espn.ts / suspensions.ts / simulation.ts
         ↓
      ui/*.ts
         ↓
    main.ts
```

No circular dependencies.

---

## Key Patterns

### Reactive Stores

The app uses a hand-rolled **Redux-lite** for state management (no external dependencies).

```typescript
// createStore<T>(init: T) → { get: () => T, set: (next | fn) => void, sub: (fn) => unsub }
const $count = createStore(0);
$count.sub(count => console.log(count)); // Subscribe
$count.set(c => c + 1);                  // Set or mutate

// persistedStore wraps createStore with localStorage write-through
const $tab = persistedStore('wc2026:tab', 'schedule', v => VALID_TABS.includes(v));

// persistedCache is a keyed TTL cache with QuotaExceededError recovery
const cache = persistedCache('prefix', { ttl: 30 * 60 * 1000, maxEntries: 150 });
cache.set('key', value);
const val = cache.get('key'); // null if expired or not found
```

**See [`.claude/docs/state-management.md`](./.claude/docs/state-management.md) for deep dive.**

### DOM Helpers

DOM creation is handled by a single `ce` function; child elements are typed recursively:

```typescript
// ce(tag, attrs?, ...children)
// attrs: { onClick, className, id, style: {...}, value, data-attr, ... }
// children: Child | Child[] (recursively flattened)

ce('div', { className: 'card', onClick: () => {} },
  ce('h2', null, 'Title'),
  ce('p', null, 'Paragraph'),
  [ // Arrays are flattened
    ce('span', null, 'Item 1'),
    ce('span', null, 'Item 2'),
  ]
);

// Shortcuts: div, span, btn, inp (input), svg, path
div({ className: 'grid' },
  span(null, 'Hello'),
  btn({ onClick: callback }, 'Click me')
)
```

`Attrs` type is `Record<string, unknown> | null | undefined`. The `...children: Children[]` parameter is typed as `Child | Child[]` and automatically flattened.

**See [`.claude/docs/dom-patterns.md`](./.claude/docs/dom-patterns.md) for details.**

### Data Fetching

All network fetches use `AbortSignal.timeout(8000)` to prevent hanging connections. Schedule & squads fetch race two CDNs in parallel:

```typescript
// Race two CDNs; whichever responds first wins (via Promise.any)
const schedule = await Promise.any([
  fetch(`https://raw.githubusercontent.com/...`),
  fetch(`https://cdn.jsdelivr.net/...`)
]);
```

ESPN endpoints are polled every 60 seconds for live scores; match summaries are fetched lazily on card expand and cached forever for finalized games.

### Brackets & Simulation

The bracket changes dynamically as group games finish. Every time group scores update:
1. 5,000 Monte Carlo simulations predict which R32 slot each team lands in
2. Teams ranked by FIFA Elo; goals sampled from Poisson distribution
3. Bracket slots show probability bars (green = locked, blue = predicted)
4. Cached in localStorage so repeat visits are instant

Bracket geometry (SVG for desktop, pager for mobile) renders the same data in two layouts.

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
- No unit test framework set up yet (vanilla JS, small modules, manual testing sufficient)
- **Manual verification**: Start `npm run dev`, open http://localhost:5173, interact with the app
- **CI checks**: typecheck + lint + build run on every PR; all must pass before merge

---

## Common Tasks

**Add a new store** → place it in `state.ts`, export it
**Add UI component** → create in `src/ui/`, export a function returning `HTMLElement`, import in a view
**Add a calculation** → put it in `constants.ts` (small utils) or a new module like `simulation.ts` (complex logic)
**Debug live data** → Window globals `__WC_DEBUG` and `__WC_ESPN_DUMPED` log ESPN responses to console
**Fix TypeScript error** → read the error, check `types.ts` for interfaces, cast when needed (use `as` sparingly)

---

## Important Files & References

| File | Purpose |
|---|---|
| `src/main.ts` | 134-line bootstrap; orchestrates data loads & side effects |
| `src/state.ts` | Central hub for all reactive stores; state is here |
| `src/constants.ts` | World data, name normalization, utilities |
| `src/store.ts` | Tiny reactive layer (70 lines of pure code) |
| `src/types.ts` | All interfaces — the source of truth for data shapes |
| `vite.config.ts` | Base path logic for GitHub Pages |

## Further Reading

- **[`.claude/docs/architecture.md`](./.claude/docs/architecture.md)** — detailed module breakdown, what each file does
- **[`.claude/docs/state-management.md`](./.claude/docs/state-management.md)** — how stores, persistence, and caching work
- **[`.claude/docs/dom-patterns.md`](./.claude/docs/dom-patterns.md)** — DOM helper functions and the Children type
- **[README.md](README.md)** — features, data sources, caching strategy, bracket projection details
