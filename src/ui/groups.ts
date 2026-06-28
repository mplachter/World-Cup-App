import type { Match } from '../types';
import { div, span, btn } from '../dom';
import { GROUPS, pkey, calcStandings, FLAG } from '../constants';
import { $data, $today, clickableTeam } from '../state';
import { matchCard } from './matchCard';

export function standingsTable(gk: string, byKey: Record<string, Match>) {
  const rows = calcStandings(gk, byKey);
  const cols = "1.5rem 1fr 2rem 1.8rem 1.8rem 1.8rem 1.8rem 1.8rem 2.2rem";
  return div({ style: { borderRadius: '8px', overflow: 'hidden', marginBottom: '16px', border: '1px solid rgba(255,255,255,0.08)' } },
    div({ style: { display: 'grid', gridTemplateColumns: cols, padding: '6px 10px', background: 'rgba(255,255,255,0.04)', fontSize: '10px', fontWeight: '600', color: '#4b5563' } },
      span({}, '#'), span({}, 'Team'), span({ style: { textAlign: 'center' } }, 'MP'), span({ style: { textAlign: 'center' } }, 'W'), span({ style: { textAlign: 'center' } }, 'D'), span({ style: { textAlign: 'center' } }, 'L'), span({ style: { textAlign: 'center' } }, 'GF'), span({ style: { textAlign: 'center' } }, 'GA'), span({ style: { textAlign: 'center', color: '#d1d5db' } }, 'PTS')
    ),
    ...rows.map((r, i) => div({ style: { display: 'grid', gridTemplateColumns: cols, alignItems: 'center', padding: '7px 10px', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '12px', background: i < 2 ? 'rgba(59,130,246,0.06)' : i === 2 ? 'rgba(251,191,36,0.04)' : 'transparent' } },
      span({ style: { fontFamily: 'monospace', color: '#4b5563' } }, i + 1),
      clickableTeam(div({ style: { display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0 } },
        div({ style: { width: '3px', height: '14px', borderRadius: '2px', background: i < 2 ? '#3b82f6' : i === 2 ? '#f59e0b' : 'transparent', flexShrink: 0 } }),
        span({ style: { fontSize: '15px', flexShrink: 0 } }, FLAG[r.team] || '🏳'),
        span({ style: { color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, r.team)
      ), r.team),
      span({ style: { textAlign: 'center', color: '#6b7280' } }, r.mp),
      span({ style: { textAlign: 'center', color: '#4ade80' } }, r.w),
      span({ style: { textAlign: 'center', color: '#6b7280' } }, r.d),
      span({ style: { textAlign: 'center', color: '#f87171' } }, r.l),
      span({ style: { textAlign: 'center', color: '#d1d5db' } }, r.gf),
      span({ style: { textAlign: 'center', color: '#d1d5db' } }, r.ga),
      span({ style: { textAlign: 'center', fontWeight: '700', color: '#fff' } }, r.pts)
    )),
    div({ style: { display: 'flex', gap: '12px', padding: '5px 10px', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' } },
      div({ style: { display: 'flex', alignItems: 'center', gap: '5px' } }, div({ style: { width: '7px', height: '7px', borderRadius: '50%', background: '#3b82f6' } }), span({ style: { fontSize: '10px', color: '#4b5563' } }, 'Advances')),
      div({ style: { display: 'flex', alignItems: 'center', gap: '5px' } }, div({ style: { width: '7px', height: '7px', borderRadius: '50%', background: '#f59e0b' } }), span({ style: { fontSize: '10px', color: '#4b5563' } }, 'Best 3rd'))
    )
  );
}

export function buildGroupsView() {
  let g = 'A';
  const data = $data.get();
  const todayISO = $today.get();
  const byKey = data ? data.byKey : {};

  const matchesContainer = div({});
  const standingsContainer = div({});
  const groupBtns = div({ style: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' } });

  function renderGroup() {
    standingsContainer.innerHTML = '';
    matchesContainer.innerHTML = '';
    standingsContainer.appendChild(standingsTable(g, byKey));
    const teams = GROUPS[g], out: Match[] = [];
    for (let i = 0; i < teams.length; i++) for (let j = i + 1; j < teams.length; j++) {
      const e = byKey && byKey[pkey(teams[i], teams[j])];
      if (e) out.push(e);
    }
    out.sort((a, b) => (a.date || '').localeCompare(b.date || '')).forEach(e => matchesContainer.appendChild(matchCard(e, todayISO, true)!));
    groupBtns.querySelectorAll('button').forEach(b => {
      const active = (b as HTMLButtonElement).dataset.g === g;
      (b as HTMLElement).style.background = active ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.05)';
      (b as HTMLElement).style.border = active ? '1px solid rgba(59,130,246,0.6)' : '1px solid rgba(255,255,255,0.1)';
      (b as HTMLElement).style.color = active ? '#93c5fd' : '#94a3b8';
    });
  }

  'ABCDEFGHIJKL'.split('').forEach(grp => {
    groupBtns.appendChild(btn({
      'data-g': grp,
      style: { width: '36px', height: '36px', borderRadius: '8px', fontSize: '14px', fontWeight: '700', background: grp === g ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.05)', border: grp === g ? '1px solid rgba(59,130,246,0.6)' : '1px solid rgba(255,255,255,0.1)', color: grp === g ? '#93c5fd' : '#94a3b8' },
      onclick: function () { g = grp; renderGroup(); }
    }, grp));
  });

  renderGroup();
  return div({}, groupBtns, standingsContainer, div({ style: { fontSize: '10px', fontWeight: '600', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' } }, 'Matches — tap to expand'), matchesContainer);
}
