import { processRaw, SQUAD_NAME_NORM, POS_MAP, COUNTRY_TO_LEAGUE } from './constants';
import { $data, $status, setSQUADS, $squads, scheduleCache, squadsCache } from './state';
import type { Player } from './types';

const URLS = [
  'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json',
  'https://cdn.jsdelivr.net/gh/openfootball/worldcup.json@master/2026/worldcup.json',
];

const SQUAD_URLS = [
  'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.squads.json',
  'https://cdn.jsdelivr.net/gh/openfootball/worldcup.json@master/2026/worldcup.squads.json',
];

export async function fetchJsonAny(urls: string[], timeoutMs = 8000) {
  const tryOne = (url: string) => {
    const init: RequestInit = { cache: 'no-cache' };
    try {
      init.signal = AbortSignal.timeout(timeoutMs);
    } catch {}
    return fetch(url, init).then((r) => {
      if (!r.ok) throw new Error('HTTP ' + r.status + ' from ' + url);
      return r.json();
    });
  };
  return Promise.any(urls.map(tryOne));
}

export async function loadData() {
  $status.set('loading');
  const cached = scheduleCache.get('current');
  if (cached) {
    $data.set(processRaw(cached as { matches?: unknown[] }));
    $status.set('done');
  }
  try {
    const j = await fetchJsonAny(URLS);
    $data.set(processRaw(j));
    $status.set('done');
    scheduleCache.set('current', j);
  } catch (e) {
    console.warn('[loadData] all sources failed:', e instanceof Error ? e.message : String(e));
    if (!cached) $status.set('error');
  }
}

export async function loadSquads() {
  function processSquadJson(j: unknown): Record<string, Player[]> {
    const out: Record<string, Player[]> = {};
    const jObj = j as Record<string, unknown>;
    const teams = Array.isArray(j) ? (j as unknown[]) : ((jObj.teams || []) as unknown[]);
    (teams as Record<string, unknown>[]).forEach((t) => {
      const rawName = (t.name || t.title || '') as string;
      const teamName = SQUAD_NAME_NORM[rawName] || rawName;
      const players = ((t.players || t.squad || []) as Record<string, unknown>[]).map((p) => {
        let clubName = '',
          clubCountry = '';
        if (p.club) {
          if (typeof p.club === 'string') {
            clubName = p.club as string;
          } else {
            const club = p.club as Record<string, unknown>;
            clubName = (club.name || '') as string;
            clubCountry = (club.country || club.code || '') as string;
          }
        }
        return {
          name: (p.name || '') as string,
          pos: POS_MAP[p.pos as string] || ((p.pos || '') as string),
          league: COUNTRY_TO_LEAGUE[clubCountry] || 'Other',
          club: clubName,
        };
      });
      if (teamName && players.length) out[teamName] = players;
    });
    return out;
  }
  const cached = squadsCache.get('current');
  if (cached) {
    const processed = processSquadJson(cached);
    setSQUADS(processed);
    $squads.set({ loaded: true, count: Object.keys(processed).length });
  }
  try {
    const j = await fetchJsonAny(SQUAD_URLS);
    const processed = processSquadJson(j);
    setSQUADS(processed);
    $squads.set({ loaded: true, count: Object.keys(processed).length });
    squadsCache.set('current', j);
  } catch (e) {
    console.warn('[loadSquads] all sources failed:', e instanceof Error ? e.message : String(e));
    if (!cached) $squads.set({ loaded: false, count: 0, error: true });
  }
}
