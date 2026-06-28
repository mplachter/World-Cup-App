// ─── DOM HELPERS ─────────────────────────────────────────────────────────────

export type Child = HTMLElement | SVGElement | string | number | null | false;
export type Children = Child | Children[];

// ─── REACTIVE STORE ──────────────────────────────────────────────────────────

export interface Store<T> {
  get: () => T;
  set: (next: T | ((prev: T) => T)) => void;
  sub: (fn: (state: T) => void) => () => void;
}

export interface Cache<T> {
  get(id: string): T | null;
  set(id: string, value: T, overrideTtl?: number): void;
  del(id: string): void;
  listKeys(): string[];
  size(): number;
}

export interface CacheOpts {
  ttl?: number;
  maxEntries?: number;
}

// ─── OPENFOOTBALL DATA ────────────────────────────────────────────────────────

export interface RawGoal {
  name: string;
  minute?: string | number;
}

export interface Match {
  home: string;
  away: string;
  score: string | null;
  ht: string | null;
  goals1: RawGoal[];
  goals2: RawGoal[];
  date: string;
  time: string;
  ground: string | null;
  stage: string;
  group?: string;
  round: string | null;
  num: number | null;
}

export interface MatchData {
  byKey: Record<string, Match>;
  byNum: Record<string, Match>;
  all: Match[];
}

// ─── ESPN LIVE SCORES ─────────────────────────────────────────────────────────

export interface EspnEntry {
  id: string;
  score: string;
  state: string;
  clock: string;
  detail: string;
  homeScore: string;
  awayScore: string;
  homeName: string;
  awayName: string;
  isLive: boolean;
  isPost: boolean;
  winner: string | null;
  broadcast: string;
  htScore: string | null;
}

// ─── ESPN PER-MATCH DETAIL ────────────────────────────────────────────────────

export interface Sub {
  minute: string;
  team: string;
  teamShort: string;
  playerIn: string;
  playerOut: string;
}

export interface Card {
  minute: string;
  team: string;
  teamShort: string;
  player: string;
  type: 'yellow' | 'yellowred' | 'red';
}

export interface EspnGoal {
  minute: string;
  team: string;
  teamShort: string;
  scorer: string;
  ownGoal: boolean;
  penalty: boolean;
}

export interface LineupPlayer {
  name: string;
  number: number | null;
  pos: string;
  starter: boolean;
}

export interface Lineup {
  team: string;
  formation: string;
  starters: LineupPlayer[];
  bench: LineupPlayer[];
}

export interface EspnDetail {
  loading?: boolean;
  loaded?: boolean;
  error?: boolean | null;
  fetchedAt?: number;
  _final?: boolean;
  subs: Sub[];
  cards: Card[];
  goals: EspnGoal[];
  lineups: { home: Lineup | null; away: Lineup | null };
}

// ─── SQUAD DATA ───────────────────────────────────────────────────────────────

export interface Player {
  name: string;
  pos: string;
  league: string;
  club: string;
}

// ─── STANDINGS ────────────────────────────────────────────────────────────────

export interface Standing {
  team: string;
  mp: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  pts: number;
}

// ─── WINDOW GLOBALS ───────────────────────────────────────────────────────────

declare global {
  interface Window {
    __WC_ESPN_DUMPED?: boolean;
    __WC_DEBUG?: boolean;
  }
}
