# Architecture Reference

## Module Responsibilities

### `types.ts`

- **DOM types**: `Child`, `Children` (recursive union for nested elements)
- **Store interfaces**: `Store<T>`, `Cache<T>`
- **Domain types**: `Match`, `MatchData`, `Player`, `Standing`, `EspnEntry`, `EspnDetail`, `Lineup`, etc.
- **Window augmentation**: `__WC_DEBUG`, `__WC_ESPN_DUMPED` globals

This is the **single source of truth** for all type definitions. Import from here.

### `store.ts`

Three reactive primitives, ~100 lines total:

- **`createStore<T>(init: T)`** — base reactive store
  - `get(): T` — read state
  - `set(next | fn)` — update state, trigger all subscribers
  - `sub(fn): unsub` — subscribe to changes
  - Uses internal `Map<id, Set<subscribers>>`

- **`persistedStore<T>(key, default, validate?)`** — wraps createStore with localStorage
  - Hydrates from localStorage on creation
  - Auto-saves to localStorage on every `.set()`
  - Optional `validate(value)` function rejects stale/invalid persisted values

- **`persistedCache<T>(prefix, opts?)`** — keyed cache with TTL and eviction
  - `get(id): T | null` — read entry (returns null if expired)
  - `set(id, value, ttl?)` — write entry with optional TTL override
  - `del(id)`, `listKeys()`, `size()`
  - `opts.ttl` (default Infinity), `opts.maxEntries` (default 200)
  - On `QuotaExceededError`: evicts oldest 20% of entries, retries
  - Garbage-collects expired entries on init

### `dom.ts`

DOM creation without JSX or a framework.

- **`ce(tag, attrs?, ...children)`** — create element
  - `tag: string` (e.g., `'div'`, `'button'`)
  - `attrs?: Record<string, unknown> | null` — properties and event listeners
  - Special handling:
    - `style: {...}` → `Object.assign(el.style, ...)`
    - `on*` (e.g., `onClick`, `onInput`) → `addEventListener`
    - `className`, `id`, `value` → direct assignment
    - Others → `setAttribute`
  - Returns `HTMLElement`

- **Shortcuts**: `div`, `span`, `btn`, `inp`, `svg`, `path` — just `ce` with the tag pre-filled

- **`Attrs` type** — `Record<string, unknown> | null | undefined`

- **`Children` type** — `Child | Child[]` where `Child = HTMLElement | SVGElement | string | number | null | false`
  - Recursively flattened
  - Strings/numbers converted to text nodes
  - Null/false skipped (safe for conditionals)

### `constants.ts`

World data and utilities:

- **World data**: `FIFA`, `FLAG`, `GROUPS`, `LEAGUES`, `LC` (league colors), `COUNTRY_TO_LEAGUE`, `POS_MAP`
- **Player rankings**: `PLAYER_RANK` (pre-computed from `_RAW_PLAYER_RANKS`), `getPlayerRank(name)`
- **Name normalization**:
  - `normName(name)` — strip diacritics, lowercase, alphanumeric only (fuzzy match for ESPN ↔ openfootball)
  - `SQUAD_NAME_NORM`, `ESPN_NORM`, `NORM` — mapping tables for team name variants
  - `espnNorm(name)`, `norm(name)` — lookup functions
- **Match key**: `pkey(homeTeam, awayTeam)` → sorted canonical key
- **Stage routing**: `stageOf(roundString)` → `'group'` | `'r32'` | `'r16'` | ... | `'final'`
- **Time utilities**: `localTime(utcString)`, `timeToMin(timeString)` (for sorting)
- **Match processing**: `processRaw(json)` → `MatchData` (splits into `.byKey`, `.byNum`, `.all`)
- **Score parsing**: `parseScore(scoreString)` → `{ h, a }` or null
- **Standings**: `calcStandings(groupKey, matches)` → sorted `Standing[]` by pts, GD, GF

### `state.ts`

Central hub for all reactive state. Exports:

**UI State**:

