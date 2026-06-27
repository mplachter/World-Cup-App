# 🏆 2026 FIFA World Cup Tracker

A live tracker for the 2026 FIFA World Cup — real-time scores, projected brackets, match events, suspensions, and squad data — built as a single HTML file.

**🔗 [Live app](https://mplachter.github.io/World-Cup-App/)**

---

## What it does

### 📅 Schedule
- **TODAY** section pinned to the top with LIVE games highlighted in red
- Live indicator badge in the header (`🔴 2 LIVE · 6 today`) — tap to jump to the first live game
- Day groups for past and future matches, **collapsible with state persisted** across sessions
- Filter by team, filter by stage (Group / R32 / R16 / QF / SF / 3rd / Final)
- Match cards expand inline to show full detail

### ⚽ Match Detail (expanded card)
- **Goals** with scorer + minute (openfootball for completed games, ESPN for live)
- **Substitutions** — player in / player out, with minute, color-coded by team
- **Cards** — yellow 🟨, red 🟥, and second-yellow 🟨🟥
- **Starting XI** with formation tags (e.g. `4-3-3 · 4-2-3-1`), jersey numbers, and position abbreviations grouped G → D → M → F
- **Suspensions** for upcoming matches — players who can't play due to accumulated cards, applying FIFA 2026 block reset rules
- **Players on a yellow** — one caution away from a ban (within the current discipline block)
- **Squad rosters** by domestic league with player rankings overlaid

### 🏆 Bracket
- **Desktop**: full SVG bracket with all 6 rounds laid out side-by-side
- **Mobile**: round-pager (R32 · R16 · QF · SF · 3rd · Final tabs) — each round renders as a clean vertical list
- **Forward links** on every match card: `→ M89 (R16) · winner faces 🇧🇷 Brazil / 🇦🇷 Argentina` — tappable to jump to the next-round match
- **Locked vs projected** slots: confirmed teams show green LOCKED badge; uncertain slots show probability bars from Monte Carlo simulation
- **5,000-simulation projection** re-runs on every score update — uses FIFA-rank Elo + Poisson goal sampling

### 📊 Groups
- Live standings (MP / W / D / L / GF / GA / PTS)
- Advances + best-3rd indicators
- Per-group match list with collapsible cards
- Tap any team to drill into their detail page

### 🏳️ Teams
- All 48 nations with **squad breakdowns by domestic league** (Premier League, La Liga, Bundesliga, etc.)
- Player rankings highlighted on club affiliations
- Per-team bracket projection ("vs 🇸🇦 Saudi Arabia 37% · 🇨🇻 Cape Verde 36% · 🇪🇸 Spain 20%")
- Schedule with W/L/D results
- Filter teams by league concentration

---

## Tech stack

- **Vanilla TypeScript** — no React, no Vue; compiled via [Vite](https://vite.dev)
- **Custom reactive layer** — ~50 lines of `createStore` / `persistedStore` / `persistedCache` doing all state management
- **`src/main.ts`** — all app logic; **`src/styles.css`** — all styles; **`index.html`** — shell only
- **localStorage** for stateful preferences and stale-while-revalidate caching
- **No external runtime dependencies**

---

## Data sources

| Source | Used for | Endpoint |
|---|---|---|
| [openfootball/worldcup.json](https://github.com/openfootball/worldcup.json) | Schedule, squads, final scores | `worldcup.json` + `worldcup.squads.json` |
| [ESPN](https://site.api.espn.com) (unofficial) | Live scores, match events, lineups | `scoreboard` (polled 60s) + `summary` (on-demand per match) |

The ESPN `summary` endpoint is fetched lazily on match-card expand and **cached forever for finalized games**, so repeat visits are mostly localStorage hits.

---

## Architecture notes

### Reactivity
`createStore(init)` returns `{ get, set, sub }` — a tiny Redux-lite. `persistedStore(key, default, validator)` wraps it with localStorage write-through. `persistedCache(prefix, { ttl, maxEntries })` is a TTL'd keyed cache with `QuotaExceededError` recovery (evicts oldest 20% and retries on overflow).

### Bracket projection
Each `$data` or `$espn` change triggers a sim run: 5,000 Monte Carlo simulations of all remaining group games using FIFA-rank Elo + Poisson goal sampling. Each sim records which R32 slot each team lands in; bars show the distribution. A post-pass strips locked teams from slots they can't possibly fill (e.g., USA confirmed for slot M81 won't appear at 1% in M88 anymore). Cached in localStorage at `wc2026:sim:v3`.

### Suspension tracking
Walks each team's prior matches in chronological order, building a per-player `{ yellows, suspendedNext }` state. Applies FIFA 2026 "discipline blocks":
- Block 1: group stage
- Block 2: R32 + R16 + QF
- Block 3: SF + Final + 3rd-place

Single yellows reset at block boundaries; pending suspensions (red, second-yellow same match, two yellows same block) carry across. Just-in-time prefetch loads all prior-match summaries when an upcoming match card is expanded — cached responses cost nothing.

### Caching strategy

| Data | TTL | Strategy |
|---|---|---|
| Schedule (openfootball) | 30 min | Stale-while-revalidate |
| Squads (openfootball) | 24 hr | Stale-while-revalidate |
| ESPN summary (completed) | ∞ | Cache forever — finalized matches don't change |
| ESPN summary (live) | — | Never cached |
| ESPN scoreboard | — | Polled every 60s |
| Monte Carlo sim | event-driven | Re-run on every score update |

### Resilience
All network fetches use `AbortSignal.timeout(8000)` so a hung CDN connection can't pin the app on a loading state. Schedule and squad fetches race both `raw.githubusercontent.com` and `cdn.jsdelivr.net` in parallel via `Promise.any` — whichever responds first wins.

---

## Running locally

```bash
git clone https://github.com/mplachter/World-Cup-App
cd World-Cup-App
npm install
npm run dev        # Vite dev server with HMR → http://localhost:5173
```

Other commands:

| Command | What it does |
|---|---|
| `npm run dev` | Start dev server with hot module replacement |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Serve the `dist/` build locally |
| `npm run typecheck` | TypeScript type check (`tsc --noEmit`) |
| `npm run lint` | ESLint on `src/` |

## CI/CD

GitHub Actions runs on every push and PR:

- **CI** (`.github/workflows/ci.yml`) — typecheck → lint → build on every push/PR to `main`
- **Deploy** (`.github/workflows/deploy.yml`) — builds and deploys to GitHub Pages on push to `main`

To enable GitHub Pages deployment: repo Settings → Pages → set Source to **GitHub Actions**.

---

## Browser support

Anything from the last ~2 years: Chrome 103+, Safari 16+, Firefox 100+. The app uses `AbortSignal.timeout`, optional chaining, and a few other modern features — but no exotic APIs.

---

## Known limitations

- **Player name matching** between ESPN and openfootball is fuzzy (diacritics stripped, alphanumeric compared). Most matches; some edge cases (shortened names, transliterations) can slip through. Console logs the raw ESPN data when a match falls through so it's debuggable.
- **Disciplinary committee suspensions** (multi-match bans handed down for severe reds) aren't surfaced — we assume one-match for every red.
- **ESPN's `fifa.world` league code** doesn't post lineups for every match consistently. Pre-match lineups usually arrive ~30 min before kickoff.

---

## Acknowledgments

- **[openfootball](https://github.com/openfootball)** for an excellent open data feed
- **ESPN** for the unofficial scoreboard/summary endpoints
- Bracket geometry, defensive ESPN parsing, and FIFA suspension block logic all went through many iterations with [Claude](https://www.anthropic.com/claude) helping debug and refine

---

## License

MIT — do whatever.
