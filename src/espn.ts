import type { EspnEntry, EspnDetail } from './types';
import { norm, pkey, espnNorm } from './constants';
import { $espn, $espnStatus, $espnDetails, espnSummaryCache } from './state';

// ─── ESPN LIVE SCORES ─────────────────────────────────────────────────────────

export async function loadESPN() {
  try {
    const url =
      'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?limit=200&dates=20260611-20260719';
    const init: RequestInit = { cache: 'no-cache' };
    try {
      init.signal = AbortSignal.timeout(8000);
    } catch {}
    const r = await fetch(url, init);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    const map: Record<string, EspnEntry> = {};
    let hasLive = false;
    (j.events || []).forEach((ev: Record<string, unknown>) => {
      const comp =
        (ev.competitions as unknown[]) &&
        ((ev.competitions as unknown[])[0] as Record<string, unknown>);
      if (!comp) return;
      const st =
        comp.status && ((comp.status as Record<string, unknown>).type as Record<string, unknown>);
      const state = st ? (st.state as string) : 'pre';
      const detail = st ? ((st.shortDetail || st.detail) as string) : '';
      const clock = comp.status
        ? ((comp.status as Record<string, unknown>).displayClock as string)
        : '';
      const isLive = state === 'in';
      const isPost = state === 'post';
      if (isLive) hasLive = true;
      if (!isLive && !isPost) return;
      const teams = (comp.competitors as unknown[]) || [];
      if (teams.length < 2) return;
      const home = (teams.find(
        (t: unknown) => (t as Record<string, unknown>).homeAway === 'home',
      ) || teams[0]) as Record<string, unknown>;
      const away = (teams.find(
        (t: unknown) => (t as Record<string, unknown>).homeAway === 'away',
      ) || teams[1]) as Record<string, unknown>;
      const hName = espnNorm((home.team as Record<string, unknown>).displayName as string);
      const aName = espnNorm((away.team as Record<string, unknown>).displayName as string);
      const key = pkey(hName, aName);
      const score = home.score + '-' + away.score;
      const hSO = home.shootoutScore as number | undefined;
      const aSO = away.shootoutScore as number | undefined;
      const pen = hSO || aSO ? `${hSO || 0}-${aSO || 0}` : null;
      const bcast =
        ((comp.broadcasts as unknown[]) &&
          (comp.broadcasts as unknown[])[0] &&
          (((comp.broadcasts as unknown[])[0] as Record<string, unknown>).names as string[])) ||
        [];
      map[key] = {
        id: ev.id as string,
        score,
        state,
        clock,
        detail,
        homeScore: home.score as string,
        awayScore: away.score as string,
        homeName: hName,
        awayName: aName,
        isLive,
        isPost,
        winner: isPost ? (home.winner ? hName : aName) : null,
        broadcast: bcast.join(' · '),
        htScore: null,
        pen,
      };
    });
    Object.entries(map).forEach(([k, v]) => {
      if (v.isLive)
        console.log(
          '[ESPN live]',
          v.homeName,
          'vs',
          v.awayName,
          '· key:',
          k,
          '· score:',
          v.score,
          '· clock:',
          v.clock,
        );
    });
    $espn.set(map);
    $espnStatus.set(hasLive ? 'live' : 'idle');
  } catch (e) {
    console.warn('[ESPN]', e instanceof Error ? e.message : String(e));
    $espnStatus.set('error');
  }
}

// ─── ESPN PER-MATCH DETAIL (subs, cards) ─────────────────────────────────────

