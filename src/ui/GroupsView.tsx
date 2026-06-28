import { useState } from 'preact/hooks';
import type { Match } from '../types';
import { GROUPS, pkey, calcStandings, FLAG } from '../constants';
import { $data, $today, navigateToTeam } from '../state';
import { useStore } from '../hooks/useStore';
import { MatchCard } from './matchCard';

const GROUPS_LIST = 'ABCDEFGHIJKL'.split('');

interface StandingsTableProps {
  gk: string;
  byKey: Record<string, Match>;
}

function StandingsTable({ gk, byKey }: StandingsTableProps) {
  const rows = calcStandings(gk, byKey);
  const cols = '1.5rem 1fr 2rem 1.8rem 1.8rem 1.8rem 1.8rem 1.8rem 2.2rem';
  return (
    <div style={{ borderRadius: '8px', overflow: 'hidden', marginBottom: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: cols, padding: '6px 10px', background: 'rgba(255,255,255,0.04)', fontSize: '10px', fontWeight: '600', color: '#4b5563' }}>
        <span>#</span><span>Team</span>
        <span style={{ textAlign: 'center' }}>MP</span>
        <span style={{ textAlign: 'center' }}>W</span>
        <span style={{ textAlign: 'center' }}>D</span>
        <span style={{ textAlign: 'center' }}>L</span>
        <span style={{ textAlign: 'center' }}>GF</span>
        <span style={{ textAlign: 'center' }}>GA</span>
        <span style={{ textAlign: 'center', color: '#d1d5db' }}>PTS</span>
      </div>
      {rows.map((r, i) => (
        <div
          key={r.team}
          style={{
            display: 'grid', gridTemplateColumns: cols, alignItems: 'center',
            padding: '7px 10px', borderTop: '1px solid rgba(255,255,255,0.05)',
            fontSize: '12px',
            background: i < 2 ? 'rgba(59,130,246,0.06)' : i === 2 ? 'rgba(251,191,36,0.04)' : 'transparent',
          }}
        >
          <span style={{ fontFamily: 'monospace', color: '#4b5563' }}>{i + 1}</span>
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0, cursor: FLAG[r.team] ? 'pointer' : 'default' }}
            onClick={() => navigateToTeam(r.team)}
          >
            <div style={{ width: '3px', height: '14px', borderRadius: '2px', background: i < 2 ? '#3b82f6' : i === 2 ? '#f59e0b' : 'transparent', flexShrink: 0 }} />
            <span style={{ fontSize: '15px', flexShrink: 0 }}>{FLAG[r.team] || '🏳'}</span>
            <span style={{ color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.team}</span>
          </div>
          <span style={{ textAlign: 'center', color: '#6b7280' }}>{r.mp}</span>
          <span style={{ textAlign: 'center', color: '#4ade80' }}>{r.w}</span>
          <span style={{ textAlign: 'center', color: '#6b7280' }}>{r.d}</span>
          <span style={{ textAlign: 'center', color: '#f87171' }}>{r.l}</span>
          <span style={{ textAlign: 'center', color: '#d1d5db' }}>{r.gf}</span>
          <span style={{ textAlign: 'center', color: '#d1d5db' }}>{r.ga}</span>
          <span style={{ textAlign: 'center', fontWeight: '700', color: '#fff' }}>{r.pts}</span>
        </div>
      ))}
      <div style={{ display: 'flex', gap: '12px', padding: '5px 10px', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#3b82f6' }} />
          <span style={{ fontSize: '10px', color: '#4b5563' }}>Advances</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#f59e0b' }} />
          <span style={{ fontSize: '10px', color: '#4b5563' }}>Best 3rd</span>
        </div>
      </div>
    </div>
  );
}

export function GroupsView() {
  const [activeGroup, setActiveGroup] = useState('A');
  const data = useStore($data);
  const todayISO = useStore($today);
  const byKey = data ? data.byKey : {};

  const groupTeams = GROUPS[activeGroup] || [];
  const groupMatches: Match[] = [];
  for (let i = 0; i < groupTeams.length; i++) {
    for (let j = i + 1; j < groupTeams.length; j++) {
      const e = byKey[pkey(groupTeams[i], groupTeams[j])];
      if (e) groupMatches.push(e);
    }
  }
  groupMatches.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  return (
    <div>
      {/* Group selector */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
        {GROUPS_LIST.map(grp => (
          <button
            key={grp}
            onClick={() => setActiveGroup(grp)}
            style={{
              width: '36px', height: '36px', borderRadius: '8px', fontSize: '14px', fontWeight: '700',
              background: grp === activeGroup ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.05)',
              border: grp === activeGroup ? '1px solid rgba(59,130,246,0.6)' : '1px solid rgba(255,255,255,0.1)',
              color: grp === activeGroup ? '#93c5fd' : '#94a3b8',
              cursor: 'pointer',
            }}
          >
            {grp}
          </button>
        ))}
      </div>

      {/* Standings */}
      <StandingsTable gk={activeGroup} byKey={byKey} />

      {/* Match list label */}
      <div style={{ fontSize: '10px', fontWeight: '600', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
        Matches — tap to expand
      </div>

      {/* Matches */}
      <div>
        {groupMatches.map(e => (
          <MatchCard key={pkey(e.home, e.away)} entry={e} todayISO={todayISO} />
        ))}
      </div>
    </div>
  );
}
