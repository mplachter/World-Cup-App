import type { Match } from './types';
import { FIFA, GROUPS, pkey, calcStandings, getMatchWinner, parseScore, normName, getPlayerRank, BRACKET_FEEDS, BRACKET_THIRD_PLACE_FEEDS } from './constants';
import { createStore } from './store';
import { SQUADS } from './state';
import { computeSuspensions, prefetchSuspensionData } from './suspensions';
import annexCData from './data/annex-c.json';

export const $sim = createStore<{ status:string; data:unknown; trials:number; completed:number; elapsedMs:number; key:string; cachedKey:string; savedAt?:number }>(
  { status:'idle', data:null, trials:0, completed:0, elapsedMs:0, key:'', cachedKey:'' }
);
export const SIM_TRIALS_DEFAULT = 5000;
export const SIM_CHUNK = 250;
export const SIM_LS_KEY = 'wc2026:sim:v7'; // v7: adds recent-form and suspension Elo adjustments
let _simCancelled = false;

function loadCachedSim() {
  try {
    const raw = localStorage.getItem(SIM_LS_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (obj && obj.data && obj.key) return obj;
  } catch {}
  return null;
}
function saveCachedSim(payload: unknown) {
  try { localStorage.setItem(SIM_LS_KEY, JSON.stringify(payload)); } catch {}
}

export function dataFingerprint(byKey: Record<string, Match>): string {
  return Object.values(byKey||{}).filter(e=>e.score)
    .map(e=>e.home+'|'+e.away+'='+e.score).sort().join(',');
}

// Hydrate $sim from localStorage on startup
(function hydrateSim() {
  const cached = loadCachedSim();
  if (cached) {
    $sim.set({ status:'done', data:cached.data, trials:cached.trials||SIM_TRIALS_DEFAULT,
      completed:cached.trials||SIM_TRIALS_DEFAULT, elapsedMs:cached.elapsedMs||0,
      key:cached.key, cachedKey:cached.key, savedAt:cached.savedAt||0 });
  }
})();

export function cancelSimulation() { _simCancelled = true; }

// ─── ANNEX C — FIFA CANONICAL THIRD-PLACE LOOKUP TABLE ──────────────────────

// Map column index → R32 match number (per FIFA's published bracket schedule)
const ANNEX_C_COL_TO_MATCH = [79, 85, 81, 74, 82, 77, 87, 80];

const ANNEX_C_LOOKUP = new Map<string, string>(
  Object.entries(annexCData as Record<string, string>)
);

// Backtracking fallback: 8x5 allowed-source mapping per slot.
const ANNEX_C_SLOTS = [
  { match: 74, winnerGroup: 'E', allowed: ['A','B','C','D','F'] },
  { match: 77, winnerGroup: 'I', allowed: ['C','D','F','G','H'] },
  { match: 79, winnerGroup: 'A', allowed: ['C','E','F','H','I'] },
  { match: 80, winnerGroup: 'L', allowed: ['E','H','I','J','K'] },
  { match: 81, winnerGroup: 'D', allowed: ['B','E','F','I','J'] },
  { match: 82, winnerGroup: 'G', allowed: ['A','E','H','I','J'] },
  { match: 85, winnerGroup: 'B', allowed: ['E','F','G','I','J'] },
  { match: 87, winnerGroup: 'K', allowed: ['D','E','I','J','L'] },
];

function assignThirds(thirdGroups: string[], randomize: boolean): Record<number, string> {
  if (thirdGroups.length !== 8) return {};
  const key = [...thirdGroups].sort().join('');
  const assignment = ANNEX_C_LOOKUP.get(key);
  if (assignment && assignment.length === 8) {
    const result: Record<number, string> = {};
    for (let i = 0; i < 8; i++) {
      result[ANNEX_C_COL_TO_MATCH[i]] = assignment[i];
    }
    return result;
  }
  const slots = ANNEX_C_SLOTS.map(s => {
    const valid = thirdGroups.filter(g => s.allowed.includes(g));
    if (randomize) {
      for (let i = valid.length - 1; i > 0; i--) {
        const j = (Math.random() * (i+1)) | 0;
        [valid[i], valid[j]] = [valid[j], valid[i]];
      }
    }
    return { ...s, valid };
  }).sort((a,b) => a.valid.length - b.valid.length);
  const used = new Set<string>();
  const result: Record<number, string> = {};
  function backtrack(idx: number): boolean {
    if (idx === slots.length) return true;
    const slot = slots[idx];
    for (const g of slot.valid) {
      if (used.has(g)) continue;
      used.add(g);
      result[slot.match] = g;
      if (backtrack(idx + 1)) return true;
      used.delete(g);
      delete result[slot.match];
    }
    return false;
  }
  return backtrack(0) ? result : {};
}

// ─── MONTE CARLO SIMULATOR ───────────────────────────────────────────────────
export function rankToElo(rank: number): number {
  if (!rank || rank > 200) return 1500;
  return 2080 - (rank - 1) * 9;
}
function poissonSample(lambda: number): number {
  if (lambda <= 0) return 0;
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= Math.random(); } while (p > L);
  return k - 1;
}
// dHome/dAway are Elo adjustments layered on top of the static FIFA-rank Elo —
// recent form and (for a team's immediate next match only) suspension impact.
export function eloExpectation(home: string, away: string, dHome = 0, dAway = 0): number {
  const eH = rankToElo(FIFA[home]) + dHome;
  const eA = rankToElo(FIFA[away]) + dAway;
  return 1 / (1 + Math.pow(10, (eA - eH) / 400));
}
function simulateMatch(home: string, away: string, dHome = 0, dAway = 0): { h: number; a: number } {
  const expH = eloExpectation(home, away, dHome, dAway);
  const lH = Math.max(0.25, 1.35 + 1.4 * (expH - 0.5));
  const lA = Math.max(0.25, 1.35 + 1.4 * ((1 - expH) - 0.5));
  return { h: poissonSample(lH), a: poissonSample(lA) };
}
// Knockout matches can't end level — fall back to a penalty-shootout coin flip
// weighted by Elo when regulation+ET nets a draw.
function simulateKnockoutWinner(home: string, away: string, dHome = 0, dAway = 0): string {
  const r = simulateMatch(home, away, dHome, dAway);
  if (r.h !== r.a) return r.h > r.a ? home : away;
  return Math.random() < eloExpectation(home, away, dHome, dAway) ? home : away;
}