function buildAthleteMap(j: Record<string, unknown>): Record<string, string> {
  const map: Record<string, string> = {};
  const addAthlete = (a: Record<string, unknown> | null) => {
    if (!a) return;
    const athlete = a.athlete as Record<string, unknown> | undefined;
    const id = a.id || a.uid || (athlete && (athlete.id || athlete.uid));
    const name =
      a.displayName ||
      a.fullName ||
      a.shortName ||
      a.name ||
      (a.firstName && a.lastName && a.firstName + ' ' + a.lastName) ||
      a.lastName ||
      (athlete && (athlete.displayName || athlete.fullName || athlete.shortName));
    if (id && name) map[String(id)] = name as string;
  };
  const teams =
    (j && j.boxscore && ((j.boxscore as Record<string, unknown>).players as unknown[])) || [];
  (teams as Record<string, unknown>[]).forEach((t) => {
    const groups = (t.statistics || t.players || []) as Record<string, unknown>[];
    groups.forEach((g) => {
      const arr = (g.athletes || g.players || []) as Record<string, unknown>[];
      arr.forEach((p) => {
        addAthlete((p.athlete || p) as Record<string, unknown>);
      });
    });
  });
  const rosters = (j && (j.rosters as unknown[])) || [];
  (rosters as Record<string, unknown>[]).forEach((r) => {
    ((r.roster || r.athletes || []) as Record<string, unknown>[]).forEach((p) =>
      addAthlete((p.athlete || p) as Record<string, unknown>),
    );
  });
  return map;
}

function athleteNameFromInvolved(
  a: Record<string, unknown> | null,
  athleteMap: Record<string, string>,
): string {
  if (!a) return '';
  const athlete = a.athlete as Record<string, unknown> | undefined;
  const direct =
    a.displayName ||
    a.fullName ||
    a.shortName ||
    a.name ||
    (a.firstName && a.lastName && a.firstName + ' ' + a.lastName) ||
    a.lastName ||
    (athlete && (athlete.displayName || athlete.fullName || athlete.shortName));
  if (direct) return direct as string;
  const id = a.id || a.uid || (athlete && (athlete.id || athlete.uid));
  if (id && athleteMap[String(id)]) return athleteMap[String(id)];
  const ref = (a.$ref || (athlete && athlete.$ref) || '') as string;
  const m = ref.match(/\/athletes\/(\d+)/);
  if (m && athleteMap[m[1]]) return athleteMap[m[1]];
  return '';
}

