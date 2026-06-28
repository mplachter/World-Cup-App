import type { Match } from '../types';
import { div, span, btn } from '../dom';
import { FIFA, FLAG, pkey, parseScore, norm, espnNorm } from '../constants';
import { $data, $espn, $espnDetails, navigateToTeam, clickableTeam } from '../state';
import { loadEspnSummary } from '../espn';
import { computeSuspensions, prefetchSuspensionData } from '../suspensions';
import { $sim, getMathLocks } from '../simulation';
import { leagueBar, squadPanel } from './squad';

export function matchCard(entry: Match | null, todayISO: string, showSquads = true) {
  if (!entry) return null;
  const { home, away, goals1 = [], goals2 = [], date, time, ground, stage, round } = entry;

  const espnKey = pkey(home, away);
  const espn = $espn.get()[espnKey] || null;

  function resolveDisplay(rawName: string, simSide: unknown) {
    if (FLAG[rawName]) return { display: rawName, isPredicted: false, alternates: [] as string[], orig: rawName, kind: 'real' };
    if (!simSide || !Array.isArray(simSide) || !simSide.length) {
      return { display: rawName, isPredicted: false, alternates: [] as string[], orig: rawName, kind: 'placeholder' };
    }
    const cands = simSide as { team: string; pct: number }[];
    const top = cands[0];
    const secondPct = cands[1] ? cands[1].pct : 0;
    const byKey = (($data.get() || {}).byKey) || {};
    const mathLocks = getMathLocks(byKey);
    const locked = top.pct >= 0.9 || cands.slice(1).every(c => c.pct < 0.1);
    const projected = !locked && top.pct >= 0.55 && (top.pct - secondPct) >= 0.25;
    const allLocked = cands.length >= 2 && cands.every(c => mathLocks[c.team] && c.pct >= 0.02);
    if (locked) return { display: top.team, isPredicted: true, alternates: [] as string[], orig: rawName, kind: 'locked', pct: top.pct };
    if (projected) return { display: top.team, isPredicted: true, alternates: [] as string[], orig: rawName, kind: 'projected', pct: top.pct };
    if (allLocked) {
      const pool = cands.filter(c => mathLocks[c.team] && c.pct >= 0.02);
      return { display: pool[0].team, isPredicted: true, alternates: pool.slice(1, 4).map(c => c.team), orig: rawName, kind: 'pool' };
    }
    return { display: top.team, isPredicted: true, alternates: [] as string[], orig: rawName, kind: 'stack', pct: top.pct };
  }

  const sim = $sim.get();
  const simData = sim && sim.data ? (sim.data as Record<string, { home: { team: string; pct: number }[]; away: { team: string; pct: number }[] }>) : null;
  const simSlot = simData && entry.num ? simData[entry.num] : null;
  const homeD = resolveDisplay(home, simSlot && simSlot.home);
  const awayD = resolveDisplay(away, simSlot && simSlot.away);

  const score = (espn && (espn.isLive || espn.isPost)) ? espn.score : entry.score;
  const ht = entry.ht;
  const isLive = !!(espn && espn.isLive);
  const clock = isLive ? espn.clock : null;
  const detail = espn ? espn.detail : null;
  const broadcast = espn && espn.broadcast ? espn.broadcast : null;

  const sc = parseScore(score);
  const hWon = sc ? sc.h > sc.a : false;
  const aWon = sc ? sc.a > sc.h : false;
  const scoreDisp = sc !== null ? sc.h + '-' + sc.a : null;

  let open = false;
  const status = isLive ? "live" : scoreDisp ? "played" : date === todayISO ? "today" : date && date < todayISO ? "played" : "upcoming";
  const r1 = FIFA[homeD.display], r2 = FIFA[awayD.display];
  const dateStr = date ? new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "";

  const sColor = status === "live" ? "#f87171" : status === "played" ? "#6b7280" : status === "today" ? "#f59e0b" : "#3b82f6";
  const sLabel = status === "live" ? "LIVE" : status === "played" ? "FT" : status === "today" ? "TODAY" : "Upcoming";
  const barBg = status === "live" ? "rgba(239,68,68,0.12)" : status === "played" ? "rgba(75,85,99,0.12)" : status === "today" ? "rgba(217,119,6,0.15)" : "rgba(30,58,95,0.10)";
  const border = status === "live" ? "1px solid rgba(239,68,68,0.35)" : status === "today" ? "1px solid rgba(217,119,6,0.4)" : "1px solid rgba(255,255,255,0.07)";

  const espnEventId = espn && espn.id;
  const canHaveEvents = !!espnEventId && (isLive || status === 'played');
  const isUpcoming = (status === 'upcoming' || status === 'today') && !isLive && !scoreDisp;

  const suspensionsEl = div({ style: { marginBottom: '12px' } });
  let suspensionsHasContent = false;
  function renderSuspensions() {
    if (!isUpcoming) { suspensionsEl.innerHTML = ''; return; }
    const sH = computeSuspensions(homeD.display, date, stage);
    const sA = computeSuspensions(awayD.display, date, stage);
    const anyContent = sH.suspended.length || sA.suspended.length
                    || sH.onYellow.length || sA.onYellow.length;
    if (!anyContent) {
      suspensionsEl.innerHTML = '';
      suspensionsHasContent = false;
      return;
    }
    suspensionsHasContent = true;
    suspensionsEl.innerHTML = '';
    if (sH.suspended.length || sA.suspended.length) {
      suspensionsEl.appendChild(div({ style: { fontSize: '10px', color: '#6b7280', fontWeight: 600, letterSpacing: '0.5px', marginBottom: '4px', textTransform: 'uppercase' } }, 'Suspensions'));
      suspensionsEl.appendChild(div({ style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' } },
        div({}, ...sH.suspended.map(p => div({ style: { fontSize: '11px', color: '#fca5a5', lineHeight: '1.7' } },
          '⛔ ', span({ style: { color: '#e2e8f0', fontWeight: 500 } }, p.name),
          span({ style: { color: '#6b7280', marginLeft: '4px' } }, p.reason)
        ))),
        div({ style: { textAlign: 'right' } }, ...sA.suspended.map(p => div({ style: { fontSize: '11px', color: '#fca5a5', lineHeight: '1.7' } },
          span({ style: { color: '#6b7280', marginRight: '4px' } }, p.reason),
          span({ style: { color: '#e2e8f0', fontWeight: 500 } }, p.name), ' ⛔'
        )))
      ));
    }
    if (sH.onYellow.length || sA.onYellow.length) {
      suspensionsEl.appendChild(div({ style: { fontSize: '10px', color: '#6b7280', fontWeight: 600, letterSpacing: '0.5px', marginBottom: '4px', textTransform: 'uppercase' } }, 'On a yellow'));
      suspensionsEl.appendChild(div({ style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' } },
        div({}, ...sH.onYellow.map(p => div({ style: { fontSize: '11px', color: '#fcd34d', lineHeight: '1.7' } },
          '🟨 ', span({ style: { color: '#cbd5e1' } }, p.name)
        ))),
        div({ style: { textAlign: 'right' } }, ...sA.onYellow.map(p => div({ style: { fontSize: '11px', color: '#fcd34d', lineHeight: '1.7' } },
          span({ style: { color: '#cbd5e1' } }, p.name), ' 🟨'
        )))
      ));
    }
  }

  const eventsEl = div({ style: { marginBottom: '12px' } });
  function renderEvents() {
    eventsEl.innerHTML = '';
    if (!canHaveEvents) return;
    const det = ($espnDetails.get() as Record<string, unknown>)[espnEventId!] as { loading?: boolean; loaded?: boolean; error?: string | null; subs?: { minute: string; team: string; teamShort: string; playerIn: string; playerOut: string }[]; cards?: { minute: string; team: string; teamShort: string; player: string; type: string }[]; goals?: { minute: string; team: string; teamShort: string; scorer: string; ownGoal: boolean; penalty: boolean }[]; lineups?: { home: { team: string; formation: string; starters: { name: string; jersey: string; position: string; subbedIn: boolean }[]; bench: { name: string; jersey: string; position: string; subbedIn: boolean }[] } | null; away: { team: string; formation: string; starters: { name: string; jersey: string; position: string; subbedIn: boolean }[]; bench: { name: string; jersey: string; position: string; subbedIn: boolean }[] } | null } } | undefined;
    if (!det) {
      eventsEl.appendChild(div({ style: { fontSize: '11px', color: '#4b5563', fontStyle: 'italic' } }, 'Loading match events…'));
      return;
    }
    if (det.loading && !det.loaded) {
      eventsEl.appendChild(div({ style: { fontSize: '11px', color: '#4b5563', fontStyle: 'italic' } }, 'Loading match events…'));
      return;
    }
    if (det.error && !det.loaded) {
      eventsEl.appendChild(div({ style: { fontSize: '11px', color: '#7f1d1d' } }, 'Could not load match events (' + det.error + ')'));
      return;
    }
    const subs = det.subs || [];
    const cards = det.cards || [];
    const espnGoals = det.goals || [];
    const lineups = det.lineups || { home: null, away: null };
    const hasLineups = !!(lineups.home && lineups.home.starters && lineups.home.starters.length)
                    || !!(lineups.away && lineups.away.starters && lineups.away.starters.length);
    const showEspnGoals = espnGoals.length > 0 && goals1.length === 0 && goals2.length === 0;
    if (!subs.length && !cards.length && !showEspnGoals && !hasLineups) {
      eventsEl.appendChild(div({ style: { fontSize: '11px', color: '#4b5563', fontStyle: 'italic' } }, 'No events yet.'));
      return;
    }
    function teamSide(name: string) {
      if (!name) return 'home';
      const canonical = norm(espnNorm(name));
      const homeC = norm(home || '');
      const awayC = norm(away || '');
      if (canonical === homeC) return 'home';
      if (canonical === awayC) return 'away';
      const n = name.toLowerCase();
      if (n.includes(homeC.toLowerCase()) || homeC.toLowerCase().includes(n)) return 'home';
      if (n.includes(awayC.toLowerCase()) || awayC.toLowerCase().includes(n)) return 'away';
      return 'home';
    }
    if (showEspnGoals) {
      const homeGoals = espnGoals.filter(g => teamSide(g.team) === 'home');
      const awayGoals = espnGoals.filter(g => teamSide(g.team) === 'away');
      eventsEl.appendChild(div({ style: { fontSize: '10px', color: '#6b7280', fontWeight: 600, letterSpacing: '0.5px', marginBottom: '4px', textTransform: 'uppercase' } }, 'Goals'));
      eventsEl.appendChild(div({ style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' } },
        div({}, ...homeGoals.map(g => div({ style: { fontSize: '11px', color: '#9ca3af', lineHeight: '1.8' } },
          (g.ownGoal ? '⚽ OG ' : g.penalty ? '⚽ P ' : '⚽ '), g.scorer || '?', ' ',
          span({ style: { color: '#4b5563' } }, g.minute)
        ))),
        div({ style: { textAlign: 'right' } }, ...awayGoals.map(g => div({ style: { fontSize: '11px', color: '#9ca3af', lineHeight: '1.8' } },
          span({ style: { color: '#4b5563' } }, g.minute), ' ', g.scorer || '?', ' ',
          (g.ownGoal ? 'OG ⚽' : g.penalty ? 'P ⚽' : '⚽')
        )))
      ));
    }
    if (subs.length) {
      const homeSubs = subs.filter(s => teamSide(s.team) === 'home');
      const awaySubs = subs.filter(s => teamSide(s.team) === 'away');
      eventsEl.appendChild(div({ style: { fontSize: '10px', color: '#6b7280', fontWeight: 600, letterSpacing: '0.5px', marginBottom: '4px', textTransform: 'uppercase' } }, 'Substitutions'));
      eventsEl.appendChild(div({ style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' } },
        div({}, ...homeSubs.map(s => div({ style: { fontSize: '11px', color: '#9ca3af', lineHeight: '1.7' } },
          '🔄 ', span({ style: { color: '#10b981' } }, s.playerIn || '?'), ' ← ', span({ style: { color: '#9ca3af' } }, s.playerOut || '?'), ' ',
          span({ style: { color: '#4b5563' } }, s.minute)
        ))),
        div({ style: { textAlign: 'right' } }, ...awaySubs.map(s => div({ style: { fontSize: '11px', color: '#9ca3af', lineHeight: '1.7' } },
          span({ style: { color: '#4b5563' } }, s.minute), ' ',
          span({ style: { color: '#9ca3af' } }, s.playerOut || '?'), ' → ', span({ style: { color: '#10b981' } }, s.playerIn || '?'), ' 🔄'
        )))
      ));
    }
    if (cards.length) {
      const homeCards = cards.filter(c => teamSide(c.team) === 'home');
      const awayCards = cards.filter(c => teamSide(c.team) === 'away');
      eventsEl.appendChild(div({ style: { fontSize: '10px', color: '#6b7280', fontWeight: 600, letterSpacing: '0.5px', marginBottom: '4px', textTransform: 'uppercase' } }, 'Cards'));
      eventsEl.appendChild(div({ style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' } },
        div({}, ...homeCards.map(c => div({ style: { fontSize: '11px', color: '#9ca3af', lineHeight: '1.7' } },
          (c.type === 'red' ? '🟥' : c.type === 'yellowred' ? '🟨🟥' : '🟨'), ' ', c.player || '?', ' ',
          span({ style: { color: '#4b5563' } }, c.minute)
        ))),
        div({ style: { textAlign: 'right' } }, ...awayCards.map(c => div({ style: { fontSize: '11px', color: '#9ca3af', lineHeight: '1.7' } },
          span({ style: { color: '#4b5563' } }, c.minute), ' ', c.player || '?', ' ',
          (c.type === 'red' ? '🟥' : c.type === 'yellowred' ? '🟨🟥' : '🟨')
        )))
      ));
    }
    if (hasLineups) {
      let homeLU = lineups.home, awayLU = lineups.away;
      if (homeLU && teamSide(homeLU.team) === 'away') { const tmp = homeLU; homeLU = awayLU; awayLU = tmp; }
      function bucketize(starters: { name: string; jersey: string; position: string; subbedIn: boolean }[]) {
        const buckets: Record<string, typeof starters> = { G: [], D: [], M: [], F: [], '': [] };
        (starters || []).forEach(p => {
          const pos = (p.position || '').toUpperCase();
          let k = '';
          if (pos.includes('G')) k = 'G';
          else if (pos.startsWith('D') || pos === 'CB' || pos === 'LB' || pos === 'RB' || pos === 'LWB' || pos === 'RWB') k = 'D';
          else if (pos.startsWith('M') || pos === 'CDM' || pos === 'CAM' || pos === 'CM') k = 'M';
          else if (pos.startsWith('F') || pos === 'ST' || pos === 'CF' || pos === 'LW' || pos === 'RW') k = 'F';
          buckets[k].push(p);
        });
        return ['G', 'D', 'M', 'F', ''].flatMap(k => buckets[k]);
      }
      function lineupCol(lu: typeof lineups.home, align: string) {
        if (!lu) return div({ style: { fontSize: '11px', color: '#4b5563', fontStyle: 'italic', textAlign: align } }, '—');
        const players = bucketize(lu.starters);
        const rows = players.map(p => div({ style: { fontSize: '11px', color: '#9ca3af', lineHeight: '1.7', textAlign: align } },
          align === 'right'
            ? [p.position ? span({ style: { color: '#4b5563', fontSize: '10px', marginRight: '4px' } }, p.position) : null, p.name || '?', p.jersey ? span({ style: { color: '#4b5563', marginLeft: '4px' } }, '#' + p.jersey) : null]
            : [p.jersey ? span({ style: { color: '#4b5563', marginRight: '4px' } }, '#' + p.jersey) : null, p.name || '?', p.position ? span({ style: { color: '#4b5563', fontSize: '10px', marginLeft: '4px' } }, p.position) : null]
        ));
        return div({}, ...rows);
      }
      const homeFmt = (homeLU && homeLU.formation) || '';
      const awayFmt = (awayLU && awayLU.formation) || '';
      eventsEl.appendChild(div({ style: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '4px' } },
        span({ style: { fontSize: '10px', color: '#6b7280', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' } }, 'Starting XI'),
        (homeFmt || awayFmt) ? span({ style: { fontSize: '10px', color: '#4b5563' } }, (homeFmt || '?') + ' · ' + (awayFmt || '?')) : null
      ));
      eventsEl.appendChild(div({ style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' } },
        lineupCol(homeLU, 'left'),
        lineupCol(awayLU, 'right')
      ));
    }
  }

  function buildBody() {
    const kids = [];
    if (goals1.length || goals2.length) {
      kids.push(div({ style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' } },
        div({}, ...goals1.map((g) => div({ style: { fontSize: '11px', color: '#9ca3af', lineHeight: '1.8' } }, ((g as unknown as Record<string, unknown>).owngoal ? '⚽ OG ' : (g as unknown as Record<string, unknown>).penalty ? '⚽ P ' : '⚽ ') + g.name + ' ', span({ style: { color: '#4b5563' } }, String(g.minute) + "'")))),
        div({ style: { textAlign: 'right' } }, ...goals2.map((g) => div({ style: { fontSize: '11px', color: '#9ca3af', lineHeight: '1.8' } }, span({ style: { color: '#4b5563' } }, String(g.minute) + "'"), ' ' + g.name + ' ' + ((g as unknown as Record<string, unknown>).owngoal ? 'OG ⚽' : (g as unknown as Record<string, unknown>).penalty ? 'P ⚽' : '⚽'))))
      ));
    }
    if (canHaveEvents) kids.push(eventsEl);
    if (isUpcoming) kids.push(suspensionsEl);
    if (showSquads) {
      const squadsGrid = div({ style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' } },
        ...[homeD.display, awayD.display].map(team => div({ style: { minWidth: 0 } },
          div({ style: { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' } },
            span({ style: { fontSize: '18px' } }, FLAG[team] || '🏳'),
            span({ style: { fontSize: '11px', fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, team),
            FIFA[team] && span({ style: { fontSize: '10px', color: '#6b7280' } }, '#' + FIFA[team])
          ),
          squadPanel(team)
        ))
      );
      if (canHaveEvents) {
        let squadsOpen = false;
        squadsGrid.style.display = 'none';
        const toggleArrow = span({ style: { fontSize: '10px', color: '#6b7280', transition: 'transform .15s' } }, '▼');
        const toggle = div({
          style: {
            marginTop: '8px', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer',
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            fontSize: '11px', color: '#9ca3af', userSelect: 'none'
          },
          onclick: function (e: Event) {
            e.stopPropagation();
            squadsOpen = !squadsOpen;
            squadsGrid.style.display = squadsOpen ? 'grid' : 'none';
            toggleArrow.style.transform = squadsOpen ? 'rotate(180deg)' : 'rotate(0)';
          }
        },
          span({}, 'Squads'),
          toggleArrow
        );
        kids.push(toggle);
        kids.push(squadsGrid);
      } else {
        kids.push(squadsGrid);
      }
    }
    return kids;
  }

  const bodyEl = div({ style: { borderTop: '1px solid rgba(255,255,255,0.05)', padding: '12px' } }, ...buildBody());
  const arrowEl = span({ style: { fontSize: '11px', color: '#4b5563' } });
  let unsubDetails: (() => void) | null = null;
  let liveRefresh: ReturnType<typeof setInterval> | null = null;

  const card = div({
    style: { borderRadius: '8px', marginBottom: '8px', overflow: 'hidden', border, background: 'rgba(255,255,255,0.03)' },
    'data-live': isLive ? 'true' : 'false',
    'data-match-key': home + '__' + away + '__' + (date || '')
  },
    div({
      style: { cursor: 'pointer' },
      onclick: function () {
        open = !open;
        arrowEl.textContent = open ? '▲' : '▼';
        if (open) {
          card.appendChild(bodyEl);
          if (canHaveEvents) {
            renderEvents();
            loadEspnSummary(espnEventId!);
            unsubDetails = $espnDetails.sub(() => renderEvents());
            if (isLive) liveRefresh = setInterval(() => loadEspnSummary(espnEventId!, true), 30000);
          }
          if (isUpcoming) {
            renderSuspensions();
            if (!unsubDetails) unsubDetails = $espnDetails.sub(() => renderSuspensions());
            prefetchSuspensionData(homeD.display, awayD.display, date);
          }
          setTimeout(() => {
            try {
              const r = card.getBoundingClientRect();
              if (r.top < 64 || r.top > window.innerHeight - 120) {
                card.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            } catch {}
          }, 30);
        } else {
          if (bodyEl.parentNode === card) card.removeChild(bodyEl);
          if (unsubDetails) { unsubDetails(); unsubDetails = null; }
          if (liveRefresh) { clearInterval(liveRefresh); liveRefresh = null; }
        }
      }
    },
      div({ style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', background: barBg, borderBottom: '1px solid rgba(255,255,255,0.05)' } },
        div({ style: { display: 'flex', alignItems: 'center', gap: '8px' } },
          isLive && div({ style: { width: '7px', height: '7px', borderRadius: '50%', background: '#f87171', flexShrink: 0, animation: 'pulse 1s ease-in-out infinite' } }),
          span({ style: { fontSize: '11px', fontWeight: '700', color: sColor } }, sLabel + (isLive && clock ? ' ' + clock : '')),
          dateStr && span({ style: { fontSize: '11px', color: '#6b7280' } }, dateStr),
          !isLive && time && span({ style: { fontSize: '11px', color: '#9ca3af' } }, time),
          broadcast && span({ style: { fontSize: '10px', color: '#4b5563', background: 'rgba(255,255,255,0.05)', padding: '1px 5px', borderRadius: '3px' } }, broadcast)
        ),
        div({ style: { display: 'flex', alignItems: 'center', gap: '8px' } },
          span({ style: { fontSize: '11px', color: '#374151', maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, ground || round || ''),
          scoreDisp && div({ style: { display: 'flex', flexDirection: 'column', alignItems: 'center' } },
            span({ style: { fontSize: '15px', fontWeight: '800', color: isLive ? '#f87171' : '#fff', background: 'rgba(0,0,0,0.35)', padding: '3px 10px', borderRadius: '6px', border: isLive ? '1px solid rgba(239,68,68,0.5)' : 'none', letterSpacing: '1px', whiteSpace: 'nowrap' } }, scoreDisp),
            ht && !isLive && span({ style: { fontSize: '9px', color: '#4b5563' } }, ht + ' HT'),
            isLive && detail && detail !== clock && span({ style: { fontSize: '9px', color: '#f87171' } }, detail)
          ),
          arrowEl
        )
      ),
      div({ style: { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px' } },
        clickableTeam(div({ style: { flex: 1, display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 } },
          span({ style: { fontSize: '22px', flexShrink: 0 } }, FLAG[homeD.display] || '🏳'),
          div({ style: { minWidth: 0 } },
            div({ style: { display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 } },
              span({ style: { fontSize: '14px', fontWeight: hWon ? '700' : '500', color: hWon ? '#fff' : '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, homeD.display),
              homeD.isPredicted && span({ style: { fontSize: '8px', color: '#a8a29e', fontFamily: 'monospace', flexShrink: 0, background: 'rgba(168,162,158,0.12)', padding: '1px 4px', borderRadius: '3px', letterSpacing: '0.3px' } }, 'PRED')
            ),
            r1 && div({ style: { fontSize: '10px', color: '#6b7280' } }, 'FIFA #' + r1),
            homeD.alternates && homeD.alternates.length ? div({ style: { fontSize: '9px', color: '#78716c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
              'or ', homeD.alternates.map(t => (FLAG[t] || '') + ' ' + t).join(', ')
            ) : null
          )
        ), homeD.display),
        div({ style: { fontSize: '11px', fontWeight: '700', color: '#4b5563', padding: '0 4px' } }, 'VS'),
        clickableTeam(div({ style: { flex: 1, display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, justifyContent: 'flex-end' } },
          div({ style: { minWidth: 0, textAlign: 'right' } },
            div({ style: { display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0, justifyContent: 'flex-end' } },
              awayD.isPredicted && span({ style: { fontSize: '8px', color: '#a8a29e', fontFamily: 'monospace', flexShrink: 0, background: 'rgba(168,162,158,0.12)', padding: '1px 4px', borderRadius: '3px', letterSpacing: '0.3px' } }, 'PRED'),
              span({ style: { fontSize: '14px', fontWeight: aWon ? '700' : '500', color: aWon ? '#fff' : '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, awayD.display)
            ),
            r2 && div({ style: { fontSize: '10px', color: '#6b7280' } }, 'FIFA #' + r2),
            awayD.alternates && awayD.alternates.length ? div({ style: { fontSize: '9px', color: '#78716c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
              'or ', awayD.alternates.map(t => (FLAG[t] || '') + ' ' + t).join(', ')
            ) : null
          ),
          span({ style: { fontSize: '22px', flexShrink: 0 } }, FLAG[awayD.display] || '🏳')
        ), awayD.display)
      )
    )
  );
  arrowEl.textContent = '▼';
  return card;
}