// ─── FORM / MOMENTUM & SUSPENSIONS ───────────────────────────────────────────
const TEAM_GROUP: Record<string, string> = {};
Object.entries(GROUPS).forEach(([g, teams]) => teams.forEach(t => { TEAM_GROUP[t] = g; }));

const FORM_WEIGHTS = [0.5, 0.3, 0.2]; // most recent match first
const FORM_ELO_CAP = 60;
const DEAD_RUBBER_WEIGHT_MULT = 0.2; // discount, don't drop — a rotated loss still carries a little signal
const SUSPENSION_ELO_CAP = 60;

// Whether `team` had already mathematically clinched a top-2 (qualifying) group
// finish using only matches with `date < beforeDate` — used to discount dead
// rubbers (teams resting starters once already through) in the form score.
export function isClinchedTop2(team: string, group: string, filteredByKey: Record<string, Match>): boolean {
  const std = calcStandings(group, filteredByKey);
  const me = std.find(r => r.team === team);
  if (!me) return false;
  const totalGames = GROUPS[group].length - 1;
  const remaining: Record<string, number> = {};
  std.forEach(r => { remaining[r.team] = totalGames - r.mp; });
  const myGd = me.gf - me.ga;
  let threats = 0;
  for (const r of std) {
    if (r.team === team) continue;
    const maxPts = r.pts + 3 * remaining[r.team];
    if (maxPts > me.pts) { threats++; continue; }
    if (maxPts === me.pts) {
      const maxGd = (r.gf - r.ga) + 3 * remaining[r.team];
      if (maxGd >= myGd) threats++;
    }
  }
  return threats < 2;
}
export function wasAlreadyQualifiedBefore(team: string, group: string, byKey: Record<string, Match>, beforeDate: string): boolean {
  const filtered: Record<string, Match> = {};
  Object.entries(byKey).forEach(([k, e]) => {
    if (e.stage === 'group' && e.group === group && e.score && e.date && e.date < beforeDate) filtered[k] = e;
  });
  return isClinchedTop2(team, group, filtered);
}

