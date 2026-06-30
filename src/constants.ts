import type { Match, MatchData, Player, Standing, RawGoal } from './types';

// ─── WORLD DATA ───────────────────────────────────────────────────────────────

export const FIFA: Record<string, number> = {
  Argentina: 1,
  Spain: 2,
  France: 3,
  England: 4,
  Portugal: 5,
  Brazil: 6,
  Morocco: 7,
  Netherlands: 8,
  Belgium: 9,
  Germany: 10,
  Croatia: 11,
  Colombia: 12,
  Mexico: 14,
  Senegal: 15,
  Uruguay: 16,
  USA: 17,
  Japan: 18,
  Switzerland: 19,
  'South Korea': 20,
  Turkey: 21,
  Norway: 22,
  Sweden: 23,
  Ghana: 24,
  Egypt: 25,
  Canada: 26,
  'Ivory Coast': 27,
  Algeria: 28,
  'Saudi Arabia': 29,
  Austria: 30,
  Ecuador: 31,
  Scotland: 32,
  Paraguay: 33,
  Tunisia: 34,
  Qatar: 35,
  Australia: 36,
  Iran: 37,
  'Bosnia and Herzegovina': 38,
  'Czech Republic': 39,
  Panama: 40,
  'DR Congo': 41,
  Uzbekistan: 42,
  'South Africa': 43,
  Iraq: 44,
  Jordan: 45,
  'Cape Verde': 46,
  'New Zealand': 47,
  Haiti: 48,
  Curaçao: 49,
};

export const FLAG: Record<string, string> = {
  Argentina: '🇦🇷',
  Spain: '🇪🇸',
  France: '🇫🇷',
  England: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  Portugal: '🇵🇹',
  Brazil: '🇧🇷',
  Morocco: '🇲🇦',
  Netherlands: '🇳🇱',
  Belgium: '🇧🇪',
  Germany: '🇩🇪',
  Croatia: '🇭🇷',
  Colombia: '🇨🇴',
  Mexico: '🇲🇽',
  Senegal: '🇸🇳',
  Uruguay: '🇺🇾',
  USA: '🇺🇸',
  Japan: '🇯🇵',
  Switzerland: '🇨🇭',
  'South Korea': '🇰🇷',
  Turkey: '🇹🇷',
  Norway: '🇳🇴',
  Sweden: '🇸🇪',
  Ghana: '🇬🇭',
  Egypt: '🇪🇬',
  Canada: '🇨🇦',
  'Ivory Coast': '🇨🇮',
  Algeria: '🇩🇿',
  'Saudi Arabia': '🇸🇦',
  Austria: '🇦🇹',
  Ecuador: '🇪🇨',
  Scotland: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  Paraguay: '🇵🇾',
  Tunisia: '🇹🇳',
  Qatar: '🇶🇦',
  Australia: '🇦🇺',
  Iran: '🇮🇷',
  'Bosnia and Herzegovina': '🇧🇦',
  'Czech Republic': '🇨🇿',
  Panama: '🇵🇦',
  'DR Congo': '🇨🇩',
  Uzbekistan: '🇺🇿',
  'South Africa': '🇿🇦',
  Iraq: '🇮🇶',
  Jordan: '🇯🇴',
  'Cape Verde': '🇨🇻',
  'New Zealand': '🇳🇿',
  Haiti: '🇭🇹',
  Curaçao: '🇨🇼',
};

export const GROUPS: Record<string, string[]> = {
  A: ['Mexico', 'South Africa', 'South Korea', 'Czech Republic'],
  B: ['Canada', 'Bosnia and Herzegovina', 'Qatar', 'Switzerland'],
  C: ['Brazil', 'Morocco', 'Haiti', 'Scotland'],
  D: ['USA', 'Paraguay', 'Australia', 'Turkey'],
  E: ['Germany', 'Curaçao', 'Ivory Coast', 'Ecuador'],
  F: ['Netherlands', 'Japan', 'Sweden', 'Tunisia'],
  G: ['Belgium', 'Egypt', 'Iran', 'New Zealand'],
  H: ['Spain', 'Cape Verde', 'Saudi Arabia', 'Uruguay'],
  I: ['France', 'Senegal', 'Iraq', 'Norway'],
  J: ['Argentina', 'Algeria', 'Austria', 'Jordan'],
  K: ['Portugal', 'DR Congo', 'Uzbekistan', 'Colombia'],
  L: ['England', 'Croatia', 'Ghana', 'Panama'],
};

// ─── PLAYER RANKINGS ─────────────────────────────────────────────────────────
// Hardcoded ranking of recognizable stars. Anchored to Ballon d'Or 2024 final
// order (top 1-25, retirees skipped) plus a tail of well-known 2026 WC players
// not in that list. Name lookup is normalized (diacritics stripped, lowercase,
// alphanumeric only) so matching is forgiving across openfootball name forms.

