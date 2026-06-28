import type { Match } from '../types';
import { div, span, btn, svg, path } from '../dom';
import { FIFA, FLAG, pkey, parseScore, localTime } from '../constants';
import { $data, $today, $status, navigateToTeam, clickableTeam } from '../state';
import { $sim, SIM_TRIALS_DEFAULT, startSimulation, cancelSimulation, projectBracket, getMathLocks, dataFingerprint } from '../simulation';
import { $espn } from '../state';

// ─── BRACKET LAYOUT GEOMETRY ─────────────────────────────────────────────────
const BRACKET_BASE_SH = 130;
const BRACKET_BASE_GAP = 10;
const BRACKET_FULL_SH = 145;
const BRACKET_TOTAL_H = 8 * BRACKET_BASE_SH + 7 * BRACKET_BASE_GAP;
const BRACKET_GAPS = [BRACKET_BASE_GAP, 135, 415];

function connector(count: number, sh: number, gap: number) {
  const totalH = count * sh + (count - 1) * gap;
  const el = svg({ width: '20', height: String(totalH), style: { flexShrink: 0 } });
  for (let i = 0; i < count; i += 2) {
    const ty = i * (sh + gap) + sh / 2, by = (i + 1) * (sh + gap) + sh / 2, my = (ty + by) / 2;
    ['M0,' + ty + ' H10 V' + my, 'M0,' + by + ' H10 V' + my, 'M10,' + my + ' H20'].forEach(d => el.appendChild(path({ d, fill: 'none', stroke: 'rgba(255,255,255,0.15)', 'stroke-width': '1.5' })));
  }
  return el;
}

function colLabel(t: string) {
  return div({ style: { fontSize: '10px', fontWeight: '600', color: '#4b5563', textTransform: 'uppercase', marginBottom: '8px', textAlign: 'center', whiteSpace: 'nowrap' } }, t);
}

