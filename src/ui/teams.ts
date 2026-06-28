import { div, span, btn, inp } from '../dom';
import { FIFA, FLAG, LEAGUES, LC, GROUPS, pkey, calcStandings, parseScore, getLC } from '../constants';
import { $data, $today, $selectedTeam, $squads, SQUADS } from '../state';
import { $sim } from '../simulation';
import { leagueBar, squadPanel } from './squad';

function teamGroup(team: string): string | null {
  for (const [g, ts] of Object.entries(GROUPS)) if (ts.includes(team)) return g;
  return null;
}

function teamR32Distribution(team: string) {
  const data = $sim.get().data as Record<string, { home: { team: string; pct: number }[]; away: { team: string; pct: number }[] }> | null;
  if (!data) return [];
  const dist: { matchNum: number; side: string; pct: number }[] = [];
  Object.entries(data).forEach(([num, sides]) => {
    ['home', 'away'].forEach(side => {
      const s = side as 'home' | 'away';
      const c = sides[s].find(x => x.team === team);
      if (c) dist.push({ matchNum: +num, side, pct: c.pct });
    });
  });
  return dist.sort((a, b) => b.pct - a.pct);
}

function buildTeamDetailView(team: string) {
  const rank = FIFA[team];
  const grp = teamGroup(team);
  const sq = SQUADS[team];
  const data = $data.get();
  const byKey = data?.byKey || {};
  const todayISO = $today.get();

  const back = btn({
    style: { padding: '5px 10px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#9ca3af', fontSize: '12px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', marginBottom: '14px' },
    onclick: function () { $selectedTeam.set(null); }
  }, '← Back to teams');

  let standingsBlock = null;
  if (grp) {
    const rows = calcStandings(grp, byKey);
    standingsBlock = div({ style: { marginBottom: '16px' } },
      div({ style: { fontSize: '10px', fontWeight: '600', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' } }, 'Group ' + grp + ' Standings'),
      ...rows.map((r, i) => div({
        style: { display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 10px', borderRadius: '4px', background: r.team === team ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.02)', marginBottom: '2px', border: r.team === team ? '1px solid rgba(59,130,246,0.3)' : '1px solid transparent' }
      },
        span({ style: { fontSize: '11px', color: i < 2 ? '#3b82f6' : i === 2 ? '#f59e0b' : '#6b7280', fontFamily: 'monospace', width: '14px' } }, i + 1),
        span({ style: { fontSize: '15px' } }, FLAG[r.team] || '🏳'),
        span({ style: { fontSize: '12px', color: '#e2e8f0', flex: 1, fontWeight: r.team === team ? 600 : 400 } }, r.team),
        span({ style: { fontSize: '10px', color: '#6b7280', fontFamily: 'monospace' } }, r.mp + 'p'),
        span({ style: { fontSize: '10px', color: '#9ca3af', fontFamily: 'monospace' } }, (r.gf - r.ga >= 0 ? '+' : '') + (r.gf - r.ga)),
        span({ style: { fontSize: '11px', color: '#fff', fontWeight: 700, fontFamily: 'monospace', minWidth: '24px', textAlign: 'right' } }, r.pts + 'pts')
      ))
    );
  }

  const myMatches = Object.values(byKey).filter(e => e.home === team || e.away === team)
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const scheduleBlock = div({ style: { marginBottom: '16px' } },
    div({ style: { fontSize: '10px', fontWeight: '600', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' } }, 'Schedule'),
    ...myMatches.map(m => {
      const oppTeam = m.home === team ? m.away : m.home;
      const sc = parseScore(m.score);
      const ourScore = sc ? (m.home === team ? sc.h : sc.a) : null;
      const oppScore = sc ? (m.home === team ? sc.a : sc.h) : null;
      const result = sc ? (ourScore! > oppScore! ? 'W' : ourScore! < oppScore! ? 'L' : 'D') : null;
      const resColor = result === 'W' ? '#4ade80' : result === 'L' ? '#f87171' : result === 'D' ? '#fbbf24' : '#6b7280';
      const dateStr = m.date ? new Date(m.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '';
      return div({
        style: { display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', borderRadius: '4px', background: 'rgba(255,255,255,0.02)', marginBottom: '3px', cursor: 'pointer' },
        onclick: function () { $selectedTeam.set(oppTeam); }
      },
        span({ style: { fontSize: '11px', fontWeight: '700', color: resColor, minWidth: '18px', textAlign: 'center' } }, result || '—'),
        span({ style: { fontSize: '10px', color: '#6b7280', minWidth: '60px', flexShrink: 0 } }, dateStr),
        span({ style: { fontSize: '10px', color: '#6b7280', minWidth: '70px', flexShrink: 0 } }, m.time || ''),
        span({ style: { fontSize: '14px' } }, m.home === team ? 'vs' : '@'),
        span({ style: { fontSize: '15px', flexShrink: 0 } }, FLAG[oppTeam] || '🏳'),
        span({ style: { fontSize: '12px', color: '#e2e8f0', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, oppTeam),
        sc && span({ style: { fontSize: '12px', fontWeight: '700', color: '#fff', fontFamily: 'monospace' } }, ourScore + '-' + oppScore),
        m.ground && span({ style: { fontSize: '9px', color: '#374151', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 } }, m.ground),
        span({ style: { fontSize: '10px', color: '#4b5563', flexShrink: 0 } }, m.stage === 'group' ? '' : m.stage)
      );
    })
  );

  const dist = teamR32Distribution(team);
  const simData = $sim.get().data as Record<string, { home: { team: string; pct: number }[]; away: { team: string; pct: number }[] }> | null;
  let projBlock = null;
  if (dist.length && simData) {
    const byNum = $data.get()?.byNum || {};
    const top = dist[0];
    const isLocked = top.pct >= 0.9 || dist.slice(1).every(d => d.pct < 0.1);
    projBlock = div({
      style: { marginBottom: '16px', padding: '12px', borderRadius: '8px', background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.15)' }
    },
      div({ style: { fontSize: '10px', fontWeight: '600', color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' } }, 'Bracket Projection (Simulated)'),
      ...dist.slice(0, isLocked ? 1 : 5).map(d => {
        const entry = byNum[d.matchNum];
        const otherSide = d.side === 'home' ? 'away' : 'home';
        const opponents = simData[d.matchNum]?.[otherSide as 'home' | 'away'] || [];
        const dateStr = entry?.date ? new Date(entry.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '';
        const pctTxt = d.pct >= 0.995 ? '>99%' : d.pct < 0.005 ? '<1%' : Math.round(d.pct * 100) + '%';
        return div({
          style: { padding: '8px 10px', marginBottom: '6px', borderRadius: '6px', background: 'rgba(0,0,0,0.2)', border: isLocked ? '1px solid rgba(74,222,128,0.3)' : '1px solid rgba(255,255,255,0.05)' }
        },
          div({ style: { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' } },
            span({ style: { fontSize: '11px', fontWeight: 600, color: isLocked ? '#4ade80' : '#93c5fd' } }, isLocked ? '✓ Confirmed slot' : pctTxt + ' chance'),
            span({ style: { fontSize: '10px', color: '#6b7280' } }, 'Match ' + d.matchNum),
            entry?.date && span({ style: { fontSize: '10px', color: '#6b7280' } }, '· ' + dateStr + (entry.time ? ' · ' + entry.time : '')),
            entry?.ground && span({ style: { fontSize: '10px', color: '#374151' } }, '· ' + entry.ground)
          ),
          opponents.length && div({ style: { display: 'flex', flexWrap: 'wrap', gap: '4px', fontSize: '10px', color: '#9ca3af' } },
            span({ style: { color: '#6b7280' } }, 'vs '),
            ...opponents.slice(0, 3).map((o, i) => span({
              style: { cursor: 'pointer' },
              onclick: function () { $selectedTeam.set(o.team); }
            },
              (i > 0 ? ', ' : '') + (FLAG[o.team] || '') + ' ' + o.team + ' ' + Math.round(o.pct * 100) + '%'
            ))
          )
        );
      })
    );
  }

  const squadBlock = div({},
    div({ style: { fontSize: '10px', fontWeight: '600', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' } }, 'Squad'),
    squadPanel(team)
  );

  return div({},
    back,
    div({
      style: { display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px', padding: '14px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }
    },
      span({ style: { fontSize: '48px', flexShrink: 0 } }, FLAG[team] || '🏳'),
      div({ style: { flex: 1, minWidth: 0 } },
        div({ style: { fontSize: '20px', fontWeight: 700, color: '#fff', marginBottom: '2px' } }, team),
        div({ style: { fontSize: '11px', color: '#6b7280' } },
          (grp ? 'Group ' + grp + ' · ' : '') +
          (rank ? 'FIFA #' + rank : '') +
          (sq ? ' · ' + sq.length + ' players' : '')
        )
      )
    ),
    standingsBlock,
    projBlock,
    scheduleBlock,
    squadBlock
  );
}

function buildTeamListView() {
  let fl: string | null = null, search = '';
  const allTeams = Object.keys(FIFA).sort((a, b) => FIFA[a] - FIFA[b]);
  const container = div({});

  function renderList() {
    container.innerHTML = '';
    const lower = search.toLowerCase();
    allTeams.filter(t => {
      if (search) return t.toLowerCase().includes(lower);
      if (fl) { const sq = SQUADS[t]; if (!sq) return false; const c = getLC(sq); return (c[fl] || 0) > 0; }
      return true;
    }).forEach(team => {
      const sq = SQUADS[team]; const rank = FIFA[team]; const grp = teamGroup(team);
      const barWrap = sq ? div({ style: { flex: 1, minWidth: 0 } }, leagueBar(getLC(sq), sq.length)) : span({ style: { flex: 1, fontSize: '11px', color: '#4b5563', fontStyle: 'italic' } }, $squads.get().loaded ? 'no data' : 'loading…');
      const card = div({
        style: { borderRadius: '8px', cursor: 'pointer', marginBottom: '6px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', transition: 'all 0.1s' },
        onclick: function () { $selectedTeam.set(team); },
        onmouseover: function () { card.style.background = 'rgba(59,130,246,0.06)'; card.style.border = '1px solid rgba(59,130,246,0.25)'; },
        onmouseout: function () { card.style.background = 'rgba(255,255,255,0.03)'; card.style.border = '1px solid rgba(255,255,255,0.06)'; }
      },
        div({ style: { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px' } },
          span({ style: { fontSize: '11px', fontFamily: 'monospace', color: rank <= 5 ? '#fbbf24' : rank <= 15 ? '#94a3b8' : '#4b5563', width: '20px', textAlign: 'right', flexShrink: 0 } }, rank),
          span({ style: { fontSize: '20px', flexShrink: 0 } }, FLAG[team] || '🏳'),
          span({ style: { fontSize: '13px', fontWeight: '500', color: '#e2e8f0', width: '130px', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, team),
          grp && span({ style: { fontSize: '10px', color: '#6b7280', background: 'rgba(255,255,255,0.05)', padding: '1px 5px', borderRadius: '3px', flexShrink: 0 } }, 'Grp ' + grp),
          barWrap,
          span({ style: { fontSize: '10px', color: '#4b5563', flexShrink: 0, marginLeft: '4px' } }, '›')
        )
      );
      container.appendChild(card);
    });
  }

  const searchEl = inp({
    type: 'text', placeholder: 'Search team…', value: '',
    oninput: function (e: Event) {
      search = (e.target as HTMLInputElement).value; fl = null;
      leagueBtns.querySelectorAll('button').forEach(b => {
        (b as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
        (b as HTMLElement).style.border = '1px solid rgba(255,255,255,0.1)';
        (b as HTMLElement).style.color = '#94a3b8';
        (b as HTMLElement).style.fontWeight = '400';
      });
      renderList();
    },
    style: { width: '100%', padding: '7px 12px', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0', fontSize: '14px', outline: 'none', display: 'block', marginBottom: '12px' }
  });

  const leagueBtns = div({ style: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' } });
  LEAGUES.forEach(l => {
    leagueBtns.appendChild(btn({
      style: { padding: '4px 8px', borderRadius: '4px', fontSize: '11px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' },
      onclick: function () {
        fl = fl === l ? null : l; search = ''; searchEl.value = '';
        leagueBtns.querySelectorAll('button').forEach((b, i) => {
          const active = LEAGUES[i] === fl;
          (b as HTMLElement).style.background = active ? LC[LEAGUES[i]] : 'rgba(255,255,255,0.05)';
          (b as HTMLElement).style.border = '1px solid ' + (active ? LC[LEAGUES[i]] : 'rgba(255,255,255,0.1)');
          (b as HTMLElement).style.color = active ? '#fff' : '#94a3b8';
          (b as HTMLElement).style.fontWeight = active ? '600' : '400';
        });
        renderList();
      }
    }, l));
  });

  renderList();
  return div({}, searchEl, leagueBtns, container);
}

export function buildTeamsView() {
  const wrap = div({});
  let _unsub: (() => void) | null = null;
  function render() {
    wrap.innerHTML = '';
    const sel = $selectedTeam.get();
    if (sel) wrap.appendChild(buildTeamDetailView(sel));
    else wrap.appendChild(buildTeamListView());
  }
  _unsub = $selectedTeam.sub(() => {
    if (!wrap.isConnected) { if (_unsub) _unsub(); return; }
    render();
  });
  render();
  return wrap;
}