// Recency-weighted result/goal-diff nudge from each team's last 3 completed
// matches, converted to a capped Elo delta. Dead-rubber group games (played
// after the team already clinched qualification) are heavily downweighted.
export function computeFormDelta(byKey: Record<string, Match>): Record<string, number> {
  const byTeam: Record<string, Match[]> = {};
  Object.values(byKey).forEach(m => {
    if (!m.score || !m.date) return;
    (byTeam[m.home] ||= []).push(m);
    (byTeam[m.away] ||= []).push(m);
  });
  const out: Record<string, number> = {};
  Object.entries(byTeam).forEach(([team, matches]) => {
    const recent = matches.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, FORM_WEIGHTS.length);
    let weighted = 0, totalWeight = 0;
    recent.forEach((m, i) => {
      const sc = parseScore(m.score);
      if (!sc) return;
      const isHome = m.home === team;
      const gf = isHome ? sc.h : sc.a, ga = isHome ? sc.a : sc.h;
      const resultScore = gf > ga ? 1 : gf < ga ? -1 : 0;
      const gdComponent = Math.max(-2, Math.min(2, gf - ga)) * 0.15;
      let w = FORM_WEIGHTS[i];
      if (m.stage === 'group' && m.group && wasAlreadyQualifiedBefore(team, m.group, byKey, m.date)) {
        w *= DEAD_RUBBER_WEIGHT_MULT;
      }
      weighted += w * (resultScore + gdComponent);
      totalWeight += w;
    });
    out[team] = totalWeight > 0
      ? Math.max(-FORM_ELO_CAP, Math.min(FORM_ELO_CAP, (weighted / totalWeight) * FORM_ELO_CAP))
      : 0;
  });
  return out;
}

// Best-effort suspended-player impact: star quality (PLAYER_RANK) × a position
// multiplier (goalkeepers weighted heavier — squads carry few specialists).
// There's no "is this player a starter" data available outside lazily-fetched
// lineups, so this isn't a true missing-starter model, just a useful proxy.
export function suspensionBasePenalty(rank: number | null): number {
  if (rank && rank <= 10) return 35;
  if (rank && rank <= 30) return 20;
  return 8;
}
export function suspensionPositionMultiplier(pos: string | undefined): number {
  return pos === 'GK' ? 1.6 : 1;
}
// Combines per-player base × position-multiplier penalties into one capped
// team-level Elo delta — the piece worth unit-testing in isolation.
export function combineSuspensionPenalty(players: { rank: number | null; pos?: string }[]): number {
  if (!players.length) return 0;
  const total = players.reduce((sum, p) => sum + suspensionBasePenalty(p.rank) * suspensionPositionMultiplier(p.pos), 0);
  return -Math.min(SUSPENSION_ELO_CAP, total);
}
function findSquadPlayer(team: string, playerName: string) {
  const squad = SQUADS[team];
  if (!squad) return undefined;
  const target = normName(playerName);
  return squad.find(p => normName(p.name) === target);
}
function suspensionPenaltyForTeam(team: string, date: string, stage: string): number {
  const { suspended } = computeSuspensions(team, date, stage);
  if (!suspended.length) return 0;
  return combineSuspensionPenalty(suspended.map(s => ({
    rank: getPlayerRank(s.name),
    pos: findSquadPlayer(team, s.name)?.pos,
  })));
}