function projSlotEl(projSlot: { team?: string; confidence?: string; alts?: unknown[]; candidates?: { team: string; pct: number }[] } | null) {
  if (!projSlot) return span({ style: { color: '#374151', fontSize: '11px' } }, 'TBD');
  const { team, confidence, alts = [], candidates } = projSlot;

  if (candidates && candidates.length) {
    const top = candidates[0];
    const secondPct = candidates[1] ? candidates[1].pct : 0;
    const byKey = (($data.get() || {}).byKey) || {};
    const mathLocks = getMathLocks(byKey);
    const topMathLocked = !!mathLocks[top.team];
    const locked = top.pct >= 0.9 || candidates.slice(1).every(c => c.pct < 0.1);
    if (!locked && topMathLocked && top.pct >= 0.5
        && candidates.slice(1).every(c => mathLocks[c.team] || c.pct < 0.05)) {
      // fall through to projected check
    }
    const projected = !locked && top.pct >= 0.55 && (top.pct - secondPct) >= 0.25;
    const allLocked = candidates.length >= 2
      && candidates.every(c => mathLocks[c.team] && c.pct >= 0.02);
    if (locked) {
      return div({
        style: { display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 8px', borderRadius: '4px', background: 'rgba(74,222,128,0.07)', border: '1px solid rgba(74,222,128,0.25)', cursor: 'pointer' },
        onclick: function (e: Event) { e.stopPropagation(); navigateToTeam(top.team); }
      },
        span({ style: { fontSize: '14px', flexShrink: 0 } }, FLAG[top.team] || '❓'),
        span({ style: { fontSize: '11px', fontWeight: 600, color: '#e2e8f0', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, top.team),
        span({ style: { fontSize: '8px', color: '#4ade80', fontFamily: 'monospace', flexShrink: 0, background: 'rgba(74,222,128,0.12)', padding: '1px 4px', borderRadius: '3px' } },
          top.pct >= 0.995 ? 'LOCKED' : Math.round(top.pct * 100) + '%')
      );
    }
    if (allLocked && !projected) {
      const poolTeams = candidates.filter(c => mathLocks[c.team] && c.pct >= 0.02).slice(0, 4);
      const predicted = poolTeams[0];
      const alternates = poolTeams.slice(1);
      return div({ style: { display: 'flex', flexDirection: 'column', gap: '2px', width: '100%' } },
        div({
          style: { display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 8px', borderRadius: '4px', background: 'rgba(168,162,158,0.06)', border: '1px solid rgba(168,162,158,0.22)', cursor: 'pointer' },
          onclick: function (e: Event) { e.stopPropagation(); navigateToTeam(predicted.team); }
        },
          span({ style: { fontSize: '14px', flexShrink: 0 } }, FLAG[predicted.team] || '❓'),
          span({ style: { fontSize: '11px', fontWeight: 600, color: '#e2e8f0', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, predicted.team),
          span({ style: { fontSize: '8px', color: '#a8a29e', fontFamily: 'monospace', flexShrink: 0, background: 'rgba(168,162,158,0.14)', padding: '1px 4px', borderRadius: '3px', letterSpacing: '0.3px' } }, 'PRED')
        ),
        alternates.length ? div({ style: { display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 8px', fontSize: '9px', color: '#78716c' } },
          span({}, 'or'),
          ...alternates.map(c =>
            span({
              style: { display: 'inline-flex', alignItems: 'center', gap: '3px', cursor: 'pointer' },
              onclick: function (e: Event) { e.stopPropagation(); navigateToTeam(c.team); }
            },
              span({ style: { fontSize: '10px' } }, FLAG[c.team] || '❓'),
              span({ style: { color: '#a8a29e' } }, c.team)
            )
          )
        ) : null
      );
    }
    if (projected) {
      return div({
        style: { display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 8px', borderRadius: '4px', background: 'rgba(147,197,253,0.06)', border: '1px solid rgba(147,197,253,0.22)', cursor: 'pointer' },
        onclick: function (e: Event) { e.stopPropagation(); navigateToTeam(top.team); }
      },
        span({ style: { fontSize: '14px', flexShrink: 0 } }, FLAG[top.team] || '❓'),
        span({ style: { fontSize: '11px', fontWeight: 600, color: '#e2e8f0', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, top.team),
        span({ style: { fontSize: '8px', color: '#93c5fd', fontFamily: 'monospace', flexShrink: 0, background: 'rgba(147,197,253,0.12)', padding: '1px 4px', borderRadius: '3px' } },
          Math.round(top.pct * 100) + '%')
      );
    }
    return div({ style: { display: 'flex', flexDirection: 'column', gap: '2px', width: '100%' } },
      ...candidates.slice(0, 3).map(c => {
        const pctTxt = c.pct >= 0.995 ? '>99%' : c.pct < 0.005 ? '<1%' : Math.round(c.pct * 100) + '%';
        return div({
          style: { display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 6px', borderRadius: '3px', position: 'relative', overflow: 'hidden', cursor: 'pointer' },
          onclick: function (e: Event) { e.stopPropagation(); navigateToTeam(c.team); }
        },
          div({ style: { position: 'absolute', left: 0, top: 0, bottom: 0, width: Math.max(2, c.pct * 100) + '%', background: 'rgba(59,130,246,0.22)', zIndex: 0 } }),
          span({ style: { fontSize: '12px', flexShrink: 0, zIndex: 1, position: 'relative' } }, FLAG[c.team] || '❓'),
          span({ style: { fontSize: '10px', color: '#e2e8f0', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', zIndex: 1, position: 'relative' } }, c.team),
          span({ style: { fontSize: '9px', color: '#9ca3af', fontFamily: 'monospace', flexShrink: 0, zIndex: 1, position: 'relative' } }, pctTxt)
        );
      })
    );
  }

  const isUnknown = confidence === 'unknown';
  const displayTeam = isUnknown ? 'TBD' : team!;
  const displayFlag = isUnknown ? '❓' : (FLAG[team!] || '❓');

  const color = confidence === 'confirmed' ? '#4ade80'
    : confidence === 'projected' ? '#93c5fd'
    : confidence === 'contested' ? '#fbbf24'
    : '#6b7280';
  const bg = confidence === 'confirmed' ? 'rgba(74,222,128,0.1)'
    : confidence === 'projected' ? 'rgba(147,197,253,0.08)'
    : confidence === 'contested' ? 'rgba(251,191,36,0.1)'
    : 'rgba(255,255,255,0.04)';
  const altsEl = div({ style: { display: 'none', marginTop: '4px' } });
  const showAlts = !isUnknown && alts.length;
  const mainEl = div({
    style: { display: 'flex', alignItems: 'center', gap: '3px', padding: '3px 6px', borderRadius: '4px', background: bg, border: '1px solid ' + color + '44', cursor: showAlts ? 'pointer' : 'default', minWidth: 0 }
  },
    span({ style: { fontSize: '13px', flexShrink: 0 } }, displayFlag),
    span({ style: { fontSize: '10px', fontWeight: 600, color: isUnknown ? '#4b5563' : (displayTeam === 'TBD' ? '#374151' : '#e2e8f0'), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 } }, displayTeam),
    showAlts && span({ style: { fontSize: '9px', color, flexShrink: 0, marginLeft: '2px' } }, '+' + alts.length)
  );
  if (showAlts) {
    let open = false;
    mainEl.onclick = (e) => { e.stopPropagation(); open = !open; altsEl.style.display = open ? 'block' : 'none'; };
    (alts as { team: string; condition: string }[]).forEach(alt => {
      altsEl.appendChild(div({ style: { display: 'flex', alignItems: 'center', gap: '3px', padding: '2px 4px', borderRadius: '3px', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', marginBottom: '2px' } },
        span({ style: { fontSize: '11px' } }, FLAG[alt.team] || '❓'),
        span({ style: { fontSize: '9px', color: '#fbbf24' } }, alt.team),
        span({ style: { fontSize: '8px', color: '#4b5563', marginLeft: '2px' } }, 'if ' + alt.condition)
      ));
    });
  } else if (!isUnknown) {
    mainEl.style.cursor = 'pointer';
    mainEl.onclick = (e) => { e.stopPropagation(); navigateToTeam(team!); };
  }
  return div({}, mainEl, altsEl);
}

function pbslot(projHome: { team?: string; confidence?: string; alts?: unknown[]; candidates?: { team: string; pct: number }[] } | null, projAway: { team?: string; confidence?: string; alts?: unknown[]; candidates?: { team: string; pct: number }[] } | null, entry: Match | undefined, small = false) {
  const w = small ? 128 : 148;
  const espnE = entry ? $espn.get()[pkey(entry.home || '', entry.away || '')] : null;
  const rawScore = (espnE && (espnE.isLive || espnE.isPost)) ? espnE.score : entry?.score;
  const sc = parseScore(rawScore || null);
  const hW = sc ? sc.h > sc.a : false;
  const aW = sc ? sc.a > sc.h : false;
  const hScore = sc !== null ? String(sc.h) : null;
  const aScore = sc !== null ? String(sc.a) : null;
  const isLive = !!(espnE && espnE.isLive);
  const ds = entry?.date ? new Date(entry.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';

  const homeProj = projHome || (entry ? { team: entry.home, confidence: 'confirmed', alts: [] } : { team: 'TBD', confidence: 'unknown', alts: [] });
  const awayProj = projAway || (entry ? { team: entry.away, confidence: 'confirmed', alts: [] } : { team: 'TBD', confidence: 'unknown', alts: [] });

  const makeStack = (proj: typeof homeProj, isHomeRow: boolean) => {
    const raw = (proj.candidates || []).slice(0, 3);
    if (!raw.length) {
      return div({ style: { padding: '6px', fontSize: '10px', color: '#6b7280', borderBottom: isHomeRow ? '1px solid rgba(255,255,255,0.07)' : 'none' } }, 'TBD');
    }
    const top = raw[0];
    const secondPct = raw[1] ? raw[1].pct : 0;
    const byKey = (($data.get() || {}).byKey) || {};
    const mathLocks = getMathLocks(byKey);
    const locked = top.pct >= 0.9 || raw.slice(1).every(c => c.pct < 0.1);
    const projected = !locked && top.pct >= 0.55 && (top.pct - secondPct) >= 0.25;
    const allCands = proj.candidates || [];
    const allLocked = allCands.length >= 2
      && allCands.every(c => mathLocks[c.team] && c.pct >= 0.02);
    if (locked) {
      return div({
        style: { padding: '8px 8px', borderBottom: isHomeRow ? '1px solid rgba(255,255,255,0.07)' : 'none', display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(74,222,128,0.05)', cursor: 'pointer' },
        onclick: function (e: Event) { e.stopPropagation(); navigateToTeam(top.team); }
      },
        span({ style: { fontSize: (small ? 14 : 16) + 'px', flexShrink: 0 } }, FLAG[top.team] || '❓'),
        span({ style: { fontSize: (small ? 11 : 12) + 'px', color: '#e2e8f0', fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, top.team),
        span({ style: { fontSize: '8px', color: '#4ade80', fontFamily: 'monospace', flexShrink: 0, background: 'rgba(74,222,128,0.12)', padding: '1px 4px', borderRadius: '3px' } },
          top.pct >= 0.995 ? 'LOCKED' : Math.round(top.pct * 100) + '%')
      );
    }
    if (allLocked && !projected) {
      const poolTeams = allCands.filter(c => mathLocks[c.team] && c.pct >= 0.02).slice(0, 4);
      const predicted = poolTeams[0];
      const alternates = poolTeams.slice(1);
      return div({ style: { borderBottom: isHomeRow ? '1px solid rgba(255,255,255,0.07)' : 'none', background: 'rgba(168,162,158,0.04)' } },
        div({
          style: { padding: '6px 8px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' },
          onclick: function (e: Event) { e.stopPropagation(); navigateToTeam(predicted.team); }
        },
          span({ style: { fontSize: (small ? 14 : 16) + 'px', flexShrink: 0 } }, FLAG[predicted.team] || '❓'),
          span({ style: { fontSize: (small ? 11 : 12) + 'px', color: '#e2e8f0', fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, predicted.team),
          span({ style: { fontSize: '8px', color: '#a8a29e', fontFamily: 'monospace', flexShrink: 0, background: 'rgba(168,162,158,0.14)', padding: '1px 4px', borderRadius: '3px', letterSpacing: '0.3px' } }, 'PRED')
        ),
        alternates.length ? div({ style: { padding: '1px 8px 4px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9px', color: '#78716c', overflow: 'hidden' } },
          span({ style: { flexShrink: 0 } }, 'or'),
          ...alternates.map(c =>
            span({
              style: { display: 'inline-flex', alignItems: 'center', gap: '2px', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
              onclick: function (e: Event) { e.stopPropagation(); navigateToTeam(c.team); }
            },
              span({ style: { fontSize: '10px', flexShrink: 0 } }, FLAG[c.team] || '❓'),
              span({ style: { color: '#a8a29e' } }, c.team)
            )
          )
        ) : null
      );
    }
    if (projected) {
      return div({
        style: { padding: '8px 8px', borderBottom: isHomeRow ? '1px solid rgba(255,255,255,0.07)' : 'none', display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(147,197,253,0.04)', cursor: 'pointer' },
        onclick: function (e: Event) { e.stopPropagation(); navigateToTeam(top.team); }
      },
        span({ style: { fontSize: (small ? 14 : 16) + 'px', flexShrink: 0 } }, FLAG[top.team] || '❓'),
        span({ style: { fontSize: (small ? 11 : 12) + 'px', color: '#e2e8f0', fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, top.team),
        span({ style: { fontSize: '8px', color: '#93c5fd', fontFamily: 'monospace', flexShrink: 0, background: 'rgba(147,197,253,0.12)', padding: '1px 4px', borderRadius: '3px' } },
          Math.round(top.pct * 100) + '%')
      );
    }
    return div({ style: { padding: '3px 5px', borderBottom: isHomeRow ? '1px solid rgba(255,255,255,0.07)' : 'none' } },
      ...raw.map(c => {
        const pctTxt = c.pct >= 0.995 ? '>99%' : c.pct < 0.005 ? '<1%' : Math.round(c.pct * 100) + '%';
        return div({
          style: { display: 'flex', alignItems: 'center', gap: '3px', padding: '1px 0', position: 'relative', cursor: 'pointer' },
          onclick: function (e: Event) { e.stopPropagation(); navigateToTeam(c.team); }
        },
          div({ style: { position: 'absolute', left: 0, top: 1, bottom: 1, width: Math.max(2, c.pct * 100) + '%', background: 'rgba(59,130,246,0.25)', borderRadius: '2px', zIndex: 0 } }),
          span({ style: { fontSize: '11px', flexShrink: 0, zIndex: 1, position: 'relative' } }, FLAG[c.team] || '❓'),
          span({ style: { fontSize: (small ? 9 : 10) + 'px', color: '#e2e8f0', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', zIndex: 1, position: 'relative' } }, c.team),
          span({ style: { fontSize: '9px', color: '#9ca3af', fontFamily: 'monospace', flexShrink: 0, zIndex: 1, position: 'relative' } }, pctTxt)
        );
      })
    );
  };

  const makeRow = (proj: typeof homeProj, won: boolean, scoreVal: string | null, isHomeRow: boolean) => {
    if (proj.candidates && !scoreVal) {
      return makeStack(proj, isHomeRow);
    }
    const isUnknown = proj.confidence === 'unknown';
    const displayTeam = isUnknown ? 'TBD' : proj.team!;
    const displayFlag = isUnknown ? '❓' : (FLAG[proj.team!] || '❓');
    const altsEl = div({ style: { display: 'none', padding: '2px 4px' } });
    const hasAlts = !isUnknown && proj.alts && proj.alts.length > 0;
    (proj.alts as { team: string; condition: string }[] | undefined)?.forEach(alt => {
      altsEl.appendChild(div({ style: { display: 'flex', alignItems: 'center', gap: '3px', padding: '2px', marginBottom: '1px' } },
        span({ style: { fontSize: '10px' } }, FLAG[alt.team] || '❓'),
        span({ style: { fontSize: '9px', color: '#fbbf24' } }, alt.team),
        span({ style: { fontSize: '8px', color: '#4b5563' } }, ' if ' + alt.condition)
      ));
    });
    const color = proj.confidence === 'confirmed' ? null : proj.confidence === 'projected' ? '#93c5fd' : proj.confidence === 'contested' ? '#fbbf24' : '#6b7280';
    const row = div({
      style: {
        display: 'flex', alignItems: 'center', gap: '3px', padding: '4px 6px',
        borderBottom: isHomeRow ? '1px solid rgba(255,255,255,0.07)' : 'none',
        background: won ? 'rgba(59,130,246,0.15)' : 'transparent',
        cursor: hasAlts ? 'pointer' : 'default'
      }
    },
      span({ style: { fontSize: (small ? 11 : 13) + 'px', flexShrink: 0 } }, displayFlag),
      span({ style: { fontSize: (small ? 9 : 11) + 'px', color: won ? '#fff' : (isUnknown ? '#4b5563' : (color || '#9ca3af')), fontWeight: won ? '700' : '400', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
        displayTeam + (color && !won && !isUnknown ? ' ✦' : '')
      ),
      scoreVal !== null && span({ style: { fontSize: (small ? 11 : 13) + 'px', fontWeight: '700', color: isLive ? '#f87171' : won ? '#fff' : '#6b7280', minWidth: '14px', textAlign: 'right' } }, scoreVal),
      hasAlts && span({ style: { fontSize: '9px', color: '#fbbf24', flexShrink: 0 } }, '+' + (proj.alts as unknown[]).length)
    );
    if (hasAlts) {
      let openAlts = false;
      row.onclick = (e) => { e.stopPropagation(); openAlts = !openAlts; altsEl.style.display = openAlts ? 'block' : 'none'; };
    } else if (!isUnknown) {
      row.style.cursor = 'pointer';
      row.onclick = (e) => { e.stopPropagation(); navigateToTeam(proj.team!); };
    }
    return div({}, row, altsEl);
  };

  const sh = small ? 130 : 145;

  return div({
    style: {
      width: w + 'px', minHeight: sh + 'px', borderRadius: '6px', overflow: 'hidden',
      border: isLive ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(255,255,255,0.1)',
      background: 'rgba(255,255,255,0.04)', flexShrink: 0,
      display: 'flex', flexDirection: 'column', justifyContent: 'center'
    }
  },
    makeRow(homeProj, hW, hScore, true),
    makeRow(awayProj, aW, aScore, false),
    ds && div({ style: { padding: '2px 6px 3px', background: 'rgba(0,0,0,0.2)', fontSize: '9px', color: '#374151', marginTop: 'auto' } },
      ds + (entry?.time ? ' · ' + entry.time : '') + (entry?.ground ? ' · ' + entry.ground : '') + (isLive && espnE?.clock ? ' · ' + espnE.clock : ''))
  );
}

export function buildBracketView() {
  const data = $data.get();
  const status = $status.get();

  if (!data || !data.byKey || Object.keys(data.byKey).length === 0) {
    const msg = status === 'error'
      ? { icon: '⚠️', title: 'Bracket data unavailable', body: 'Could not load fixtures from openfootball. The bracket can\'t be drawn without group standings. Try the refresh button above, or check back in a minute.' }
      : status === 'loading'
      ? { icon: '⏳', title: 'Loading bracket data…', body: 'Fetching the latest fixtures from openfootball.' }
      : { icon: '—', title: 'No bracket data', body: 'Fixture source has no data to display.' };
    return div({ style: { padding: '24px 16px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' } },
      div({ style: { fontSize: '28px', marginBottom: '8px' } }, msg.icon),
      div({ style: { fontSize: '14px', fontWeight: 600, color: '#e2e8f0', marginBottom: '6px' } }, msg.title),
      div({ style: { fontSize: '12px', color: '#9ca3af', maxWidth: '440px', margin: '0 auto', lineHeight: '1.5' } }, msg.body)
    );
  }

  const byKey = data.byKey;
  const byNum = data.byNum || {};
  const todayISO = $today.get();
  const mode = 'simulated';
  const isMobile = (typeof window !== 'undefined' && window.innerWidth < 768);
  let view = isMobile ? 'r32' : 'full';

  const ROUND_MATCHES: Record<string, number[]> = {
    r32: [73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88],
    r16: [89, 90, 91, 92, 93, 94, 95, 96],
    qf: [97, 98, 99, 100],
    sf: [101, 102],
    '3rd': [103],
    final: [104],
  };

  const content = div({});
  const viewBtns = div({ style: { display: 'flex', gap: '6px', marginBottom: '12px' } });
  const legend = div({ style: { display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '12px', padding: '8px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' } });
  const note = div({ style: { padding: '8px 12px', borderRadius: '8px', marginBottom: '12px', background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)', fontSize: '10px', color: '#6b7280', lineHeight: '1.4' } });
  const simPanel = div({ style: { marginBottom: '12px', display: 'none' } });

  function fmtAge(ts: number | undefined) {
    if (!ts) return '';
    const sec = Math.round((Date.now() - ts) / 1000);
    if (sec < 60) return sec + 's ago';
    if (sec < 3600) return Math.round(sec / 60) + 'm ago';
    if (sec < 86400) return Math.round(sec / 3600) + 'h ago';
    return Math.round(sec / 86400) + 'd ago';
  }

  function updateSimPanel() {
    simPanel.innerHTML = '';
    simPanel.style.display = 'block';
    const s = $sim.get();
    const curKey = dataFingerprint(byKey);
    const isRunning = s.status === 'running';
    const hasFresh = s.status === 'done' && s.key === curKey;
    const hasStale = s.status === 'done' && s.key && s.key !== curKey;
    const pct = isRunning && s.trials ? Math.round((s.completed / s.trials) * 100) : 0;

    const left = div({ style: { flex: 1, minWidth: 0 } });
    if (isRunning) {
      left.appendChild(div({ style: { fontSize: '12px', fontWeight: 600, color: '#93c5fd', marginBottom: '4px' } }, `Simulating… ${s.completed.toLocaleString()} / ${s.trials.toLocaleString()} (${pct}%)`));
      left.appendChild(div({ style: { height: '5px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' } },
        div({ style: { height: '100%', width: pct + '%', background: '#3b82f6', transition: 'width 0.2s' } })
      ));
    } else if (hasFresh) {
      left.appendChild(div({ style: { fontSize: '12px', fontWeight: 600, color: '#4ade80', marginBottom: '2px' } }, `✓ ${s.trials.toLocaleString()} simulations · ${s.elapsedMs}ms`));
      left.appendChild(div({ style: { fontSize: '10px', color: '#6b7280' } }, `Run ${fmtAge(s.savedAt)} · auto-refreshes when scores update`));
    } else if (hasStale) {
      left.appendChild(div({ style: { fontSize: '12px', fontWeight: 600, color: '#fbbf24', marginBottom: '2px' } }, `⚠ Recomputing — scores have updated`));
      left.appendChild(div({ style: { fontSize: '10px', color: '#9ca3af' } }, `Previous run ${fmtAge(s.savedAt)}`));
    } else {
      left.appendChild(div({ style: { fontSize: '12px', fontWeight: 600, color: '#e2e8f0', marginBottom: '2px' } }, 'Preparing simulation…'));
      left.appendChild(div({ style: { fontSize: '10px', color: '#9ca3af' } }, 'Computing bracket probabilities'));
    }

    const right = isRunning
      ? btn({ style: { padding: '7px 14px', borderRadius: '6px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }, onclick: cancelSimulation }, 'Cancel')
      : btn({ style: { padding: '7px 14px', borderRadius: '6px', background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.5)', color: '#93c5fd', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }, onclick: () => startSimulation(byKey, SIM_TRIALS_DEFAULT) }, '↻ Re-run');

    simPanel.appendChild(div({ style: { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid ' + (isRunning ? 'rgba(59,130,246,0.3)' : hasStale ? 'rgba(251,191,36,0.25)' : 'rgba(255,255,255,0.08)') } },
      left, right));
  }

  function updateNote() {
    note.innerHTML = '';
    note.appendChild(span({ style: { color: '#93c5fd', fontWeight: 600 } }, '🎲 How this works: '));
    note.appendChild(document.createTextNode('Each remaining group game is simulated via FIFA-rank Elo + Poisson goal sampling. Across thousands of trials, we record how often each team lands in each Round of 32 slot. Bars show those probabilities. Auto-refreshes when scores update.'));
  }

  function updateLegend() {
    legend.innerHTML = '';
    const items = [
      { color: '#3b82f6', label: 'Bar width = probability across simulations' },
      { color: '#a8a29e', label: 'PRED (predicted from confirmed-qualifier pool)' },
      { color: '#93c5fd', label: 'Projected (strong front-runner)' },
      { color: '#4ade80', label: 'Locked (mathematically certain)' },
    ];
    items.forEach(({ color, label }) => {
      legend.appendChild(div({ style: { display: 'flex', alignItems: 'center', gap: '5px' } },
        div({ style: { width: '8px', height: '8px', borderRadius: '50%', background: color } }),
        span({ style: { fontSize: '10px', color: '#9ca3af' } }, label)
      ));
    });
  }

  const ROUND_VIEWS = [
    { id: 'r32', l: 'R32' }, { id: 'r16', l: 'R16' }, { id: 'qf', l: 'QF' },
    { id: 'sf', l: 'SF' }, { id: '3rd', l: '3rd' }, { id: 'final', l: 'Final' }
  ];
  const VIEWS = isMobile
    ? ROUND_VIEWS
    : [{ id: 'full', l: '🏆 Full Bracket' }, ...ROUND_VIEWS];

  function updateBtnStyles() {
    viewBtns.querySelectorAll('button').forEach(b => {
      const active = (b as HTMLButtonElement).dataset.v === view;
      (b as HTMLElement).style.background = active ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.05)';
      (b as HTMLElement).style.border = active ? '1px solid rgba(59,130,246,0.6)' : '1px solid rgba(255,255,255,0.1)';
      (b as HTMLElement).style.color = active ? '#93c5fd' : '#94a3b8';
    });
  }

  VIEWS.forEach(v => {
    viewBtns.appendChild(btn({
      'data-v': v.id,
      style: { padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 500, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', cursor: 'pointer', fontFamily: 'inherit' },
      onclick: function () { view = v.id; render(); }
    }, v.l));
  });

  function render() {
    content.innerHTML = '';
    updateBtnStyles();
    updateLegend();
    updateNote();
    updateSimPanel();

    const proj = projectBracket(byKey, mode);
    const r32Map: Record<number, (typeof proj.r32)[0]> = {};
    proj.r32.forEach(m => { r32Map[m.num] = m; });

    const simState = $sim.get();
    const curKey = dataFingerprint(byKey);
    const simData = (simState.status === 'done' && simState.key === curKey) ? simState.data as Record<string, { home: { team: string; pct: number }[]; away: { team: string; pct: number }[] }> : null;

    function getSlots(num: number) {
      const pm = r32Map[num];
      const entry = byNum[num] as Match | undefined;
      if (!pm) return { home: { team: 'TBD', confidence: 'unknown', alts: [] }, away: { team: 'TBD', confidence: 'unknown', alts: [] }, entry };
      if (entry?.home && (entry.score || entry.date < todayISO)) {
        return {
          home: { team: entry.home, confidence: 'confirmed', alts: [] },
          away: { team: entry.away, confidence: 'confirmed', alts: [] },
          entry
        };
      }
      if (simData && simData[num]) {
        const homeCands = simData[num].home || [];
        const awayCands = simData[num].away || [];
        return {
          home: { team: 'TBD', confidence: 'unknown', alts: [], candidates: homeCands },
          away: { team: 'TBD', confidence: 'unknown', alts: [], candidates: awayCands },
          entry
        };
      }
      return {
        home: { team: 'TBD', confidence: 'unknown', alts: [] },
        away: { team: 'TBD', confidence: 'unknown', alts: [] },
        entry
      };
    }

    function makeBslot(num: number, small = false) {
      const { home, away, entry } = getSlots(num);
      return pbslot(home, away, entry, small);
    }

    function makeBhalf(nums: number[], depth: number, side = 'left') {
      const small = depth === 0;
      const sh = small ? BRACKET_BASE_SH : BRACKET_FULL_SH;
      const gap = BRACKET_GAPS[depth];
      const slotArea = nums.length * sh + (nums.length - 1) * gap;
      const pad = Math.max(0, (BRACKET_TOTAL_H - slotArea) / 2);
      const slots = div({ style: { display: 'flex', flexDirection: 'column', gap: gap + 'px', paddingTop: pad + 'px', paddingBottom: pad + 'px' } });
      nums.forEach(n => slots.appendChild(makeBslot(n, small)));
      const conn = connector(nums.length, sh, gap);
      if (side === 'right') {
        conn.style.transform = 'scaleX(-1)';
        return div({ style: { display: 'flex', alignItems: 'center' } }, conn, slots);
      }
      return div({ style: { display: 'flex', alignItems: 'center' } }, slots, conn);
    }

    if (view !== 'full') {
      const BL_PAIRS: Record<string, number[]> = { r32: [74, 76, 73, 75, 78, 77, 81, 82], r16: [89, 90, 91, 92], qf: [97, 99] };
      const BR_PAIRS: Record<string, number[]> = { r32: [83, 84, 85, 87, 80, 86, 88, 79], r16: [93, 94, 95, 96], qf: [98, 100] };
      const NEXT_M: Record<number, number> = {};
      const SIBLING_M: Record<number, number> = {};
      function _pair(arr: number[], nextArr: number[]) {
        for (let i = 0; i < arr.length; i += 2) {
          const a = arr[i], b = arr[i + 1], n = nextArr[i / 2];
          NEXT_M[a] = n; NEXT_M[b] = n; SIBLING_M[a] = b; SIBLING_M[b] = a;
        }
      }
      _pair(BL_PAIRS.r32, BL_PAIRS.r16);
      _pair(BR_PAIRS.r32, BR_PAIRS.r16);
      _pair(BL_PAIRS.r16, BL_PAIRS.qf);
      _pair(BR_PAIRS.r16, BR_PAIRS.qf);
      _pair([97, 98, 99, 100], [101, 102]);
      _pair([101, 102], [104]);
      const ROUND_OF: Record<number, string> = {};
      [73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88].forEach(n => ROUND_OF[n] = 'R16');
      [89, 90, 91, 92, 93, 94, 95, 96].forEach(n => ROUND_OF[n] = 'QF');
      [97, 98, 99, 100].forEach(n => ROUND_OF[n] = 'SF');
      [101, 102].forEach(n => ROUND_OF[n] = 'Final');
      const ROUND_TAB: Record<string, string> = { 'R16': 'r16', 'QF': 'qf', 'SF': 'sf', 'Final': 'final' };

      const nums = ROUND_MATCHES[view] || [];
      const SR: Record<string, string> = { r32: 'R32', r16: 'R16', qf: 'Quarterfinal', sf: 'Semifinal', '3rd': 'Third place', final: 'Final' };
      content.appendChild(div({ style: { fontSize: '10px', color: '#6b7280', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '8px' } }, SR[view] + ' · ' + nums.length + ' match' + (nums.length === 1 ? '' : 'es')));
      nums.forEach(num => {
        const { home, away, entry } = getSlots(num);
        const ko = entry?.date ? new Date(entry.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
        const tm = entry?.time ? localTime(entry.time) : '';
        const venue = entry?.ground || '';
        const meta = [ko, tm].filter(Boolean).join(' · ');
        const nextNum = NEXT_M[num];
        const sibNum = SIBLING_M[num];
        const nextRound = nextNum ? ROUND_OF[num] : null;
        const card = div({
          style: { borderRadius: '8px', marginBottom: '6px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' },
          'data-match-num': String(num)
        },
          (meta || venue) && div({ style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 12px', fontSize: '10px', color: '#6b7280', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.04)' } },
            span({ style: { display: 'flex', alignItems: 'center', gap: '8px' } },
              span({ style: { color: '#374151', fontWeight: 600 } }, 'M' + num),
              meta && span({}, meta)
            ),
            venue && span({ style: { color: '#4b5563', maxWidth: '45%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, venue)
          ),
          div({ style: { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px' } },
            div({ style: { flex: 1, minWidth: 0 } }, projSlotEl(home)),
            span({ style: { fontSize: '10px', color: '#4b5563', padding: '0 4px', flexShrink: 0 } }, 'vs'),
            div({ style: { flex: 1, minWidth: 0 } }, projSlotEl(away))
          ),
          nextNum && (() => {
            let suffix = null;
            if (sibNum) {
              const sibSlots = getSlots(sibNum);
              function effectiveTeam(slot: ReturnType<typeof getSlots>['home']) {
                if (!slot) return null;
                if (slot.confidence === 'confirmed' && slot.team && slot.team !== 'TBD') return slot.team;
                if ((slot as { candidates?: { team: string; pct: number }[] }).candidates && (slot as { candidates?: { team: string; pct: number }[] }).candidates!.length) {
                  const cands = (slot as { candidates?: { team: string; pct: number }[] }).candidates!;
                  const top = cands[0];
                  const secondPct = cands[1] ? cands[1].pct : 0;
                  const locked = top.pct >= 0.9 || cands.slice(1).every(c => c.pct < 0.1);
                  const projected = top.pct >= 0.55 && (top.pct - secondPct) >= 0.25;
                  if (locked || projected) return top.team;
                  const ml = getMathLocks(byKey);
                  const allLocked = cands.length >= 2 && cands.every(c => ml[c.team] && c.pct >= 0.02);
                  if (allLocked) return top.team;
                }
                return null;
              }
              const hTeam = effectiveTeam(sibSlots.home);
              const aTeam = effectiveTeam(sibSlots.away);
              function flagged(name: string) {
                const f = FLAG[name];
                return f ? (f + ' ' + name) : name;
              }
              if (hTeam && aTeam) {
                suffix = span({ style: { color: '#94a3b8' } }, ' · winner faces ', flagged(hTeam), ' / ', flagged(aTeam));
              } else if (hTeam) {
                suffix = span({ style: { color: '#94a3b8' } }, ' · winner faces ', flagged(hTeam), span({ style: { color: '#4b5563' } }, ' or M' + sibNum + ' away winner'));
              } else if (aTeam) {
                suffix = span({ style: { color: '#94a3b8' } }, ' · winner faces ', flagged(aTeam), span({ style: { color: '#4b5563' } }, ' or M' + sibNum + ' home winner'));
              } else {
                suffix = span({ style: { color: '#4b5563' } }, ' · winner faces M' + sibNum + ' winner');
              }
            }
            return div({
              style: { padding: '5px 12px 7px', fontSize: '10px', color: '#6b7280', borderTop: '1px solid rgba(255,255,255,0.04)', background: 'rgba(255,255,255,0.015)', cursor: 'pointer' },
              onclick: function () {
                const tabId = ROUND_TAB[nextRound!];
                if (!tabId) return;
                view = tabId;
                render();
                setTimeout(() => {
                  const el = content.querySelector('[data-match-num="' + nextNum + '"]');
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 30);
              }
            },
              span({ style: { color: '#60a5fa' } }, '→ M' + nextNum + ' (' + nextRound + ')'),
              suffix
            );
          })()
        );
        content.appendChild(card);
      });
    } else {
      content.appendChild(div({ style: { fontSize: '11px', color: '#4b5563', marginBottom: '8px' } }, '← Scroll to see full bracket'));
      const scrollWrap = div({ style: { overflowX: 'auto', paddingBottom: '16px' } });
      const row = div({ style: { display: 'flex', alignItems: 'center', width: 'max-content', minWidth: '980px', margin: '0 auto', padding: '4px 0' } });

      const BL = { r32: [74, 76, 73, 75, 78, 77, 81, 82], r16: [89, 90, 91, 92], qf: [97, 99] };
      const BR = { r32: [83, 84, 85, 87, 80, 86, 88, 79], r16: [93, 94, 95, 96], qf: [98, 100] };

      [[colLabel('R32'), makeBhalf(BL.r32, 0)],
       [colLabel('R16'), makeBhalf(BL.r16, 1)],
       [colLabel('QF'),  makeBhalf(BL.qf,  2)]].forEach(([lbl, half]) => {
        const c = div({ style: { display: 'flex', flexDirection: 'column', alignItems: 'center' } });
        c.appendChild(lbl as HTMLElement); c.appendChild(half as HTMLElement); row.appendChild(c);
      });

      const center = div({ style: { display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '160px', padding: '0 8px', height: BRACKET_TOTAL_H + 'px' } });
      center.appendChild(div({ style: { height: '188.5px', flexShrink: 0 } }));
      center.appendChild(div({ style: { fontSize: '10px', fontWeight: '600', color: '#4b5563', textTransform: 'uppercase', height: '14px', flexShrink: 0 } }, 'SF'));
      center.appendChild(makeBslot(101));
      const middle = div({ style: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', gap: '4px' } });
      middle.appendChild(div({ style: { fontSize: '11px', fontWeight: '700', color: '#fbbf24' } }, '🏆 FINAL'));
      middle.appendChild(makeBslot(104));
      middle.appendChild(div({ style: { height: '12px' } }));
      middle.appendChild(div({ style: { fontSize: '10px', color: '#6b7280' } }, '3rd Place'));
      middle.appendChild(makeBslot(103));
      center.appendChild(middle);
      center.appendChild(div({ style: { fontSize: '10px', fontWeight: '600', color: '#4b5563', textTransform: 'uppercase', height: '14px', flexShrink: 0 } }, 'SF'));
      center.appendChild(makeBslot(102));
      center.appendChild(div({ style: { height: '202.5px', flexShrink: 0 } }));
      row.appendChild(center);

      [[colLabel('QF'),  makeBhalf(BR.qf,  2, 'right')],
       [colLabel('R16'), makeBhalf(BR.r16, 1, 'right')],
       [colLabel('R32'), makeBhalf(BR.r32, 0, 'right')]].forEach(([lbl, half]) => {
        const c = div({ style: { display: 'flex', flexDirection: 'column', alignItems: 'center' } });
        c.appendChild(lbl as HTMLElement); c.appendChild(half as HTMLElement); row.appendChild(c);
      });

      scrollWrap.appendChild(row);
      content.appendChild(scrollWrap);

      content.appendChild(div({ style: { marginTop: '16px', fontSize: '10px', fontWeight: '600', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' } }, 'Best 3rd Place Standings'));
      const thirdsGrid = div({ style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '8px' } });
      proj.thirds.slice(0, 9).forEach((t, i) => {
        if (!t.team) return;
        thirdsGrid.appendChild(clickableTeam(div({
          style: { display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 8px', borderRadius: '6px', background: i < 8 ? 'rgba(59,130,246,0.06)' : 'rgba(239,68,68,0.06)', border: i < 8 ? '1px solid rgba(59,130,246,0.15)' : '1px solid rgba(239,68,68,0.15)' }
        },
          span({ style: { fontSize: '12px', color: i < 8 ? '#9ca3af' : '#6b7280', fontFamily: 'monospace', minWidth: '16px' } }, i + 1),
          span({ style: { fontSize: '14px' } }, FLAG[t.team] || '🏳'),
          div({ style: { minWidth: 0 } },
            div({ style: { fontSize: '11px', color: i < 8 ? '#e2e8f0' : '#6b7280', fontWeight: i < 8 ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, t.team),
            div({ style: { fontSize: '9px', color: '#4b5563' } }, t.pts + 'pts ' + (t.gf - t.ga >= 0 ? '+' : '') + (t.gf - t.ga) + ' Grp ' + t.group)
          ),
          i === 7 && span({ style: { fontSize: '9px', color: '#4ade80', marginLeft: 'auto', flexShrink: 0 } }, '✓ in'),
          i === 8 && span({ style: { fontSize: '9px', color: '#f87171', marginLeft: 'auto', flexShrink: 0 } }, '✗ out')
        ), t.team));
      });
      content.appendChild(thirdsGrid);
    }
  }

  let _simUnsub: (() => void) | null = null;
  let _dataUnsub: (() => void) | null = null;
  const wrap = div({}, viewBtns, legend, note, simPanel, content);
  let _lastSimStatus = $sim.get().status;
  _simUnsub = $sim.sub(() => {
    if (!wrap.isConnected) {
      if (_simUnsub) _simUnsub();
      if (_dataUnsub) _dataUnsub();
      return;
    }
    const s = $sim.get();
    if (s.status === 'running') {
      updateSimPanel();
    } else if (s.status !== _lastSimStatus || s.status === 'done') {
      render();
    }
    _lastSimStatus = s.status;
  });

  _dataUnsub = $data.sub(() => {
    if (!wrap.isConnected) {
      if (_dataUnsub) _dataUnsub();
      if (_simUnsub) _simUnsub();
      return;
    }
    maybeAutoStartSim();
  });

  function maybeAutoStartSim() {
    const d = $data.get();
    if (!d || !d.byKey) return;
    const fp = dataFingerprint(d.byKey);
    const s = $sim.get();
    if (s.status === 'running') return;
    if (s.key === fp && s.data) return;
    startSimulation(d.byKey, SIM_TRIALS_DEFAULT);
  }

  render();
  maybeAutoStartSim();
  return wrap;
}
