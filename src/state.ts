import { createStore, persistedStore, persistedCache } from './store';
import type { MatchData, EspnEntry, EspnDetail, Player } from './types';
import { FLAG } from './constants';

// ─── UI TABS & PREFERENCES ────────────────────────────────────────────────────

export const VALID_TABS = ['schedule', 'groups', 'bracket', 'teams'];
export const $tab = persistedStore<string>('wc2026:tab', 'schedule', v => VALID_TABS.includes(v as string));
export const $selectedTeam = persistedStore<string | null>('wc2026:selectedTeam', null,
  v => v === null || typeof v === 'string');
export const $showCompleted = persistedStore<boolean>('wc2026:showCompleted', false,
  v => typeof v === 'boolean');
// Per-day collapse state — only collapsed days stored, keeping the blob small.
export const $collapsedDays = persistedStore<Record<string, boolean>>('wc2026:collapsedDays:v1', {},
  v => v !== null && typeof v === 'object' && !Array.isArray(v));
// Schedule filter state — survives tab switches and full rebuilds.
export const $scheduleStageFilter = persistedStore<string>('wc2026:scheduleStageFilter', 'all',
  v => typeof v === 'string');
export const $scheduleTeamFilter = persistedStore<string>('wc2026:scheduleTeamFilter', '',
  v => typeof v === 'string');

// ─── PERSISTENT CACHES ────────────────────────────────────────────────────────
// Declared here so data/espn modules can reference them synchronously at
// import time without hitting the temporal dead zone.

export const espnSummaryCache = persistedCache<EspnDetail>('wc2026:cache:espn:summary:v1', { maxEntries: 150 });
export const scheduleCache    = persistedCache('wc2026:cache:openfootball:schedule:v1', { ttl: 30*60*1000, maxEntries: 4 });
export const squadsCache      = persistedCache('wc2026:cache:openfootball:squads:v1',   { ttl: 24*60*60*1000, maxEntries: 4 });

// ─── SQUAD DATA ───────────────────────────────────────────────────────────────

export let SQUADS: Record<string, Player[]> = {};
export function setSQUADS(v: Record<string, Player[]>) { SQUADS = v; }
export const $squads = createStore<{ loaded: boolean; count: number; error?: boolean }>({ loaded: false, count: 0 });

// ─── SCHEDULE DATA ────────────────────────────────────────────────────────────

export const $data   = createStore<MatchData | null>(null);
export const $status = createStore<string>("loading");

function localDateISO(): string {
  const d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}
export const $today = createStore<string>(localDateISO());
// Re-check every minute in case the day rolls over while the app is open.
setInterval(() => {
  const cur = localDateISO();
  if (cur !== $today.get()) $today.set(cur);
}, 60000);

// ─── ESPN STATE ───────────────────────────────────────────────────────────────

export const $espn        = createStore<Record<string, EspnEntry>>({});
export const $espnStatus  = createStore<string>("idle");
export const $espnDetails = createStore<Record<string, EspnDetail>>({});

// ─── NAVIGATION HELPERS ───────────────────────────────────────────────────────

export function navigateToTeam(teamName: string | null) {
  if (!teamName || teamName === 'TBD') return;
  $selectedTeam.set(teamName);
  $tab.set('teams');
}

export function clickableTeam(el: HTMLElement, teamName: string | null): HTMLElement {
  if (!teamName || teamName === 'TBD' || !FLAG[teamName]) return el;
  el.style.cursor = 'pointer';
  el.addEventListener('click', (e) => { e.stopPropagation(); navigateToTeam(teamName); });
  return el;
}