// Strip diacritics, lowercase, keep only alphanumeric — used for fuzzy name matching.
export function normName(name: string): string {
  return (name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

const _RAW_PLAYER_RANKS: [number, string][] = [
  [1, 'Rodri'],
  [2, 'Vinícius Júnior'],
  [3, 'Jude Bellingham'],
  [4, 'Dani Carvajal'],
  [5, 'Erling Haaland'],
  [6, 'Kylian Mbappé'],
  [7, 'Lautaro Martínez'],
  [8, 'Lamine Yamal'],
  [10, 'Harry Kane'],
  [11, 'Federico Valverde'],
  [12, 'Cole Palmer'],
  [13, 'Florian Wirtz'],
  [14, 'Bukayo Saka'],
  [15, 'Granit Xhaka'],
  [16, 'Phil Foden'],
  [17, 'Emiliano Martínez'],
  [18, 'Antonio Rüdiger'],
  [19, 'William Saliba'],
  [20, 'Hakan Çalhanoğlu'],
  [21, 'Vitinha'],
  [22, 'Declan Rice'],
  [23, 'Nico Williams'],
  [24, 'Dani Olmo'],
  [25, 'Mikel Merino'],
  [31, 'Lionel Messi'],
  [32, 'Mohamed Salah'],
  [33, 'Kevin De Bruyne'],
  [34, 'Heung-Min Son'],
  [34, 'Son Heung-min'],
  [35, 'Pedri'],
  [36, 'Rodrygo'],
  [37, 'Raphinha'],
  [38, 'Casemiro'],
  [39, 'Marquinhos'],
  [40, 'Achraf Hakimi'],
  [41, 'Christian Pulisic'],
  [42, 'Folarin Balogun'],
  [43, 'Antonee Robinson'],
  [44, 'Bruno Fernandes'],
  [45, 'Bernardo Silva'],
  [46, 'Rúben Dias'],
  [47, 'Joshua Kimmich'],
  [48, 'Jamal Musiala'],
  [49, 'Ousmane Dembélé'],
  [50, 'Antoine Griezmann'],
  [51, 'Neymar'],
  [52, 'Gavi'],
  [53, 'Aurélien Tchouaméni'],
  [54, 'Marcus Thuram'],
  [55, 'Bruno Guimarães'],
  [56, 'Marcus Rashford'],
  [57, 'Kobbie Mainoo'],
  [58, 'Endrick'],
  [59, 'Lucas Paquetá'],
  [60, 'Ferran Torres'],
  [61, 'Michael Olise'],
  [62, 'Matheus Cunha'],
  [63, 'Gabriel Martinelli'],
  [64, 'Mikel Oyarzabal'],
  [65, 'Eberechi Eze'],
];
export const PLAYER_RANK: Record<string, number> = {};
_RAW_PLAYER_RANKS.forEach(([r, n]) => {
  PLAYER_RANK[normName(n)] = r;
});
export function getPlayerRank(name: string): number | null {
  return PLAYER_RANK[normName(name)] || null;
}

// ─── LEAGUES ─────────────────────────────────────────────────────────────────

export const LEAGUES = [
  'Premier League',
  'La Liga',
  'Bundesliga',
  'Ligue 1',
  'Serie A',
  'Primeira Liga',
  'Eredivisie',
  'Saudi Pro League',
  'MLS',
  'Süper Lig',
  'Scottish Prem',
  'Other',
];
export const LC: Record<string, string> = {
  'Premier League': '#4c1d95',
  'La Liga': '#991b1b',
  Bundesliga: '#92400e',
  'Ligue 1': '#1e3a5f',
  'Serie A': '#14532d',
  'Primeira Liga': '#065f46',
  Eredivisie: '#6d28d9',
  'Saudi Pro League': '#78350f',
  MLS: '#1d4ed8',
  'Süper Lig': '#be123c',
  'Scottish Prem': '#1e40af',
  Other: '#292524',
};

// Openfootball club.country (FIFA/IOC 3-letter) → display league
export const COUNTRY_TO_LEAGUE: Record<string, string> = {
  ENG: 'Premier League',
  ESP: 'La Liga',
  GER: 'Bundesliga',
  FRA: 'Ligue 1',
  ITA: 'Serie A',
  POR: 'Primeira Liga',
  NED: 'Eredivisie',
  KSA: 'Saudi Pro League',
  SAU: 'Saudi Pro League',
  USA: 'MLS',
  TUR: 'Süper Lig',
  SCO: 'Scottish Prem',
};
export const POS_MAP: Record<string, string> = { GK: 'GK', DF: 'DEF', MF: 'MID', FW: 'FWD' };

// Openfootball team-name normalization — match our internal keys
export const SQUAD_NAME_NORM: Record<string, string> = {
  'United States': 'USA',
  'Korea Republic': 'South Korea',
  "Côte d'Ivoire": 'Ivory Coast',
  'Bosnia & Herzegovina': 'Bosnia and Herzegovina',
  'Bosnia and Herzegovina': 'Bosnia and Herzegovina',
  Czechia: 'Czech Republic',
  'Cape Verde': 'Cape Verde',
  Curaçao: 'Curaçao',
};

// ESPN team-name normalization
export const ESPN_NORM: Record<string, string> = {
  Czechia: 'Czech Republic',
  'Korea Republic': 'South Korea',
  "Cote d'Ivoire": 'Ivory Coast',
  "Côte d'Ivoire": 'Ivory Coast',
  'Bosnia-Herzegovina': 'Bosnia and Herzegovina',
  'DR Congo': 'DR Congo',
  Curacao: 'Curaçao',
  'Cape Verde': 'Cape Verde',
  'New Zealand': 'New Zealand',
  'Saudi Arabia': 'Saudi Arabia',
  Türkiye: 'Turkey',
  Turkiye: 'Turkey',
  'United States': 'USA',
  'US Virgin Islands': 'US Virgin Islands',
  'IR Iran': 'Iran',
  'Republic of Ireland': 'Ireland',
  Macedonia: 'North Macedonia',
};
export function espnNorm(n: string): string {
  return ESPN_NORM[n] || n;
}

// ─── NAME / KEY UTILITIES ─────────────────────────────────────────────────────

// Openfootball match team-name normalization
export const NORM: Record<string, string> = {
  'Bosnia & Herzegovina': 'Bosnia and Herzegovina',
  'United States': 'USA',
  "Côte d'Ivoire": 'Ivory Coast',
  'Korea Republic': 'South Korea',
};
export const norm = (t: string): string => NORM[t] || t;
export const pkey = (a: string, b: string): string => [norm(a), norm(b)].sort().join('|');

export function stageOf(r: string | null): string {
  if (!r) return 'group';
  const s = r.toLowerCase();
  if (s.includes('round of 32')) return 'r32';
  if (s.includes('round of 16')) return 'r16';
  if (s.includes('quarter')) return 'qf';
  if (s.includes('semi')) return 'sf';
  if (s.includes('third')) return '3rd';
  if (s.includes('final')) return 'final';
  return 'group';
}

// ─── BRACKET TREE ─────────────────────────────────────────────────────────────
// Knockout-stage match pairings (left/right half of the draw), per FIFA's published
// bracket. Single source of truth shared by simulation.ts (Monte Carlo propagation)
// and BracketView.tsx (layout + round-list navigation).
export const BRACKET_BL = {
  r32: [74, 76, 73, 75, 78, 77, 81, 82],
  r16: [89, 90, 91, 92],
  qf: [97, 99],
};
export const BRACKET_BR = {
  r32: [83, 84, 85, 87, 80, 86, 88, 79],
  r16: [93, 94, 95, 96],
  qf: [98, 100],
};

// BRACKET_FEEDS[num] = the two match numbers whose winners fill `num`'s home/away slots.
export const BRACKET_FEEDS: Record<number, { home: number; away: number }> = {};
export const BRACKET_NEXT: Record<number, number> = {};
export const BRACKET_SIBLING: Record<number, number> = {};
function _bracketPair(arr: number[], nextArr: number[]) {
  for (let i = 0; i < arr.length; i += 2) {
    const a = arr[i],
      b = arr[i + 1],
      n = nextArr[i / 2];
    BRACKET_NEXT[a] = n;
    BRACKET_NEXT[b] = n;
    BRACKET_SIBLING[a] = b;
    BRACKET_SIBLING[b] = a;
    BRACKET_FEEDS[n] = { home: a, away: b };
  }
}
_bracketPair(BRACKET_BL.r32, BRACKET_BL.r16);
_bracketPair(BRACKET_BR.r32, BRACKET_BR.r16);
_bracketPair(BRACKET_BL.r16, BRACKET_BL.qf);
_bracketPair(BRACKET_BR.r16, BRACKET_BR.qf);
_bracketPair([97, 98, 99, 100], [101, 102]);
_bracketPair([101, 102], [104]);
// Third-place match 103 is fed by the *losers* of both semifinals (101, 102).
export const BRACKET_THIRD_PLACE_FEEDS = { home: 101, away: 102 };

export function localTime(t: string): string {
  if (!t) return '';
  const m = t.match(/(\d+):(\d+)\s*UTC([+-]\d+)/);
  if (!m) return t;
  const utcH = parseInt(m[1]) - parseInt(m[3]);
  const utcMs = Date.UTC(2026, 5, 15, utcH, parseInt(m[2]));
  return new Date(utcMs).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// Minutes-since-midnight from a 12h ('7:00 PM') or 24h ('19:00') string.
// Needed because string-sorting localTime output puts '10:00 PM' before
// '4:00 PM' lexicographically. Empty/unparseable returns Infinity so blanks sort last.
export function timeToMin(s: string): number {
  if (!s) return Infinity;
  const m = s.match(/(\d+):(\d+)\s*(AM|PM)?/i);
  if (!m) return Infinity;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const p = (m[3] || '').toUpperCase();
  if (p === 'PM' && h !== 12) h += 12;
  else if (p === 'AM' && h === 12) h = 0;
  return h * 60 + min;
}

export function processRaw(json: { matches?: unknown[] }): MatchData {
  const byKey: Record<string, Match> = {},
    byNum: Record<string, Match> = {},
    all: Match[] = [];
  (json.matches || []).forEach((m: unknown) => {
    const raw = m as Record<string, unknown>;
    const h = norm(raw.team1 as string),
      a = norm(raw.team2 as string);
    const score = raw.score as Record<string, unknown> | null;
    const entry: Match = {
      home: h,
      away: a,
      score: score?.ft ? (score.ft as number[])[0] + '-' + (score.ft as number[])[1] : null,
      ht: score?.ht ? (score.ht as number[])[0] + '-' + (score.ht as number[])[1] : null,
      pen: score?.p ? (score.p as number[])[0] + '-' + (score.p as number[])[1] : null,
      goals1: (raw.goals1 as RawGoal[]) || [],
      goals2: (raw.goals2 as RawGoal[]) || [],
      date: raw.date as string,
      time: localTime(raw.time as string),
      ground: (raw.ground as string) || null,
      stage: stageOf(raw.round as string),
      round: (raw.round as string) || null,
      num: (raw.num as number) || null,
    };
    byKey[pkey(h, a)] = entry;
    if (raw.num) byNum[String(raw.num)] = entry;
    all.push(entry);
  });
  return { byKey, byNum, all };
}

// ─── SCORE / STANDINGS HELPERS ────────────────────────────────────────────────

export function parseScore(s: string | null): { h: number; a: number } | null {
  if (!s) return null;
  const p = s.split('-');
  if (p.length !== 2) return null;
  const h = parseInt(p[0]),
    a = parseInt(p[1]);
  return isNaN(h) || isNaN(a) ? null : { h, a };
}

// Resolves the actual winner of a match, checking a penalty shootout before
// falling back to regulation/ET score — a tied `score` doesn't mean no winner.
export function getMatchWinner(
  entry:
    { home: string; away: string; score: string | null; pen?: string | null } | undefined | null,
  espnWinner?: string | null,
): string | undefined {
  if (!entry) return undefined;
  if (espnWinner) return espnWinner;
  if (entry.pen) {
    const sc = parseScore(entry.pen);
    if (sc && sc.h !== sc.a) return sc.h > sc.a ? entry.home : entry.away;
  }
  const sc = parseScore(entry.score);
  if (sc && sc.h !== sc.a) return sc.h > sc.a ? entry.home : entry.away;
  return undefined;
}

export function getLC(sq: Player[]): Record<string, number> {
  const c: Record<string, number> = {};
  LEAGUES.forEach((l) => (c[l] = 0));
  sq.forEach((p) => {
    c[p.league] = (c[p.league] || 0) + 1;
  });
  return c;
}

export function calcStandings(gk: string, byKey: Record<string, Match>): Standing[] {
  const teams = GROUPS[gk];
  const rows: Record<string, Standing> = {};
  teams.forEach((t) => {
    rows[t] = { team: t, mp: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
  });
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      const e = byKey && byKey[pkey(teams[i], teams[j])];
      if (!e || !e.score) continue;
      const sc = parseScore(e.score);
      if (!sc) continue;
      const { h, a } = sc;
      const hr = rows[e.home],
        ar = rows[e.away];
      if (!hr || !ar) continue;
      hr.mp++;
      ar.mp++;
      hr.gf += h;
      hr.ga += a;
      ar.gf += a;
      ar.ga += h;
      if (h > a) {
        hr.w++;
        hr.pts += 3;
        ar.l++;
      } else if (h < a) {
        ar.w++;
        ar.pts += 3;
        hr.l++;
      } else {
        hr.d++;
        hr.pts++;
        ar.d++;
        ar.pts++;
      }
    }
  }
  return Object.values(rows).sort(
    (a, b) =>
      b.pts - a.pts || b.gf - b.ga - (a.gf - a.ga) || b.gf - a.gf || a.team.localeCompare(b.team),
  );
}