const R32_STRUCTURE = [
  { num:73, home:{kind:'runnerup',group:'A'}, away:{kind:'runnerup',group:'B'} },
  { num:74, home:{kind:'winner',  group:'E'}, away:{kind:'third',   match:74}  },
  { num:75, home:{kind:'winner',  group:'F'}, away:{kind:'runnerup',group:'C'} },
  { num:76, home:{kind:'winner',  group:'C'}, away:{kind:'runnerup',group:'F'} },
  { num:77, home:{kind:'winner',  group:'I'}, away:{kind:'third',   match:77}  },
  { num:78, home:{kind:'runnerup',group:'E'}, away:{kind:'runnerup',group:'I'} },
  { num:79, home:{kind:'winner',  group:'A'}, away:{kind:'third',   match:79}  },
  { num:80, home:{kind:'winner',  group:'L'}, away:{kind:'third',   match:80}  },
  { num:81, home:{kind:'winner',  group:'D'}, away:{kind:'third',   match:81}  },
  { num:82, home:{kind:'winner',  group:'G'}, away:{kind:'third',   match:82}  },
  { num:83, home:{kind:'runnerup',group:'K'}, away:{kind:'runnerup',group:'L'} },
  { num:84, home:{kind:'winner',  group:'H'}, away:{kind:'runnerup',group:'J'} },
  { num:85, home:{kind:'winner',  group:'B'}, away:{kind:'third',   match:85}  },
  { num:86, home:{kind:'winner',  group:'J'}, away:{kind:'runnerup',group:'H'} },
  { num:87, home:{kind:'winner',  group:'K'}, away:{kind:'third',   match:87}  },
  { num:88, home:{kind:'runnerup',group:'D'}, away:{kind:'runnerup',group:'G'} },
];

