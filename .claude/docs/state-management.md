# State Management

The app uses a hand-rolled, tiny reactive system (~100 lines) with no external dependencies.

## The Three Primitives

### `createStore<T>(init: T)`

The base reactive store. Returns an object with three methods:

```typescript
interface Store<T> {
  get(): T;                                  // Read current state
  set(next: T | (prev: T) => T): void;      // Update state
  sub(fn: (state: T) => void): () => void;  // Subscribe + unsubscribe
}
```

**Example:**

```typescript
const $count = createStore(0);

// Subscribe to changes
const unsub = $count.sub(count => {
  console.log('Count is now:', count);
});

// Update directly
$count.set(5);

// Update with function
$count.set(prev => prev + 1);

// Unsubscribe
unsub();
```

**Implementation detail:** stores are indexed with auto-incrementing IDs; subscribers are stored in a `Map<id, Set<callbacks>>`. When `.set()` is called, all callbacks for that store are invoked with the new state.

### `persistedStore<T>(key, defaultValue, validate?)`

Wraps `createStore<T>` with localStorage persistence.

```typescript
const $tab = persistedStore('wc2026:tab', 'schedule', v => 
  VALID_TABS.includes(v)
);
```

**Behavior:**

1. On creation: reads localStorage[key]. If found and `validate(value)` is true, hydrates the store with it. Otherwise uses `defaultValue`.
2. On every `.set()`: automatically saves to localStorage[key]
3. Storage errors (private mode, quota exceeded) silently degrade to in-memory only
4. Validator is optional; if provided, invalid values are rejected and default is used

**Example:**

```typescript
// User preference, persists across sessions
const $showCompleted = persistedStore('wc:showCompleted', false, v => 
  typeof v === 'boolean'
);

// User accidentally stores "lol", validator rejects it, defaults to false
localStorage.setItem('wc:showCompleted', '"lol"');
const store = persistedStore('wc:showCompleted', false, v => typeof v === 'boolean');
store.get() // → false (validator rejected "lol")
```

### `persistedCache<T>(prefix, opts?)`

A keyed TTL cache backed by localStorage. Used for API responses (schedule, squads, ESPN summaries).

```typescript
interface CacheOpts {
  ttl?: number;           // Time-to-live in milliseconds (default Infinity)
  maxEntries?: number;    // Max entries before eviction (default 200)
}

interface Cache<T> {
  get(id: string): T | null;
  set(id: string, value: T, overrideTtl?: number): void;
  del(id: string): void;
  listKeys(): string[];
  size(): number;
}
```

**Example:**

```typescript
const cache = persistedCache('wc:espn:summary', {
  ttl: 30 * 60 * 1000,    // 30 minutes
  maxEntries: 150
});

// Store a response
cache.set('match-123', espnData);

// Retrieve it
const data = cache.get('match-123');

// Expired or not found → null
cache.get('old-key') // → null
```

**Storage format:** entries are stored as `{ v, ts, exp }` JSON:
- `v` — the cached value
- `ts` — write timestamp
- `exp` — expiration timestamp (0 if infinite TTL)

**On init:** garbage-collects expired entries so localStorage doesn't accumulate stale data.

**Eviction strategy:** if `localStorage.setItem()` throws `QuotaExceededError`:
1. Evict oldest 20% of entries (by timestamp) in this cache prefix
2. Retry the write
3. If it still fails, log a warning (data loss, but silent degradation)

---

## Where State Lives

All app state is declared in [`src/state.ts`](../src/state.ts). This is the **single hub** for reactivity:

### UI Preferences (persisted)
```typescript
export const $tab = persistedStore('wc2026:tab', 'schedule', v => 
  VALID_TABS.includes(v)
);
export const $selectedTeam = persistedStore('wc2026:selectedTeam', null, ...);
export const $showCompleted = persistedStore('wc2026:showCompleted', false, ...);
export const $collapsedDays = persistedStore('wc2026:collapsedDays:v1', {}, ...);
```

### Data Caches (persistent, with TTL)
```typescript
export const espnSummaryCache = persistedCache('wc2026:cache:espn:summary:v1', {
  maxEntries: 150
  // No TTL → cached forever for finalized matches
});
export const scheduleCache = persistedCache('wc2026:cache:openfootball:schedule:v1', {
  ttl: 30 * 60 * 1000,  // 30 min
  maxEntries: 4
});
export const squadsCache = persistedCache('wc2026:cache:openfootball:squads:v1', {
  ttl: 24 * 60 * 60 * 1000,  // 24 hr
  maxEntries: 4
});
```

### Squad Data
```typescript
// ES module constraint: can't reassign exported let from another module
export let SQUADS: Record<string, Player[]> = {};
export function setSQUADS(v: Record<string, Player[]>) { SQUADS = v; }
export const $squads = createStore({ loaded: false, count: 0 });
```

The `setSQUADS()` function exists because `data.ts` needs to update `SQUADS`, but ES modules don't allow reassigning an exported binding from outside the module.

### Schedule Data
```typescript
export const $data = createStore<MatchData | null>(null);
export const $status = createStore<string>("loading");
export const $today = createStore<string>(localDateISO());
```

