import { useState } from 'preact/hooks';
import { FIFA, FLAG, LEAGUES, LC, GROUPS, pkey, calcStandings, parseScore, getLC } from '../constants';
import { $data, $selectedTeam, $squads, SQUADS, navigateToTeam } from '../state';
import { $sim } from '../simulation';
import { useStore } from '../hooks/useStore';
import { HTMLEl } from './HTMLEl';
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

interface TeamDetailProps {
  team: string;
}

function TeamDetailView({ team }: TeamDetailProps) {
  const rank = FIFA[team];
  const grp = teamGroup(team);
  const sq = SQUADS[team];
  const data = useStore($data);
  const simState = useStore($sim);
  const byKey = data?.byKey || {};

  const rows = grp ? calcStandings(grp, byKey) : [];
  const myMatches = Object.values(byKey)
    .filter(e => e.home === team || e.away === team)
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  const dist = teamR32Distribution(team);
  const simData = simState.data as Record<string, { home: { team: string; pct: number }[]; away: { team: string; pct: number }[] }> | null;
  const byNum = data?.byNum || {};

  return (
    <div>
      <button
        onClick={() => $selectedTeam.set(null)}
        style={{ padding: '5px 10px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#9ca3af', fontSize: '12px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', marginBottom: '14px' }}
      >
        ← Back to teams
      </button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px', padding: '14px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <span style={{ fontSize: '48px', flexShrink: 0 }}>{FLAG[team] || '🏳'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#fff', marginBottom: '2px' }}>{team}</div>
          <div style={{ fontSize: '11px', color: '#6b7280' }}>
            {(grp ? 'Group ' + grp + ' · ' : '') + (rank ? 'FIFA #' + rank : '') + (sq ? ' · ' + sq.length + ' players' : '')}
          </div>
        </div>
      </div>

      {/* Group standings */}
      {grp && rows.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '10px', fontWeight: '600', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
            Group {grp} Standings
          </div>
          {rows.map((r, i) => (
            <div
              key={r.team}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 10px', borderRadius: '4px', background: r.team === team ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.02)', marginBottom: '2px', border: r.team === team ? '1px solid rgba(59,130,246,0.3)' : '1px solid transparent' }}
            >
              <span style={{ fontSize: '11px', color: i < 2 ? '#3b82f6' : i === 2 ? '#f59e0b' : '#6b7280', fontFamily: 'monospace', width: '14px' }}>{i + 1}</span>
              <span style={{ fontSize: '15px' }}>{FLAG[r.team] || '🏳'}</span>
              <span style={{ fontSize: '12px', color: '#e2e8f0', flex: 1, fontWeight: r.team === team ? 600 : 400 }}>{r.team}</span>
              <span style={{ fontSize: '10px', color: '#6b7280', fontFamily: 'monospace' }}>{r.mp}p</span>
              <span style={{ fontSize: '10px', color: '#9ca3af', fontFamily: 'monospace' }}>{r.gf - r.ga >= 0 ? '+' : ''}{r.gf - r.ga}</span>
              <span style={{ fontSize: '11px', color: '#fff', fontWeight: 700, fontFamily: 'monospace', minWidth: '24px', textAlign: 'right' }}>{r.pts}pts</span>
            </div>
          ))}
        </div>
      )}

      {/* Bracket projection */}
      {dist.length > 0 && simData && (() => {
        const top = dist[0];
        const isLocked = top.pct >= 0.9 || dist.slice(1).every(d => d.pct < 0.1);
        return (
          <div style={{ marginBottom: '16px', padding: '12px', borderRadius: '8px', background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.15)' }}>
            <div style={{ fontSize: '10px', fontWeight: '600', color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
              Bracket Projection (Simulated)
            </div>
            {dist.slice(0, isLocked ? 1 : 5).map(d => {
              const entry = byNum[d.matchNum];
              const otherSide = d.side === 'home' ? 'away' : 'home';
              const opponents = simData[d.matchNum]?.[otherSide as 'home' | 'away'] || [];
              const dateStr = entry?.date ? new Date(entry.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '';
              const pctTxt = d.pct >= 0.995 ? '>99%' : d.pct < 0.005 ? '<1%' : Math.round(d.pct * 100) + '%';
              return (
                <div key={d.matchNum + d.side} style={{ padding: '8px 10px', marginBottom: '6px', borderRadius: '6px', background: 'rgba(0,0,0,0.2)', border: isLocked ? '1px solid rgba(74,222,128,0.3)' : '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: isLocked ? '#4ade80' : '#93c5fd' }}>{isLocked ? '✓ Confirmed slot' : pctTxt + ' chance'}</span>
                    <span style={{ fontSize: '10px', color: '#6b7280' }}>Match {d.matchNum}</span>
                    {entry?.date && <span style={{ fontSize: '10px', color: '#6b7280' }}>· {dateStr}{entry.time ? ' · ' + entry.time : ''}</span>}
                    {entry?.ground && <span style={{ fontSize: '10px', color: '#374151' }}>· {entry.ground}</span>}
                  </div>
                  {opponents.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', fontSize: '10px', color: '#9ca3af' }}>
                      <span style={{ color: '#6b7280' }}>vs </span>
                      {opponents.slice(0, 3).map((o, i) => (
                        <span key={o.team} style={{ cursor: 'pointer' }} onClick={() => navigateToTeam(o.team)}>
                          {i > 0 ? ', ' : ''}{FLAG[o.team] || ''} {o.team} {Math.round(o.pct * 100)}%
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Schedule */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '10px', fontWeight: '600', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Schedule</div>
        {myMatches.map(m => {
          const oppTeam = m.home === team ? m.away : m.home;
          const sc = parseScore(m.score);
          const ourScore = sc ? (m.home === team ? sc.h : sc.a) : null;
          const oppScore = sc ? (m.home === team ? sc.a : sc.h) : null;
          const result = sc ? (ourScore! > oppScore! ? 'W' : ourScore! < oppScore! ? 'L' : 'D') : null;
          const resColor = result === 'W' ? '#4ade80' : result === 'L' ? '#f87171' : result === 'D' ? '#fbbf24' : '#6b7280';
          const dateStr = m.date ? new Date(m.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '';
          return (
            <div
              key={pkey(m.home, m.away)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', borderRadius: '4px', background: 'rgba(255,255,255,0.02)', marginBottom: '3px', cursor: 'pointer' }}
              onClick={() => navigateToTeam(oppTeam)}
            >
              <span style={{ fontSize: '11px', fontWeight: '700', color: resColor, minWidth: '18px', textAlign: 'center' }}>{result || '—'}</span>
              <span style={{ fontSize: '10px', color: '#6b7280', minWidth: '60px', flexShrink: 0 }}>{dateStr}</span>
              <span style={{ fontSize: '10px', color: '#6b7280', minWidth: '70px', flexShrink: 0 }}>{m.time || ''}</span>
              <span style={{ fontSize: '14px' }}>{m.home === team ? 'vs' : '@'}</span>
              <span style={{ fontSize: '15px', flexShrink: 0 }}>{FLAG[oppTeam] || '🏳'}</span>
              <span style={{ fontSize: '12px', color: '#e2e8f0', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{oppTeam}</span>
              {sc && <span style={{ fontSize: '12px', fontWeight: '700', color: '#fff', fontFamily: 'monospace' }}>{ourScore}-{oppScore}</span>}
              {m.ground && <span style={{ fontSize: '9px', color: '#374151', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>{m.ground}</span>}
              <span style={{ fontSize: '10px', color: '#4b5563', flexShrink: 0 }}>{m.stage === 'group' ? '' : m.stage}</span>
            </div>
          );
        })}
      </div>

      {/* Squad */}
      <div>
        <div style={{ fontSize: '10px', fontWeight: '600', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Squad</div>
        <HTMLEl factory={() => squadPanel(team)} />
      </div>
    </div>
  );
}

function TeamListView() {
  const [search, setSearch] = useState('');
  const [leagueFilter, setLeagueFilter] = useState<string | null>(null);
  const squadsState = useStore($squads);

  const allTeams = Object.keys(FIFA).sort((a, b) => FIFA[a] - FIFA[b]);
  const lower = search.toLowerCase();
  const filtered = allTeams.filter(t => {
    if (search) return t.toLowerCase().includes(lower);
    if (leagueFilter) {
      const sq = SQUADS[t];
      if (!sq) return false;
      return (getLC(sq)[leagueFilter] || 0) > 0;
    }
    return true;
  });

  return (
    <div>
      <input
        type="text"
        placeholder="Search team…"
        value={search}
        onInput={(e) => { setSearch((e.target as HTMLInputElement).value); setLeagueFilter(null); }}
        style={{ width: '100%', padding: '7px 12px', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0', fontSize: '14px', outline: 'none', display: 'block', marginBottom: '12px', boxSizing: 'border-box' }}
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
        {LEAGUES.map(l => (
          <button
            key={l}
            onClick={() => { setLeagueFilter(leagueFilter === l ? null : l); setSearch(''); }}
            style={{
              padding: '4px 8px', borderRadius: '4px', fontSize: '11px',
              background: leagueFilter === l ? LC[l] : 'rgba(255,255,255,0.05)',
              border: '1px solid ' + (leagueFilter === l ? LC[l] : 'rgba(255,255,255,0.1)'),
              color: leagueFilter === l ? '#fff' : '#94a3b8',
              fontWeight: leagueFilter === l ? '600' : '400',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {l}
          </button>
        ))}
      </div>

      <div>
        {filtered.map(team => {
          const sq = SQUADS[team];
          const rank = FIFA[team];
          const grp = teamGroup(team);
          return (
            <div
              key={team}
              onClick={() => $selectedTeam.set(team)}
              style={{ borderRadius: '8px', cursor: 'pointer', marginBottom: '6px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
              onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(59,130,246,0.06)'; (e.currentTarget as HTMLElement).style.border = '1px solid rgba(59,130,246,0.25)'; }}
              onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; (e.currentTarget as HTMLElement).style.border = '1px solid rgba(255,255,255,0.06)'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px' }}>
                <span style={{ fontSize: '11px', fontFamily: 'monospace', color: rank <= 5 ? '#fbbf24' : rank <= 15 ? '#94a3b8' : '#4b5563', width: '20px', textAlign: 'right', flexShrink: 0 }}>{rank}</span>
                <span style={{ fontSize: '20px', flexShrink: 0 }}>{FLAG[team] || '🏳'}</span>
                <span style={{ fontSize: '13px', fontWeight: '500', color: '#e2e8f0', width: '130px', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{team}</span>
                {grp && <span style={{ fontSize: '10px', color: '#6b7280', background: 'rgba(255,255,255,0.05)', padding: '1px 5px', borderRadius: '3px', flexShrink: 0 }}>Grp {grp}</span>}
                {sq
                  ? <div style={{ flex: 1, minWidth: 0 }}><HTMLEl factory={() => leagueBar(getLC(sq), sq.length)} /></div>
                  : <span style={{ flex: 1, fontSize: '11px', color: '#4b5563', fontStyle: 'italic' }}>{squadsState.loaded ? 'no data' : 'loading…'}</span>
                }
                <span style={{ fontSize: '10px', color: '#4b5563', flexShrink: 0, marginLeft: '4px' }}>›</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TeamsView() {
  const selectedTeam = useStore($selectedTeam);
  return selectedTeam
    ? <TeamDetailView team={selectedTeam} />
    : <TeamListView />;
}