function parseEventText(
  text: string,
  evType: string,
): {
  playerIn?: string;
  playerOut?: string;
  player?: string;
  scorer?: string;
  ownGoal?: boolean;
} | null {
  if (!text) return null;
  const t = evType.toLowerCase();
  if (t.includes('sub')) {
    const m = text.match(/^(?:Substitution[,.]?\s*[^.]*?\.?\s*)?(.+?)\s+replaces\s+(.+?)[.\s]*$/i);
    if (m) return { playerIn: m[1].trim(), playerOut: m[2].trim() };
    const m2 = text.match(/(.+?)\s+comes on for\s+(.+?)[.\s]*$/i);
    if (m2) return { playerIn: m2[1].trim(), playerOut: m2[2].trim() };
    return null;
  }
  if (t.includes('card')) {
    const m = text.match(
      /(?:Yellow Card|Red Card|Yellow-Red Card)[,.\s—-]+([^(.]+?)(?:\s*\(|[.]|$)/i,
    );
    if (m) return { player: m[1].trim() };
    return null;
  }
  if (t.includes('goal')) {
    let m = text.match(/(?:Goal[!.]?\s*[^.]+\.\s*)([^(.]+?)\s*\(/i);
    if (m) return { scorer: m[1].trim() };
    m = text.match(/Own Goal by\s+([^(.]+?)\s*(?:\(|$)/i);
    if (m) return { scorer: m[1].trim(), ownGoal: true };
    return null;
  }
  return null;
}

function parseEspnSummary(j: Record<string, unknown>) {
  const subs: unknown[] = [];
  const cards: unknown[] = [];
  const goals: unknown[] = [];
  const athleteMap = buildAthleteMap(j);
  const events = (j && ((j.keyEvents || j.scoringPlays) as unknown[])) || [];
  if (typeof window !== 'undefined' && !window.__WC_ESPN_DUMPED && window.__WC_DEBUG !== false) {
    window.__WC_ESPN_DUMPED = true;
    console.log(
      '[WC ESPN dump] athleteMap keys:',
      Object.keys(athleteMap).length,
      'sample:',
      Object.entries(athleteMap).slice(0, 3),
    );
    console.log('[WC ESPN dump] keyEvents[0]:', (events as unknown[])[0]);
    console.log('[WC ESPN dump] rosters:', j && j.rosters);
    console.log(
      '[WC ESPN dump] boxscore keys:',
      j && j.boxscore && Object.keys(j.boxscore as object),
    );
    console.log('[WC ESPN dump] full response:', j);
  }
  const debug = typeof window !== 'undefined' && window.__WC_DEBUG;
  (events as Record<string, unknown>[]).forEach((ev) => {
    const t = (
      ((ev.type && (ev.type as Record<string, unknown>).text) || ev.text || '') as string
    ).toLowerCase();
    const minute = ((ev.clock && (ev.clock as Record<string, unknown>).displayValue) ||
      ev.minute ||
      '') as string;
    const teamName = ((ev.team &&
      ((ev.team as Record<string, unknown>).displayName ||
        (ev.team as Record<string, unknown>).name)) ||
      '') as string;
    const teamShort = ((ev.team &&
      ((ev.team as Record<string, unknown>).abbreviation ||
        (ev.team as Record<string, unknown>).shortDisplayName)) ||
      teamName) as string;
    const involved = (ev.athletesInvolved || ev.athletes || ev.participants || []) as Record<
      string,
      unknown
    >[];
    const names = involved.map((a) => athleteNameFromInvolved(a, athleteMap));
    if (debug)
      console.debug('[WC keyEvent]', {
        type: ev.type,
        text: ev.text,
        athletesInvolved: involved,
        resolved: names,
        raw: ev,
      });

    if (t.includes('substitution') || t === 'sub' || t.includes('sub ')) {
      let playerIn = names[0] || '';
      let playerOut = names[1] || '';
      if (!playerIn || !playerOut) {
        const parsed = parseEventText((ev.text || ev.shortText || '') as string, 'sub');
        if (parsed) {
          playerIn = playerIn || parsed.playerIn || '';
          playerOut = playerOut || parsed.playerOut || '';
        }
      }
      subs.push({ minute, team: teamName, teamShort, playerIn, playerOut });
    } else if (t.includes('yellow card') || t.includes('yellow-red') || t === 'yellow') {
      let player = names[0] || '';
      if (!player) {
        const parsed = parseEventText((ev.text || ev.shortText || '') as string, 'card');
        if (parsed) player = parsed.player || '';
      }
      cards.push({
        minute,
        team: teamName,
        teamShort,
        player,
        type: t.includes('yellow-red') ? 'yellowred' : 'yellow',
      });
    } else if (t.includes('red card') || t === 'red') {
      let player = names[0] || '';
      if (!player) {
        const parsed = parseEventText((ev.text || ev.shortText || '') as string, 'card');
        if (parsed) player = parsed.player || '';
      }
      cards.push({ minute, team: teamName, teamShort, player, type: 'red' });
    } else if (t.includes('goal') || ev.scoringPlay === true) {
      let scorer = names[0] || '';
      const ownGoal = t.includes('own goal') || /own goal/i.test((ev.text || '') as string);
      const penalty = t.includes('penalty') || /penalty/i.test(t);
      if (!scorer) {
        const parsed = parseEventText((ev.text || ev.shortText || '') as string, 'goal');
        if (parsed) scorer = parsed.scorer || '';
      }
      goals.push({ minute, team: teamName, teamShort, scorer, ownGoal, penalty });
    }
  });
  const lineups = parseEspnLineups(j, athleteMap);
  return { subs, cards, goals, lineups };
}

function parseEspnLineups(j: Record<string, unknown>, athleteMap: Record<string, string>) {
  const out: { home: unknown; away: unknown } = { home: null, away: null };
  const rosters = (j && (j.rosters as unknown[])) || [];
  (rosters as Record<string, unknown>[]).forEach((r) => {
    if (!r) return;
    const teamName = ((r.team &&
      ((r.team as Record<string, unknown>).displayName ||
        (r.team as Record<string, unknown>).name)) ||
      '') as string;
    const homeAway = ((r.homeAway || '') as string).toLowerCase();
    const formation =
      (r.formation &&
        ((r.formation as Record<string, unknown>).name ||
          (r.formation as Record<string, unknown>).text)) ||
      (r.team && (r.team as Record<string, unknown>).formation) ||
      '';
    const list = (r.roster || r.athletes || []) as Record<string, unknown>[];
    const starters: unknown[] = [];
    const bench: unknown[] = [];
    list.forEach((p) => {
      const athlete = (p.athlete || p) as Record<string, unknown>;
      const name =
        athlete.displayName ||
        athlete.fullName ||
        athlete.shortName ||
        athlete.name ||
        (athlete.id && athleteMap[String(athlete.id)]) ||
        '';
      const jersey = p.jersey || athlete.jersey || '';
      const posObj = (p.position || athlete.position || {}) as Record<string, unknown>;
      const position = posObj.abbreviation || posObj.name || posObj.displayName || '';
      const starter = p.starter === true || p.isStarter === true;
      const subbedIn = p.subbedIn === true || (p.didNotPlay === false && !starter);
      const entry = { name, jersey, position, subbedIn };
      if (starter) starters.push(entry);
      else bench.push(entry);
    });
    const side = { team: teamName, formation, starters, bench };
    if (homeAway === 'home') out.home = side;
    else if (homeAway === 'away') out.away = side;
    else {
      if (!out.home) out.home = side;
      else if (!out.away) out.away = side;
    }
  });
  return out;
}

export async function loadEspnSummary(eventId: string | null, force = false) {
  if (!eventId) return;
  const cur = $espnDetails.get();
  const existing = cur[eventId] as EspnDetail | undefined;
  if (!force) {
    if (existing && existing.loading) return;
    if (existing && existing.loaded && Date.now() - (existing.fetchedAt || 0) < 25000) return;
  }
  if (!existing && !force) {
    const cached = espnSummaryCache.get(String(eventId));
    if (cached) {
      $espnDetails.set({
        ...cur,
        [eventId]: {
          subs: cached.subs || [],
          cards: cached.cards || [],
          goals: cached.goals || [],
          lineups: cached.lineups || { home: null, away: null },
          loading: false,
          loaded: true,
          error: null,
          fetchedAt: cached.fetchedAt || Date.now(),
          _final: !!cached._final,
        },
      } as Record<string, EspnDetail>);
      if (cached._final) return;
    }
  }
  $espnDetails.set({
    ...$espnDetails.get(),
    [eventId]: {
      ...(existing || { subs: [], cards: [], goals: [], lineups: { home: null, away: null } }),
      loading: true,
    },
  } as Record<string, EspnDetail>);
  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=${eventId}`;
    const init: RequestInit = { cache: 'no-cache' };
    try {
      init.signal = AbortSignal.timeout(8000);
    } catch {}
    const r = await fetch(url, init);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = (await r.json()) as Record<string, unknown>;
    const parsed = parseEspnSummary(j);
    const statusType =
      (j &&
        j.header &&
        (j.header as Record<string, unknown>).competitions &&
        ((j.header as Record<string, unknown>).competitions as unknown[])[0] &&
        (
          ((j.header as Record<string, unknown>).competitions as unknown[])[0] as Record<
            string,
            unknown
          >
        ).status &&
        (
          (
            ((j.header as Record<string, unknown>).competitions as unknown[])[0] as Record<
              string,
              unknown
            >
          ).status as Record<string, unknown>
        ).type) ||
      (j &&
        j.gameInfo &&
        (j.gameInfo as Record<string, unknown>).status &&
        ((j.gameInfo as Record<string, unknown>).status as Record<string, unknown>).type) ||
      null;
    const isFinal = !!(
      statusType &&
      ((statusType as Record<string, unknown>).completed === true ||
        (statusType as Record<string, unknown>).state === 'post')
    );
    const result = {
      ...parsed,
      loading: false,
      loaded: true,
      error: null,
      fetchedAt: Date.now(),
      _final: isFinal,
    };
    $espnDetails.set({ ...$espnDetails.get(), [eventId]: result } as Record<string, EspnDetail>);
    if (isFinal) {
      espnSummaryCache.set(String(eventId), {
        subs: parsed.subs,
        cards: parsed.cards,
        goals: parsed.goals,
        lineups: parsed.lineups,
        _final: true,
        fetchedAt: Date.now(),
      } as EspnDetail);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[ESPN summary]', eventId, msg);
    const cur2 = $espnDetails.get();
    $espnDetails.set({
      ...cur2,
      [eventId]: {
        ...(cur2[eventId] || {
          subs: [],
          cards: [],
          goals: [],
          lineups: { home: null, away: null },
        }),
        loading: false,
        error: msg,
      },
    } as Record<string, EspnDetail>);
  }
}