export async function startSimulation(byKey: Record<string, Match>, byNum: Record<string, Match>, trials: number) {
  trials = trials || SIM_TRIALS_DEFAULT;
  const key = dataFingerprint(byKey);
  _simCancelled = false;
  $sim.set({ status:'running', data:null, trials, completed:0, elapsedMs:0, key, cachedKey:$sim.get().cachedKey });

  const t0 = performance.now();
  const GRPS = 'ABCDEFGHIJKL'.split('');
  const counts: Record<number, { home: Record<string, number>; away: Record<string, number> }> = {};
  for (let n = 73; n <= 104; n++) counts[n] = { home: {}, away: {} };

  // If a knockout match has an actual final result, use the real winner every
  // trial instead of resimulating it — same principle as `existing` for group games.
  function decideWinner(num: number, home: string | undefined, away: string | undefined, dHome = 0, dAway = 0): string | undefined {
    if (!home || !away) return undefined;
    const real = byNum[String(num)];
    if (real && real.score && real.home === home && real.away === away) {
      const w = getMatchWinner(real);
      if (w) return w;
    }
    return simulateKnockoutWinner(home, away, dHome, dAway);
  }

  const allGroupPairs: { key:string; group:string; home:string; away:string; existing: Match | null }[] = [];
  GRPS.forEach(g => {
    const t = GROUPS[g];
    for (let i=0;i<t.length;i++) for (let j=i+1;j<t.length;j++) {
      const pk = pkey(t[i], t[j]);
      const existing = byKey[pk];
      allGroupPairs.push({ key:pk, group:g, home:t[i], away:t[j],
        existing: existing && existing.score ? existing : null });
    }
  });

  // Recent-form Elo nudge, computed once from real results (doesn't vary by trial).
  const formDelta = computeFormDelta(byKey);

  // Suspension Elo nudge — only knowable for each team's immediate next unplayed
  // fixture, since future-round suspensions depend on cards from hypothetical
  // matches that haven't been simulated yet.
  const teamNextGroupFixture: Record<string, { key: string; date: string }> = {};
  allGroupPairs.forEach(p => {
    if (p.existing) return;
    const date = byKey[p.key]?.date || '';
    [p.home, p.away].forEach(team => {
      const cur = teamNextGroupFixture[team];
      if (!cur || (date && date < cur.date)) teamNextGroupFixture[team] = { key: p.key, date };
    });
  });
  const r32Dates = R32_STRUCTURE.map(s => byNum[String(s.num)]?.date).filter(Boolean) as string[];
  const earliestR32Date = r32Dates.length ? r32Dates.slice().sort()[0] : '';

  const suspensionDelta: Record<string, number> = {};
  const suspensionGroupKey: Record<string, string> = {};
  const suspensionKnockoutTeams = new Set<string>();
  await Promise.all(Object.keys(TEAM_GROUP).map(async team => {
    const nextGroup = teamNextGroupFixture[team];
    const date = nextGroup ? nextGroup.date : earliestR32Date;
    const stage = nextGroup ? 'group' : 'r32';
    try { await prefetchSuspensionData(team, team, date); } catch { /* best-effort: missing data just means no penalty */ }
    const penalty = suspensionPenaltyForTeam(team, date, stage);
    if (!penalty) return;
    suspensionDelta[team] = penalty;
    if (nextGroup) suspensionGroupKey[team] = nextGroup.key;
    else suspensionKnockoutTeams.add(team);
  }));
  if (_simCancelled) {
    $sim.set({ status:'idle', data:null, trials:0, completed:0, elapsedMs:0,
      key:'', cachedKey: $sim.get().cachedKey });
    return;
  }

  for (let trial = 0; trial < trials; trial++) {
    const simByKey: Record<string, Match> = {};
    for (const p of allGroupPairs) {
      if (p.existing) { simByKey[p.key] = p.existing; }
      else {
        const dH = (formDelta[p.home] || 0) + (suspensionGroupKey[p.home] === p.key ? suspensionDelta[p.home] : 0);
        const dA = (formDelta[p.away] || 0) + (suspensionGroupKey[p.away] === p.key ? suspensionDelta[p.away] : 0);
        const r = simulateMatch(p.home, p.away, dH, dA);
        simByKey[p.key] = { home:p.home, away:p.away, score: r.h+'-'+r.a, stage:'group', ht:null, pen:null, goals1:[], goals2:[], date:'', time:'', ground:null, round:null, num:null };
      }
    }
    const st: Record<string, ReturnType<typeof calcStandings>> = {};
    GRPS.forEach(g => { st[g] = calcStandings(g, simByKey); });
    const thirds = GRPS.map(g => {
      const row = st[g][2];
      return row ? { team:row.team, group:g, pts:row.pts, gd:row.gf-row.ga, gf:row.gf, fifa:FIFA[row.team]||99 } : null;
    }).filter((x): x is NonNullable<typeof x> => x !== null).sort((a,b) =>
      b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.fifa - b.fifa
    );
    const top8Groups = thirds.slice(0,8).map(t => t.group);
    const assignment = top8Groups.length === 8 ? assignThirds(top8Groups, true) : {};

    const slotTeam: Record<number, { home?: string; away?: string }> = {};
    const winnerOf: Record<number, string | undefined> = {};

    for (const s of R32_STRUCTURE) {
      const side = (sideSpec: { kind: string; group?: string; match?: number }) => {
        if (sideSpec.kind === 'winner')   return st[sideSpec.group!][0]?.team;
        if (sideSpec.kind === 'runnerup') return st[sideSpec.group!][1]?.team;
        if (sideSpec.kind === 'third') {
          const g = assignment[sideSpec.match!];
          return g ? thirds.find(t => t.group === g)?.team : null;
        }
        return null;
      };
      const hT = side(s.home as { kind: string; group?: string; match?: number }) ?? undefined;
      const aT = side(s.away as { kind: string; group?: string; match?: number }) ?? undefined;
      slotTeam[s.num] = { home: hT, away: aT };
      if (hT) counts[s.num].home[hT] = (counts[s.num].home[hT] || 0) + 1;
      if (aT) counts[s.num].away[aT] = (counts[s.num].away[aT] || 0) + 1;
      const dH = (formDelta[hT || ''] || 0) + (hT && suspensionKnockoutTeams.has(hT) ? suspensionDelta[hT] : 0);
      const dA = (formDelta[aT || ''] || 0) + (aT && suspensionKnockoutTeams.has(aT) ? suspensionDelta[aT] : 0);
      winnerOf[s.num] = decideWinner(s.num, hT, aT, dH, dA);
    }

    // Propagate winners forward through R16 → QF → SF (match numbers increase
    // monotonically with round, so feeders are always already resolved). Only
    // form carries forward here — suspensions are only known for each team's
    // immediate next match, which was already applied at the R32 stage above.
    for (let num = 89; num <= 102; num++) {
      const feed = BRACKET_FEEDS[num];
      if (!feed) continue;
      const hT = winnerOf[feed.home];
      const aT = winnerOf[feed.away];
      slotTeam[num] = { home: hT, away: aT };
      if (hT) counts[num].home[hT] = (counts[num].home[hT] || 0) + 1;
      if (aT) counts[num].away[aT] = (counts[num].away[aT] || 0) + 1;
      winnerOf[num] = decideWinner(num, hT, aT, formDelta[hT || ''] || 0, formDelta[aT || ''] || 0);
    }

    // Final (104): semifinal winners.
    const finalH = winnerOf[101], finalA = winnerOf[102];
    if (finalH) counts[104].home[finalH] = (counts[104].home[finalH] || 0) + 1;
    if (finalA) counts[104].away[finalA] = (counts[104].away[finalA] || 0) + 1;

    // Third-place playoff (103): semifinal losers.
    const sf1 = slotTeam[BRACKET_THIRD_PLACE_FEEDS.home], sf2 = slotTeam[BRACKET_THIRD_PLACE_FEEDS.away];
    const loser1 = sf1 && winnerOf[BRACKET_THIRD_PLACE_FEEDS.home] ? (winnerOf[BRACKET_THIRD_PLACE_FEEDS.home] === sf1.home ? sf1.away : sf1.home) : undefined;
    const loser2 = sf2 && winnerOf[BRACKET_THIRD_PLACE_FEEDS.away] ? (winnerOf[BRACKET_THIRD_PLACE_FEEDS.away] === sf2.home ? sf2.away : sf2.home) : undefined;
    if (loser1) counts[103].home[loser1] = (counts[103].home[loser1] || 0) + 1;
    if (loser2) counts[103].away[loser2] = (counts[103].away[loser2] || 0) + 1;

    if ((trial + 1) % SIM_CHUNK === 0 || trial === trials - 1) {
      const cur = $sim.get();
      $sim.set({ ...cur, completed: trial + 1, elapsedMs: Math.round(performance.now() - t0) });
      await new Promise(r => setTimeout(r, 0));
      if (_simCancelled) {
        $sim.set({ status:'idle', data:null, trials:0, completed:0, elapsedMs:0,
          key:'', cachedKey: $sim.get().cachedKey });
        return;
      }
    }
  }

  const out: Record<string, { home: { team: string; pct: number }[]; away: { team: string; pct: number }[] }> = {};
  Object.entries(counts).forEach(([num, sides]) => {
    out[num] = {
      home: Object.entries(sides.home).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([team,c]) => ({team, pct:c/trials})),
      away: Object.entries(sides.away).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([team,c]) => ({team, pct:c/trials})),
    };
  });

  function isDominant(cands: { team: string; pct: number }[]) {
    if (!cands || !cands.length) return false;
    return cands[0].pct >= 0.9 || cands.slice(1).every(c => c.pct < 0.1);
  }
  // The dedup passes below resolve ambiguity from the third-place lottery, which
  // only affects which R32 slot a team lands in — R16+ pairings are a fixed tree
  // with no such cross-slot ambiguity, so they're left out of this scope.
  const r32Out = Object.entries(out).filter(([num]) => +num <= 88);
  const lockedTeams = new Set<string>();
  r32Out.forEach(([, sides]) => {
    if (isDominant(sides.home)) lockedTeams.add(sides.home[0].team);
    if (isDominant(sides.away)) lockedTeams.add(sides.away[0].team);
  });
  r32Out.forEach(([, sides]) => {
    (['home', 'away'] as const).forEach(side => {
      if (isDominant(sides[side])) return;
      sides[side] = sides[side].filter(c => !lockedTeams.has(c.team));
    });
  });

  let changed = true;
  let safety = 0;
  const isHardLocked = (cands: { team: string; pct: number }[]) => cands && cands.length && cands[0].pct >= 0.9;
  while (changed && safety < 20) {
    changed = false;
    safety++;
    const bestTopSlot: Record<string, { slotKey: string; pct: number }> = {};
    r32Out.forEach(([num, sides]) => {
      (['home','away'] as const).forEach(side => {
        const cands = sides[side];
        if (!cands || !cands.length) return;
        if (isHardLocked(cands)) return;
        const top = cands[0];
        const slotKey = num + '-' + side;
        if (!bestTopSlot[top.team] || top.pct > bestTopSlot[top.team].pct) {
          bestTopSlot[top.team] = { slotKey, pct: top.pct };
        }
      });
    });
    r32Out.forEach(([num, sides]) => {
      (['home','away'] as const).forEach(side => {
        const cands = sides[side];
        if (!cands || !cands.length) return;
        if (isHardLocked(cands)) return;
        const top = cands[0];
        const slotKey = num + '-' + side;
        const best = bestTopSlot[top.team];
        if (best && best.slotKey !== slotKey) {
          sides[side] = cands.filter(c => c.team !== top.team);
          changed = true;
        }
      });
    });
  }

  const elapsedMs = Math.round(performance.now() - t0);
  const savedAt = Date.now();
  saveCachedSim({ data: out, key, trials, elapsedMs, savedAt });
  $sim.set({ status:'done', data:out, trials, completed:trials, elapsedMs, key, cachedKey:key, savedAt });
}

