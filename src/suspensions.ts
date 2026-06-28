import { norm, pkey, espnNorm, timeToMin, normName } from './constants';
import { $data, $espn, $espnDetails } from './state';
import { loadEspnSummary } from './espn';

// Return prior played matches for a team in chronological order.
function getTeamPriorMatches(team: string, beforeDate: string) {
  const all = ($data.get() || { all: [] as unknown[] }).all as { home: string; away: string; date: string; time: string; score: string | null; stage: string }[];
  return all.filter(e => {
    if (e.home !== team && e.away !== team) return false;
    if (!e.date) return false;
    if (beforeDate && e.date >= beforeDate) return false;
    return !!e.score;
  }).sort((a, b) => (a.date || '').localeCompare(b.date || '')
                  || timeToMin(a.time || '') - timeToMin(b.time || ''));
}

// FIFA 2026 yellow-card reset rule: cautions accumulate within "blocks" and
// reset at block boundaries (after group stage, after QF).
//   Block 1: group
//   Block 2: r32 + r16 + qf
//   Block 3: sf + final + 3rd
function _disciplineBlock(stage: string) {
  if (stage === 'r32' || stage === 'r16' || stage === 'qf') return 2;
  if (stage === 'sf' || stage === 'final' || stage === '3rd') return 3;
  return 1; // group (or unknown — treat as group)
}

// Compute who's suspended for `team`'s next match (relative to `upcomingDate`).
export function computeSuspensions(team: string, upcomingDate: string, upcomingStage: string) {
  const upcomingBlock = _disciplineBlock(upcomingStage || 'group');
  const priorMatches = getTeamPriorMatches(team, upcomingDate);
  const players: Record<string, { origName: string; yellows: number; suspendedNext: boolean; reason: string | null }> = {};
  let currentBlock: number | null = null;
  priorMatches.forEach(entry => {
    const matchBlock = _disciplineBlock(entry.stage);
    if (currentBlock !== null && matchBlock !== currentBlock) {
      Object.values(players).forEach(p => { p.yellows = 0; });
    }
    currentBlock = matchBlock;
    Object.values(players).forEach(p => {
      if (p.suspendedNext) { p.suspendedNext = false; p.yellows = 0; p.reason = null; }
    });
    const k = pkey(entry.home, entry.away);
    const espnE = $espn.get()[k];
    const eventId = espnE && espnE.id;
    if (!eventId) return;
    const det = ($espnDetails.get() as Record<string, unknown>)[eventId] as { loaded?: boolean; cards?: { player?: string; type?: string; team?: string }[] } | undefined;
    if (!det || !det.loaded) return;
    const cards = (det.cards || []).filter(c => {
      const cardTeam = norm(espnNorm(c.team || ''));
      return cardTeam === norm(team);
    });
    cards.forEach(c => {
      if (!c.player) return;
      const nk = normName(c.player);
      if (!players[nk]) players[nk] = { origName: c.player, yellows: 0, suspendedNext: false, reason: null };
      const p = players[nk];
      if (c.type === 'red') {
        p.suspendedNext = true; p.reason = 'red card';
      } else if (c.type === 'yellowred') {
        p.suspendedNext = true; p.reason = '2 yellows (same match)';
      } else if (c.type === 'yellow') {
        p.yellows = (p.yellows || 0) + 1;
        if (p.yellows >= 2) { p.suspendedNext = true; p.reason = '2 yellows'; }
      }
    });
  });
  if (currentBlock !== null && currentBlock !== upcomingBlock) {
    Object.values(players).forEach(p => { p.yellows = 0; });
  }
  const suspended: { name: string; reason: string }[] = [];
  const onYellow: { name: string }[] = [];
  Object.values(players).forEach(p => {
    if (p.suspendedNext) suspended.push({ name: p.origName, reason: p.reason || 'card' });
    else if (p.yellows === 1) onYellow.push({ name: p.origName });
  });
  return { suspended, onYellow };
}

// Prefetch prior-match summaries for two teams.
export async function prefetchSuspensionData(homeTeam: string, awayTeam: string, upcomingDate: string) {
  const seen = new Set<string>();
  const work: string[] = [];
  [homeTeam, awayTeam].forEach(t => {
    getTeamPriorMatches(t, upcomingDate).forEach(e => {
      const k = pkey(e.home, e.away);
      const eid = $espn.get()[k] && $espn.get()[k].id;
      if (eid && !seen.has(eid)) { seen.add(eid); work.push(eid); }
    });
  });
  for (const eid of work) {
    await loadEspnSummary(eid);
    await new Promise(r => setTimeout(r, 80));
  }
}