- `$tab: persistedStore<string>` — current view (`'schedule'` | `'groups'` | `'bracket'` | `'teams'`)
- `$selectedTeam: persistedStore<string | null>` — selected team (for teams view detail)
- `$showCompleted: persistedStore<boolean>` — show/hide completed matches filter
- `$collapsedDays: persistedStore<Record<string, boolean>>` — collapsed day state in schedule

**Data Caches**:

- `espnSummaryCache` — ESPN match summaries (150 max, no TTL, forever for finalized)
- `scheduleCache` — openfootball schedule (30 min TTL)
- `squadsCache` — openfootball squads (24h TTL)

**Squad Data**:

- `SQUADS: Record<string, Player[]>` — mutable export (ES module constraint)
- `setSQUADS(v)` — setter function to update SQUADS (can't reassign exported `let` from other modules)
- `$squads` — store tracking load state

**Schedule Data**:

- `$data: createStore<MatchData | null>` — match schedule
- `$status: createStore<string>` — `'loading'` | `'loaded'` | `'error'`
- `$today: createStore<string>` — ISO date, re-checked every 60s in case day rolls over

**ESPN Live Data**:

- `$espn: createStore<Record<string, EspnEntry>>` — live scoreboard (polled 60s)
- `$espnStatus: createStore<string>` — `'idle'` | `'loading'` | `'loaded'` | `'error'`
- `$espnDetails: createStore<Record<string, EspnDetail>>` — per-match summaries (lazy, cached)

**Navigation Helpers**:

- `navigateToTeam(teamName)` — set `$selectedTeam`, switch to teams view
- `clickableTeam(el, teamName)` — add click listener to jump to team detail

### `data.ts`

Fetch schedule & squads from openfootball.

- **`fetchJsonAny(urls, timeoutMs?)`** — race multiple URLs in parallel
  - Returns first successful response (via `Promise.any`)
  - Each fetch has 8s timeout
  - Used for CDN failover (raw.githubusercontent.com vs cdn.jsdelivr.net)

- **`loadData()`** — fetch schedule, parse it, store in `$data`
  - Caches via `scheduleCache` (30 min TTL)
  - On error, tries cached version
  - Updates `$status`

- **`loadSquads()`** — fetch squad data, store in `$squads`
  - Caches via `squadsCache` (24h TTL)
  - Calls `setSQUADS()` to update the exported `SQUADS` record
  - Called on app startup

### `espn.ts`

Fetch & parse ESPN live scores and match details.

- **`loadESPN()`** — poll scoreboard every 60s
  - Parses ESPN's scoreboard response (minimal fields)
  - Stores in `$espn`
  - Updates `$espnStatus`

- **`loadEspnSummary(matchId)`** — fetch detailed match data
  - Lazy: only fetched when user expands a match card
  - Cached forever for finalized games (they don't change)
  - Cached in `espnSummaryCache`
  - Parses goals, subs, cards, lineups
  - Internal helpers: `buildAthleteMap`, `parseEspnLineups`, `parseEventText`, `athleteNameFromInvolved`

### `suspensions.ts`

Compute which players are suspended for upcoming matches.

- **`computeSuspensions(teamName, allMatches)`** → `Record<playerName, { yellows, reds, suspendedNext }>`
  - Walks team's prior matches in order
  - Tracks yellows/reds per player
  - Applies 3 FIFA 2026 discipline blocks (group, R32+R16+QF, SF+3rd+Final)
  - Yellows reset at block boundaries; red cards carry over

- **`prefetchSuspensionData(matchId)`** — JIT load ESPN summaries for all prior matches
  - Called when a match card is expanded
  - Ensures we have the data to compute suspensions
  - Cached responses cost nothing

### `simulation.ts`

Monte Carlo bracket projection (~980 lines).

- **`$sim`** — store tracking simulation state (status, data, trials, elapsed time)
- **`startSimulation(data, trials?, onProgress?)`** — kick off simulations
  - 5,000 default trials (configurable)
  - Chunks into 250-trial batches (don't block UI)
  - Uses Elo-based team strength from `FIFA` rankings
  - Samples goals from Poisson distribution
  - Records which R32 slot each team lands in
  - Caches result in localStorage (`wc2026:sim:v6`)

- **`projectBracket(simResults)`** → probability distribution per bracket slot
  - Strips locked teams from slots they can't fill
  - Returns bars for UI rendering

- **`getMathLocks(groupStandings)`** → confirmed R32 teams
  - Some teams lock in mathematically even if one match remains
  - Returns a set of locked team names

- **`dataFingerprint(matches)`** → string hash of group scores
  - Used as cache key (re-run sim if scores change)

- **`ANNEX_C_LOOKUP`** — FIFA canonical R32 slot assignment (imported from `data/annex-c.json`)
  - 495 pre-computed third-place tiebreak scenarios
  - Avoids needing to implement complex FIFA rules on the fly

### `ui/schedule.ts`

Schedule view: day groups, match cards, live badge.

- **`buildScheduleView(data, espn, details, squads, suspensions)`** → `HTMLElement`
  - Exports matching today's date pinned at top
  - Collapsible day groups (state via `$collapsedDays`)
  - Live indicator badge in header (tap to jump to first live game)
  - Per-match card (expands to show goals, subs, cards, lineups, suspensions)
  - Filters by team/stage

### `ui/groups.ts`

Group standings & match lists.

- **`standingsTable(group, standings)`** → standings table with MP/W/D/L/GF/GA/PTS
- **`buildGroupsView(data, espn, squads)`** → all 12 groups with standings + match lists

### `ui/teams.ts`

All 48 nations, squad detail, bracket projection.

- **`buildTeamsView(squads, data, sim)`** → team selector + detail view switcher
- **`buildTeamDetailView(teamName, squads, data, espn, sim)`** → squad roster + schedule + bracket projection
- **`buildTeamListView(data, selectedTeam, squads)`** → searchable/filterable team list

### `ui/matchCard.ts`

Expanded match card (~400 lines, largest single function).

- **`matchCard(match, espn, detail, suspensions, squads, onNavigateTeam)`** → detailed card
  - Goals (scored + minute), subs, cards, lineups (formation + positions)
  - Suspensions for upcoming matches
  - Players on yellow warnings
  - Forward bracket links (→ R16 opponent)
  - Lazy-loads ESPN details on expand

### `ui/squad.ts`

Squad roster by domestic league.

- **`leagueBar(playersByLeague)`** → colored bar chart of squad composition by league
- **`squadPanel(teamName, players, isExpanded)`** → roster table grouped by position + league breakdown

### `ui/bracket.ts`

Bracket visualization (desktop SVG + mobile pager).

- **`buildBracketView(sim, data, matches, onNavigateMatch)`** → responsive bracket
  - Desktop: full SVG with all 6 rounds
  - Mobile: round pager (tabs)
  - Probability bars for projected slots
  - Green "LOCKED" badges for confirmed teams
  - Tappable to jump to match detail

### `main.ts`

Application bootstrap (134 lines).

1. Import all data, UI, store modules
2. Initialize stores (hydrate from localStorage, subscribe to changes)
3. Fire side effects:
   - `loadData()` — fetch schedule
   - `loadSquads()` — fetch squads
   - `loadESPN()` — start polling live scores
4. Set up intervals (re-check date every 60s)
5. Build app views and mount to `#root`

---

## Data Flow

```
loadData() ──→ $data (Match[])
                  ↓
         startSimulation() ──→ $sim (bracket projection)
                  ↓
            buildBracketView() ──→ DOM

loadESPN() ──→ $espn (live scores, polled 60s)
  ↓ (lazy, on expand)
loadEspnSummary() ──→ $espnDetails (goals, subs, cards, lineups)

loadSquads() ──→ $squads (load state)
              ↓ setSQUADS() ──→ SQUADS (actual roster)

computeSuspensions() (JIT in matchCard) ──→ display yellow/red warnings
```

---

## Key Constraints

- **No npm dependencies** (except dev: Vite, TypeScript, ESLint)
- **Vanilla DOM** — no VDOM, no reconciliation; render once and update via stores
- **ES modules** — can't reassign exported `let` (hence `setSQUADS()` setter pattern)
- **localStorage quirks** — catch `QuotaExceededError`, handle silently
- **8s network timeout** — prevent hung connections
- **GitHub Pages base path** — `/World-Cup-App/` set at build time via `GITHUB_ACTIONS` env var