// ─── BRACKET PROJECTION ───────────────────────────────────────────────────────
export function projectBracket(byKey: Record<string, Match>, _mode: string) {
  const GRPS = 'ABCDEFGHIJKL'.split('');
  const standings: Record<string, ReturnType<typeof calcStandings>> = {};
  GRPS.forEach(g => { standings[g] = calcStandings(g, byKey); });

  function getConfidence(g: string, pos: number) {
    const rows = standings[g];
    const gamesPlayed = rows.reduce((s,r)=>s+r.mp,0)/2;
    const totalGames = 6;
    if (gamesPlayed === totalGames) return 'confirmed';
    if (gamesPlayed === 0) return 'unknown';
    if (rows.length >= 2) {
      const leader = rows[pos];
      if (!leader) return 'unknown';
      const next = rows[pos + 1];
      if (!next) return 'projected';
      const ptDiff = leader.pts - next.pts;
      const gamesLeft = totalGames - gamesPlayed;
      if (ptDiff > gamesLeft * 3) return 'confirmed';
      if (ptDiff >= 3) return 'projected';
      return 'contested';
    }
    return 'unknown';
  }

  const W: Record<string, string | undefined> = {};
  const RU: Record<string, string | undefined> = {};
  const WCONF: Record<string, string> = {};
  const RUCONF: Record<string, string> = {};
  GRPS.forEach(g => {
    const rows = standings[g];
    W[g]  = rows[0]?.team;
    RU[g] = rows[1]?.team;
    WCONF[g]  = getConfidence(g, 0);
    RUCONF[g] = getConfidence(g, 1);
  });

  const thirds = GRPS.map(g => {
    const r = standings[g][2];
    return r ? { ...r, group: g, fifa: FIFA[r.team] || 99 } : null;
  }).filter((t): t is NonNullable<typeof t> => t !== null && !!t.team).sort((a,b) =>
    b.pts - a.pts || (b.gf-b.ga) - (a.gf-a.ga) || b.gf - a.gf || a.fifa - b.fifa
  );

  const top8 = thirds.slice(0, 8);
  const top8Groups = top8.map(t => t.group);
  const groupComplete = GRPS.every(g => standings[g].every(r => r.mp === 3));
  const thirdsConfidence = groupComplete ? 'projected' : (thirds.length >= 8 ? 'projected' : 'unknown');

  const thirdAssignment = top8Groups.length === 8 ? assignThirds(top8Groups, false) : {};

  function thirdSlotFor(matchNum: number) {
    const assignedGroup = thirdAssignment[matchNum];
    if (!assignedGroup) return { team:'3rd', confidence:'unknown', alts:[] };
    const thirdTeam = thirds.find(t => t.group === assignedGroup);
    return {
      team: thirdTeam?.team || ('3'+assignedGroup),
      confidence: thirdsConfidence,
      alts: []
    };
  }

  function teamSlot(team: string | undefined, confidence: string) {
    return { team: team || 'TBD', confidence: confidence || 'unknown', alts: [] };
  }

  const r32 = [
    { num:73, home: teamSlot(RU['A'],RUCONF['A']), away: teamSlot(RU['B'],RUCONF['B']), label:'M73' },
    { num:74, home: teamSlot(W['E'],WCONF['E']),   away: thirdSlotFor(74), label:'M74' },
    { num:75, home: teamSlot(W['F'],WCONF['F']),   away: teamSlot(RU['C'],RUCONF['C']), label:'M75' },
    { num:76, home: teamSlot(W['C'],WCONF['C']),   away: teamSlot(RU['F'],RUCONF['F']), label:'M76' },
    { num:77, home: teamSlot(W['I'],WCONF['I']),   away: thirdSlotFor(77), label:'M77' },
    { num:78, home: teamSlot(RU['E'],RUCONF['E']), away: teamSlot(RU['I'],RUCONF['I']), label:'M78' },
    { num:79, home: teamSlot(W['A'],WCONF['A']),   away: thirdSlotFor(79), label:'M79' },
    { num:80, home: teamSlot(W['L'],WCONF['L']),   away: thirdSlotFor(80), label:'M80' },
    { num:81, home: teamSlot(W['D'],WCONF['D']),   away: thirdSlotFor(81), label:'M81' },
    { num:82, home: teamSlot(W['G'],WCONF['G']),   away: thirdSlotFor(82), label:'M82' },
    { num:83, home: teamSlot(RU['K'],RUCONF['K']), away: teamSlot(RU['L'],RUCONF['L']), label:'M83' },
    { num:84, home: teamSlot(W['H'],WCONF['H']),   away: teamSlot(RU['J'],RUCONF['J']), label:'M84' },
    { num:85, home: teamSlot(W['B'],WCONF['B']),   away: thirdSlotFor(85), label:'M85' },
    { num:86, home: teamSlot(W['J'],WCONF['J']),   away: teamSlot(RU['H'],RUCONF['H']), label:'M86' },
    { num:87, home: teamSlot(W['K'],WCONF['K']),   away: thirdSlotFor(87), label:'M87' },
    { num:88, home: teamSlot(RU['D'],RUCONF['D']), away: teamSlot(RU['G'],RUCONF['G']), label:'M88' },
  ];

  return { r32, thirds, standings };
}