`$today` is re-checked every 60s (in case the app is left open overnight).

### ESPN Live Data
```typescript
export const $espn = createStore<Record<string, EspnEntry>>({});
export const $espnStatus = createStore<string>("idle");
export const $espnDetails = createStore<Record<string, EspnDetail>>({});
```

`$espn` is polled every 60 seconds by `loadESPN()`. `$espnDetails` accumulates match summaries as users expand cards.

### Navigation Helpers
```typescript
export function navigateToTeam(teamName: string | null) {
  if (!teamName || teamName === 'TBD') return;
  $selectedTeam.set(teamName);
  $tab.set('teams');
}

export function clickableTeam(el: HTMLElement, teamName: string | null) {
  if (!teamName || teamName === 'TBD' || !FLAG[teamName]) return el;
  el.style.cursor = 'pointer';
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    navigateToTeam(teamName);
  });
  return el;
}
```

---

## Subscriptions in UI Functions

UI functions read state at render time and subscribe to changes:

```typescript
// From ui/schedule.ts (simplified)
export function buildScheduleView(data, espn, details, squads, suspensions) {
  const container = div({ className: 'schedule' });
  
  // Subscribe to match data changes
  $data.sub(newData => {
    if (!newData) return;
    container.innerHTML = '';
    // Render with new data
    newData.all.forEach(match => {
      container.appendChild(matchCard(match, espn, ...));
    });
  });
  
  return container;
}
```

**In practice:** each UI view function is called once on startup. It returns a DOM element and subscribes to relevant stores. When stores change, the subscriptions fire and update the DOM.

**No VDOM:** unlike React, there's no reconciliation. Entire sections are re-rendered when data changes. This is fine because:
- The data fetches are infrequent (schedule once, espn every 60s)
- Group sizes are small (4-12 teams/matches per view)
- Rebuilding the DOM is faster than diffing in this size range

---

## Caching Strategy

| Data | Cache | TTL | Behavior |
|---|---|---|---|
| **Schedule** | `scheduleCache` | 30 min | Stale-while-revalidate (serve cached, fetch in background) |
| **Squads** | `squadsCache` | 24 hr | Stale-while-revalidate |
| **ESPN summary** | `espnSummaryCache` | ∞ (forever) | Finalized games don't change; live games not cached |
| **ESPN scoreboard** | None | — | Polled every 60s, never cached |
| **Simulation** | localStorage `wc2026:sim:v6` | ∞ | Cached until data fingerprint changes |

**Stale-while-revalidate pattern:**
1. Check cache first; if hit and not expired, return cached data immediately
2. In the background, fetch fresh data from the network
3. If fresh data arrives and differs, update the store (triggers re-render)
4. If network fails, cached data already satisfied the user

This keeps the app responsive even on slow networks.

---

## localStorage Keys

All keys are namespaced with `wc2026:` to avoid collisions.

### Preferences
```
wc2026:tab                        // Current tab (schedule/groups/bracket/teams)
wc2026:selectedTeam               // Selected team for detail view
wc2026:showCompleted              // Show completed matches filter
wc2026:collapsedDays:v1           // Collapsed days in schedule
```

### Caches
```
wc2026:cache:openfootball:schedule:v1
wc2026:cache:openfootball:squads:v1
wc2026:cache:espn:summary:v1
wc2026:sim:v6                     // Monte Carlo simulation results
```

(Version suffixes allow safe schema changes; old entries are orphaned but harmless.)

---

## Common Patterns

### Reading State
```typescript
const tab = $tab.get(); // Read current value
```

### Updating State
```typescript
$tab.set('bracket'); // Direct update
$count.set(c => c + 1); // Functional update
```

### Subscribing & Cleanup
```typescript
const unsub = $data.sub(data => {
  console.log('Data changed:', data);
});

// Later, when the subscription is no longer needed:
unsub();
```

### Conditional Rendering
```typescript
$data.sub(data => {
  if (data && data.all.length > 0) {
    renderMatches(data.all);
  } else {
    renderLoadingState();
  }
});
```

### Derived State
There's no automatic "computed" property. If you need state A → state B, you can either:
1. Subscribe to A and update a separate store B
2. Compute B on-demand in your subscriber

Example (both approaches):
```typescript
// Approach 1: separate store
const $matchCount = createStore(0);
$data.sub(data => {
  $matchCount.set((data?.all.length ?? 0));
});

// Approach 2: compute inline
$data.sub(data => {
  const count = data?.all.length ?? 0;
  renderHeader(count);
});
```

---

## Migration from Direct DOM Updates

Old code (no reactivity):
```typescript
document.getElementById('count').textContent = count;
```

New code (with reactivity):
```typescript
const $count = createStore(0);

$count.sub(count => {
  document.getElementById('count').textContent = count;
});

// Later, update state:
$count.set(5);
```

---

## TypeScript Usage

All stores are generic and fully typed:

```typescript
const $data = createStore<MatchData | null>(null);
const $espn = createStore<Record<string, EspnEntry>>({});

// TypeScript knows the types:
$data.sub(data => {
  // data: MatchData | null
  if (data) {
    data.all.forEach(match => { ... });
  }
});
```