// ─── MATH LOCK ────────────────────────────────────────────────────────────────
const _mathLockCache: { byKeyFingerprint: string; locks: Record<string, { group: string; position: number }> } = { byKeyFingerprint: '', locks: {} };
export function getMathLocks(byKey: Record<string, Match>): Record<string, { group: string; position: number }> {
  const fp = dataFingerprint(byKey);
  if (_mathLockCache.byKeyFingerprint === fp) return _mathLockCache.locks;
  const GRPS = 'ABCDEFGHIJKL'.split('');
  const locks: Record<string, { group: string; position: number }> = {};
  GRPS.forEach(g => {
    const std = calcStandings(g, byKey);
    if (!std.length) return;
    const remaining: Record<string, number> = {};
    std.forEach(r => { remaining[r.team] = 0; });
    Object.values(byKey).forEach(e => {
      if (e.stage !== 'group' || e.group !== g) return;
      if (e.score) return;
      if (remaining[e.home] !== undefined) remaining[e.home]++;
      if (remaining[e.away] !== undefined) remaining[e.away]++;
    });
    const groupFinished = std.every(r => remaining[r.team] === 0);
    if (groupFinished) {
      std.forEach((r, idx) => { locks[r.team] = { group: g, position: idx }; });
      return;
    }
    std.forEach((r, idx) => {
      if (remaining[r.team] > 0) return;
      const myPts = r.pts, myGd = r.gf - r.ga;
      let lockedHere = true;
      for (let j = idx + 1; j < std.length; j++) {
        const other = std[j];
        const otherMaxPts = other.pts + 3 * remaining[other.team];
        if (otherMaxPts > myPts) { lockedHere = false; break; }
        if (otherMaxPts === myPts) {
          const otherMaxGd = (other.gf - other.ga) + 3 * remaining[other.team];
          if (otherMaxGd >= myGd) { lockedHere = false; break; }
        }
      }
      for (let j = idx - 1; j >= 0; j--) {
        const above = std[j];
        const aboveMinPts = above.pts;
        if (aboveMinPts < myPts) { lockedHere = false; break; }
        if (aboveMinPts === myPts) {
          const aboveMinGd = (above.gf - above.ga) - 3 * remaining[above.team];
          if (aboveMinGd <= myGd) { lockedHere = false; break; }
        }
      }
      if (lockedHere) locks[r.team] = { group: g, position: idx };
    });
  });
  _mathLockCache.byKeyFingerprint = fp;
  _mathLockCache.locks = locks;
  return locks;
}
