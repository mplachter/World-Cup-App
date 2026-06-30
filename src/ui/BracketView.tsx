import { h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import type { Match } from '../types';
import { FLAG, pkey, parseScore, localTime, BRACKET_BL, BRACKET_BR, BRACKET_NEXT, BRACKET_SIBLING } from '../constants';
import { $data, $status, navigateToTeam } from '../state';
import { $espn } from '../state';
import { $sim, SIM_TRIALS_DEFAULT, startSimulation, cancelSimulation, projectBracket, getMathLocks, dataFingerprint } from '../simulation';
import { useStore } from '../hooks/useStore';

// ─── BRACKET LAYOUT GEOMETRY ──────────────────────────────────────────────────
const BRACKET_BASE_SH = 130;
const BRACKET_BASE_GAP = 10;
const BRACKET_FULL_SH = 145;
const BRACKET_TOTAL_H = 8 * BRACKET_BASE_SH + 7 * BRACKET_BASE_GAP;
const BRACKET_GAPS = [BRACKET_BASE_GAP, 135, 415];

const ROUND_MATCHES: Record<string, number[]> = {
  r32: [73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88],
  r16: [89, 90, 91, 92, 93, 94, 95, 96],
  qf: [97, 98, 99, 100],
  sf: [101, 102],
  '3rd': [103],
  final: [104],
};

const SR: Record<string, string> = { r32: 'R32', r16: 'R16', qf: 'Quarterfinal', sf: 'Semifinal', '3rd': 'Third place', final: 'Final' };

type ProjSlot = {
  team?: string;
  confidence?: string;
  alts?: { team: string; condition: string }[];
  candidates?: { team: string; pct: number }[];
};

// ─── SVG CONNECTOR ────────────────────────────────────────────────────────────
const CONNECTOR_DIM = 'rgba(255,255,255,0.15)';
const CONNECTOR_LIT = '#4ade80';
function Connector({ count, sh, gap, flip, wins }: { count: number; sh: number; gap: number; flip?: boolean; wins?: { top?: boolean; bottom?: boolean }[] }) {
  const totalH = count * sh + (count - 1) * gap;
  const paths: h.JSX.Element[] = [];
  for (let i = 0; i < count; i += 2) {
    const ty = i * (sh + gap) + sh / 2, by = (i + 1) * (sh + gap) + sh / 2, my = (ty + by) / 2;
    const win = wins?.[i / 2];
    const segs: [string, string][] = [
      [`M0,${ty} H10 V${my}`, win?.top ? CONNECTOR_LIT : CONNECTOR_DIM],
      [`M0,${by} H10 V${my}`, win?.bottom ? CONNECTOR_LIT : CONNECTOR_DIM],
      [`M10,${my} H20`, (win?.top || win?.bottom) ? CONNECTOR_LIT : CONNECTOR_DIM],
    ];
    segs.forEach(([d, stroke], pi) => {
      paths.push(<path key={i + '-' + pi} d={d} fill="none" stroke={stroke} stroke-width="1.5" />);
    });
  }
  return (
    <svg width="20" height={String(totalH)} style={{ flexShrink: 0, ...(flip ? { transform: 'scaleX(-1)' } : {}) }}>
      {paths}
    </svg>
  );
}

// ─── PROJ SLOT (round list view) ──────────────────────────────────────────────
function ProjSlotEl({ slot, byKey }: { slot: ProjSlot | null; byKey: Record<string, Match> }) {
  if (!slot) return <span style={{ color: '#374151', fontSize: '11px' }}>TBD</span>;
  const { team, confidence, alts = [], candidates } = slot;
  const mathLocks = getMathLocks(byKey);

  if (candidates && candidates.length) {
    const top = candidates[0];
    const secondPct = candidates[1] ? candidates[1].pct : 0;
    const locked = top.pct >= 0.9 || candidates.slice(1).every(c => c.pct < 0.1);
    const projected = !locked && top.pct >= 0.55 && (top.pct - secondPct) >= 0.25;
    const allLocked = candidates.length >= 2 && candidates.every(c => mathLocks[c.team] && c.pct >= 0.02);

    if (locked) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 8px', borderRadius: '4px', background: 'rgba(74,222,128,0.07)', border: '1px solid rgba(74,222,128,0.25)', cursor: 'pointer' }}
          onClick={(e) => { e.stopPropagation(); navigateToTeam(top.team); }}>
          <span style={{ fontSize: '14px', flexShrink: 0 }}>{FLAG[top.team] || '❓'}</span>
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#e2e8f0', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{top.team}</span>
          <span style={{ fontSize: '8px', color: '#4ade80', fontFamily: 'monospace', flexShrink: 0, background: 'rgba(74,222,128,0.12)', padding: '1px 4px', borderRadius: '3px' }}>
            {top.pct >= 0.995 ? 'LOCKED' : Math.round(top.pct * 100) + '%'}
          </span>
        </div>
      );
    }

    if (allLocked && !projected) {
      const poolTeams = candidates.filter(c => mathLocks[c.team] && c.pct >= 0.02).slice(0, 4);
      const predicted = poolTeams[0];
      const alternates = poolTeams.slice(1);
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 8px', borderRadius: '4px', background: 'rgba(168,162,158,0.06)', border: '1px solid rgba(168,162,158,0.22)', cursor: 'pointer' }}
            onClick={(e) => { e.stopPropagation(); navigateToTeam(predicted.team); }}>
            <span style={{ fontSize: '14px', flexShrink: 0 }}>{FLAG[predicted.team] || '❓'}</span>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#e2e8f0', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{predicted.team}</span>
            <span style={{ fontSize: '8px', color: '#a8a29e', fontFamily: 'monospace', flexShrink: 0, background: 'rgba(168,162,158,0.14)', padding: '1px 4px', borderRadius: '3px', letterSpacing: '0.3px' }}>PRED</span>
          </div>
          {alternates.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 8px', fontSize: '9px', color: '#78716c' }}>
              <span>or</span>
              {alternates.map(c => (
                <span key={c.team} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', cursor: 'pointer' }}
                  onClick={(e) => { e.stopPropagation(); navigateToTeam(c.team); }}>
                  <span style={{ fontSize: '10px' }}>{FLAG[c.team] || '❓'}</span>
                  <span style={{ color: '#a8a29e' }}>{c.team}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (projected) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 8px', borderRadius: '4px', background: 'rgba(147,197,253,0.06)', border: '1px solid rgba(147,197,253,0.22)', cursor: 'pointer' }}
          onClick={(e) => { e.stopPropagation(); navigateToTeam(top.team); }}>
          <span style={{ fontSize: '14px', flexShrink: 0 }}>{FLAG[top.team] || '❓'}</span>
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#e2e8f0', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{top.team}</span>
          <span style={{ fontSize: '8px', color: '#93c5fd', fontFamily: 'monospace', flexShrink: 0, background: 'rgba(147,197,253,0.12)', padding: '1px 4px', borderRadius: '3px' }}>
            {Math.round(top.pct * 100)}%
          </span>
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', width: '100%' }}>
        {candidates.slice(0, 3).map(c => {
          const pctTxt = c.pct >= 0.995 ? '>99%' : c.pct < 0.005 ? '<1%' : Math.round(c.pct * 100) + '%';
          return (
            <div key={c.team} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 6px', borderRadius: '3px', position: 'relative', overflow: 'hidden', cursor: 'pointer' }}
              onClick={(e) => { e.stopPropagation(); navigateToTeam(c.team); }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: Math.max(2, c.pct * 100) + '%', background: 'rgba(59,130,246,0.22)', zIndex: 0 }} />
              <span style={{ fontSize: '12px', flexShrink: 0, zIndex: 1, position: 'relative' }}>{FLAG[c.team] || '❓'}</span>
              <span style={{ fontSize: '10px', color: '#e2e8f0', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', zIndex: 1, position: 'relative' }}>{c.team}</span>
              <span style={{ fontSize: '9px', color: '#9ca3af', fontFamily: 'monospace', flexShrink: 0, zIndex: 1, position: 'relative' }}>{pctTxt}</span>
            </div>
          );
        })}
      </div>
    );
  }

  const [altsOpen, setAltsOpen] = useState(false);
  const isUnknown = confidence === 'unknown';
  const displayTeam = isUnknown ? 'TBD' : team!;
  const displayFlag = isUnknown ? '❓' : (FLAG[team!] || '❓');
  const showAlts = !isUnknown && alts.length > 0;
  const color = confidence === 'confirmed' ? '#4ade80' : confidence === 'projected' ? '#93c5fd' : confidence === 'contested' ? '#fbbf24' : '#6b7280';
  const bg = confidence === 'confirmed' ? 'rgba(74,222,128,0.1)' : confidence === 'projected' ? 'rgba(147,197,253,0.08)' : confidence === 'contested' ? 'rgba(251,191,36,0.1)' : 'rgba(255,255,255,0.04)';

  return (
    <div>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '3px 6px', borderRadius: '4px', background: bg, border: `1px solid ${color}44`, cursor: showAlts ? 'pointer' : (isUnknown ? 'default' : 'pointer'), minWidth: 0 }}
        onClick={(e) => { e.stopPropagation(); if (showAlts) setAltsOpen(o => !o); else if (!isUnknown) navigateToTeam(team!); }}
      >
        <span style={{ fontSize: '13px', flexShrink: 0 }}>{displayFlag}</span>
        <span style={{ fontSize: '10px', fontWeight: 600, color: isUnknown ? '#4b5563' : (displayTeam === 'TBD' ? '#374151' : '#e2e8f0'), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {displayTeam}
        </span>
        {showAlts && <span style={{ fontSize: '9px', color, flexShrink: 0, marginLeft: '2px' }}>+{alts.length}</span>}
      </div>
      {showAlts && altsOpen && (
        <div style={{ marginTop: '4px' }}>
          {alts.map(alt => (
            <div key={alt.team} style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '2px 4px', borderRadius: '3px', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', marginBottom: '2px' }}>
              <span style={{ fontSize: '11px' }}>{FLAG[alt.team] || '❓'}</span>
              <span style={{ fontSize: '9px', color: '#fbbf24' }}>{alt.team}</span>
              <span style={{ fontSize: '8px', color: '#4b5563', marginLeft: '2px' }}>if {alt.condition}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── PBSLOT (SVG bracket card) ─────────────────────────────────────────────────
function PBSlot({ num, projHome, projAway, entry, small, byKey, espn }: {
  num: number;
  projHome: ProjSlot | null;
  projAway: ProjSlot | null;
  entry: Match | undefined;
  small?: boolean;
  byKey: Record<string, Match>;
  espn: Record<string, any>;
}) {
  const w = small ? 128 : 148;
  const sh = small ? 130 : 145;
  const mathLocks = getMathLocks(byKey);
  const espnE = entry ? espn[pkey(entry.home || '', entry.away || '')] : null;
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

  function makeStack(proj: ProjSlot, isHomeRow: boolean) {
    const raw = (proj.candidates || []).slice(0, 3);
    if (!raw.length) {
      return <div data-testid="bracket-team-row" data-team="" data-confidence="unknown" style={{ padding: '6px', fontSize: '10px', color: '#6b7280', borderBottom: isHomeRow ? '1px solid rgba(255,255,255,0.07)' : 'none' }}>TBD</div>;
    }
    const top = raw[0];
    const secondPct = raw[1] ? raw[1].pct : 0;
    const allCands = proj.candidates || [];
    const locked = top.pct >= 0.9 || raw.slice(1).every(c => c.pct < 0.1);
    const projected = !locked && top.pct >= 0.55 && (top.pct - secondPct) >= 0.25;
    const allLocked = allCands.length >= 2 && allCands.every(c => mathLocks[c.team] && c.pct >= 0.02);

    if (locked) {
      return (
        <div data-testid="bracket-team-row" data-team={top.team} data-confidence="locked" style={{ padding: '8px 8px', borderBottom: isHomeRow ? '1px solid rgba(255,255,255,0.07)' : 'none', display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(74,222,128,0.05)', cursor: 'pointer' }}
          onClick={(e) => { e.stopPropagation(); navigateToTeam(top.team); }}>
          <span style={{ fontSize: (small ? 14 : 16) + 'px', flexShrink: 0 }}>{FLAG[top.team] || '❓'}</span>
          <span style={{ fontSize: (small ? 11 : 12) + 'px', color: '#e2e8f0', fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{top.team}</span>
          <span style={{ fontSize: '8px', color: '#4ade80', fontFamily: 'monospace', flexShrink: 0, background: 'rgba(74,222,128,0.12)', padding: '1px 4px', borderRadius: '3px' }}>
            {top.pct >= 0.995 ? 'LOCKED' : Math.round(top.pct * 100) + '%'}
          </span>
        </div>
      );
    }

    if (allLocked && !projected) {
      const poolTeams = allCands.filter(c => mathLocks[c.team] && c.pct >= 0.02).slice(0, 4);
      const predicted = poolTeams[0];
      const alternates = poolTeams.slice(1);
      return (
        <div data-testid="bracket-team-row" data-team={predicted.team} data-confidence="pred" style={{ borderBottom: isHomeRow ? '1px solid rgba(255,255,255,0.07)' : 'none', background: 'rgba(168,162,158,0.04)' }}>
          <div style={{ padding: '6px 8px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
            onClick={(e) => { e.stopPropagation(); navigateToTeam(predicted.team); }}>
            <span style={{ fontSize: (small ? 14 : 16) + 'px', flexShrink: 0 }}>{FLAG[predicted.team] || '❓'}</span>
            <span style={{ fontSize: (small ? 11 : 12) + 'px', color: '#e2e8f0', fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{predicted.team}</span>
            <span style={{ fontSize: '8px', color: '#a8a29e', fontFamily: 'monospace', flexShrink: 0, background: 'rgba(168,162,158,0.14)', padding: '1px 4px', borderRadius: '3px', letterSpacing: '0.3px' }}>PRED</span>
          </div>
          {alternates.length > 0 && (
            <div style={{ padding: '1px 8px 4px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9px', color: '#78716c', overflow: 'hidden' }}>
              <span style={{ flexShrink: 0 }}>or</span>
              {alternates.map(c => (
                <span key={c.team} style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  onClick={(e) => { e.stopPropagation(); navigateToTeam(c.team); }}>
                  <span style={{ fontSize: '10px', flexShrink: 0 }}>{FLAG[c.team] || '❓'}</span>
                  <span style={{ color: '#a8a29e' }}>{c.team}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (projected) {
      return (
        <div data-testid="bracket-team-row" data-team={top.team} data-confidence="projected" style={{ padding: '8px 8px', borderBottom: isHomeRow ? '1px solid rgba(255,255,255,0.07)' : 'none', display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(147,197,253,0.04)', cursor: 'pointer' }}
          onClick={(e) => { e.stopPropagation(); navigateToTeam(top.team); }}>
          <span style={{ fontSize: (small ? 14 : 16) + 'px', flexShrink: 0 }}>{FLAG[top.team] || '❓'}</span>
          <span style={{ fontSize: (small ? 11 : 12) + 'px', color: '#e2e8f0', fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{top.team}</span>
          <span style={{ fontSize: '8px', color: '#93c5fd', fontFamily: 'monospace', flexShrink: 0, background: 'rgba(147,197,253,0.12)', padding: '1px 4px', borderRadius: '3px' }}>
            {Math.round(top.pct * 100)}%
          </span>
        </div>
      );
    }

    return (
      <div style={{ padding: '3px 5px', borderBottom: isHomeRow ? '1px solid rgba(255,255,255,0.07)' : 'none' }}>
        {raw.map(c => {
          const pctTxt = c.pct >= 0.995 ? '>99%' : c.pct < 0.005 ? '<1%' : Math.round(c.pct * 100) + '%';
          return (
            <div key={c.team} data-testid="bracket-team-row" data-team={c.team} data-confidence="candidate" style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '1px 0', position: 'relative', cursor: 'pointer' }}
              onClick={(e) => { e.stopPropagation(); navigateToTeam(c.team); }}>
              <div style={{ position: 'absolute', left: 0, top: 1, bottom: 1, width: Math.max(2, c.pct * 100) + '%', background: 'rgba(59,130,246,0.25)', borderRadius: '2px', zIndex: 0 }} />
              <span style={{ fontSize: '11px', flexShrink: 0, zIndex: 1, position: 'relative' }}>{FLAG[c.team] || '❓'}</span>
              <span style={{ fontSize: (small ? 9 : 10) + 'px', color: '#e2e8f0', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', zIndex: 1, position: 'relative' }}>{c.team}</span>
              <span style={{ fontSize: '9px', color: '#9ca3af', fontFamily: 'monospace', flexShrink: 0, zIndex: 1, position: 'relative' }}>{pctTxt}</span>
            </div>
          );
        })}
      </div>
    );
  }

  function makeRow(proj: ProjSlot, won: boolean, scoreVal: string | null, isHomeRow: boolean) {
    if (proj.candidates && !scoreVal) return makeStack(proj, isHomeRow);
    const isUnknown = proj.confidence === 'unknown';
    const displayTeam = isUnknown ? 'TBD' : proj.team!;
    const displayFlag = isUnknown ? '❓' : (FLAG[proj.team!] || '❓');
    const hasAlts = !isUnknown && proj.alts && proj.alts.length > 0;
    const color = proj.confidence === 'confirmed' ? null : proj.confidence === 'projected' ? '#93c5fd' : proj.confidence === 'contested' ? '#fbbf24' : '#6b7280';
    return (
      <div
        data-testid="bracket-team-row"
        data-team={isUnknown ? '' : proj.team}
        data-confidence={proj.confidence || 'unknown'}
        data-has-score={scoreVal !== null}
        style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '4px 6px', borderBottom: isHomeRow ? '1px solid rgba(255,255,255,0.07)' : 'none', background: won ? 'rgba(59,130,246,0.15)' : 'transparent', cursor: 'pointer' }}
        onClick={(e) => { e.stopPropagation(); if (!isUnknown) navigateToTeam(proj.team!); }}
      >
        <span style={{ fontSize: (small ? 11 : 13) + 'px', flexShrink: 0 }}>{displayFlag}</span>
        <span style={{ fontSize: (small ? 9 : 11) + 'px', color: won ? '#fff' : (isUnknown ? '#4b5563' : (color || '#9ca3af')), fontWeight: won ? '700' : '400', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {displayTeam}{color && !won && !isUnknown ? ' ✦' : ''}
        </span>
        {scoreVal !== null && (
          <span style={{ fontSize: (small ? 11 : 13) + 'px', fontWeight: '700', color: isLive ? '#f87171' : won ? '#fff' : '#6b7280', minWidth: '14px', textAlign: 'right' }}>{scoreVal}</span>
        )}
        {hasAlts && <span style={{ fontSize: '9px', color: '#fbbf24', flexShrink: 0 }}>+{proj.alts!.length}</span>}
      </div>
    );
  }

  return (
    <div data-testid="bracket-slot" data-match-num={num} style={{ width: w + 'px', minHeight: sh + 'px', borderRadius: '6px', overflow: 'hidden', border: isLive ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', flexShrink: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      {makeRow(homeProj, hW, hScore, true)}
      {makeRow(awayProj, aW, aScore, false)}
      {ds && <div style={{ padding: '2px 6px 3px', background: 'rgba(0,0,0,0.2)', fontSize: '9px', color: '#374151', marginTop: 'auto' }}>
        {ds}{entry?.time ? ' · ' + entry.time : ''}{entry?.ground ? ' · ' + entry.ground : ''}{isLive && espnE?.clock ? ' · ' + espnE.clock : ''}
      </div>}
    </div>
  );
}

// ─── SIM PANEL ────────────────────────────────────────────────────────────────
function SimPanel({ byKey, byNum }: { byKey: Record<string, Match>; byNum: Record<string, Match> }) {
  const sim = useStore($sim);
  const curKey = dataFingerprint(byKey);
  const isRunning = sim.status === 'running';
  const hasFresh = sim.status === 'done' && sim.key === curKey;
  const hasStale = sim.status === 'done' && sim.key && sim.key !== curKey;
  const pct = isRunning && sim.trials ? Math.round((sim.completed / sim.trials) * 100) : 0;

  function fmtAge(ts: number | undefined) {
    if (!ts) return '';
    const sec = Math.round((Date.now() - ts) / 1000);
    if (sec < 60) return sec + 's ago';
    if (sec < 3600) return Math.round(sec / 60) + 'm ago';
    if (sec < 86400) return Math.round(sec / 3600) + 'h ago';
    return Math.round(sec / 86400) + 'd ago';
  }

  return (
    <div style={{ marginBottom: '12px', display: 'block' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid ' + (isRunning ? 'rgba(59,130,246,0.3)' : hasStale ? 'rgba(251,191,36,0.25)' : 'rgba(255,255,255,0.08)') }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {isRunning ? (
            <>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#93c5fd', marginBottom: '4px' }}>Simulating… {sim.completed.toLocaleString()} / {sim.trials.toLocaleString()} ({pct}%)</div>
              <div style={{ height: '5px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: pct + '%', background: '#3b82f6', transition: 'width 0.2s' }} />
              </div>
            </>
          ) : hasFresh ? (
            <>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#4ade80', marginBottom: '2px' }}>✓ {sim.trials.toLocaleString()} simulations · {sim.elapsedMs}ms</div>
              <div style={{ fontSize: '10px', color: '#6b7280' }}>Run {fmtAge(sim.savedAt)} · auto-refreshes when scores update</div>
            </>
          ) : hasStale ? (
            <>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#fbbf24', marginBottom: '2px' }}>⚠ Recomputing — scores have updated</div>
              <div style={{ fontSize: '10px', color: '#9ca3af' }}>Previous run {fmtAge(sim.savedAt)}</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#e2e8f0', marginBottom: '2px' }}>Preparing simulation…</div>
              <div style={{ fontSize: '10px', color: '#9ca3af' }}>Computing bracket probabilities</div>
            </>
          )}
        </div>
        {isRunning
          ? <button style={{ padding: '7px 14px', borderRadius: '6px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }} onClick={cancelSimulation}>Cancel</button>
          : <button style={{ padding: '7px 14px', borderRadius: '6px', background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.5)', color: '#93c5fd', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }} onClick={() => startSimulation(byKey, byNum, SIM_TRIALS_DEFAULT)}>↻ Re-run</button>
        }
      </div>
    </div>
  );
}

// ─── MAIN BRACKET VIEW ────────────────────────────────────────────────────────
export function BracketView() {
  const data = useStore($data);
  const status = useStore($status);
  const espn = useStore($espn);
  const sim = useStore($sim);
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const [view, setView] = useState(isMobile ? 'r32' : 'full');
  const [scrollToMatch, setScrollToMatch] = useState<number | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Auto-start simulation when data changes
  useEffect(() => {
    function maybeAutoStartSim() {
      if (!data || !data.byKey) return;
      const fp = dataFingerprint(data.byKey);
      const s = $sim.get();
      if (s.status === 'running') return;
      if (s.key === fp && s.data) return;
      startSimulation(data.byKey, data.byNum || {}, SIM_TRIALS_DEFAULT);
    }
    maybeAutoStartSim();
  }, [data]);

  // Scroll to match after view change
  useEffect(() => {
    if (scrollToMatch !== null) {
      const el = contentRef.current?.querySelector(`[data-match-num="${scrollToMatch}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setScrollToMatch(null);
    }
  }, [view, scrollToMatch]);

  if (!data || !data.byKey || Object.keys(data.byKey).length === 0) {
    const msg = status === 'error'
      ? { icon: '⚠️', title: 'Bracket data unavailable', body: "Could not load fixtures from openfootball. The bracket can't be drawn without group standings. Try the refresh button above, or check back in a minute." }
      : status === 'loading'
      ? { icon: '⏳', title: 'Loading bracket data…', body: 'Fetching the latest fixtures from openfootball.' }
      : { icon: '—', title: 'No bracket data', body: 'Fixture source has no data to display.' };
    return (
      <div style={{ padding: '24px 16px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>
        <div style={{ fontSize: '28px', marginBottom: '8px' }}>{msg.icon}</div>
        <div style={{ fontSize: '14px', fontWeight: 600, color: '#e2e8f0', marginBottom: '6px' }}>{msg.title}</div>
        <div style={{ fontSize: '12px', color: '#9ca3af', maxWidth: '440px', margin: '0 auto', lineHeight: '1.5' }}>{msg.body}</div>
      </div>
    );
  }

  const byKey = data.byKey;
  const byNum = data.byNum || {};
  const curKey = dataFingerprint(byKey);
  const simData = (sim.status === 'done' && sim.key === curKey)
    ? sim.data as Record<string, { home: { team: string; pct: number }[]; away: { team: string; pct: number }[] }>
    : null;

  const proj = projectBracket(byKey, 'simulated');
  const r32Map: Record<number, (typeof proj.r32)[0]> = {};
  proj.r32.forEach(m => { r32Map[m.num] = m; });

  function getSlots(num: number) {
    const entry = byNum[num] as Match | undefined;
    // A real, resolved fixture always wins — covers R32 and any later round once
    // openfootball publishes the matchup (even pre-kickoff or mid-live).
    if (entry?.home && entry.away && FLAG[entry.home] && FLAG[entry.away]) {
      return { home: { team: entry.home, confidence: 'confirmed', alts: [] as any[] }, away: { team: entry.away, confidence: 'confirmed', alts: [] as any[] }, entry };
    }
    // Monte Carlo candidates now cover every round (R32 through Final).
    if (simData && simData[num]) {
      return {
        home: { team: 'TBD', confidence: 'unknown', alts: [] as any[], candidates: simData[num].home || [] },
        away: { team: 'TBD', confidence: 'unknown', alts: [] as any[], candidates: simData[num].away || [] },
        entry,
      };
    }
    // Deterministic group-standings fallback (R32 only) for while the sim is still running.
    const pm = r32Map[num];
    if (pm) return { home: pm.home, away: pm.away, entry };
    return { home: { team: 'TBD', confidence: 'unknown', alts: [] as any[] }, away: { team: 'TBD', confidence: 'unknown', alts: [] as any[] }, entry };
  }

  function makeBslot(num: number, small = false) {
    const { home, away, entry } = getSlots(num);
    return <PBSlot key={num} num={num} projHome={home} projAway={away} entry={entry} small={small} byKey={byKey} espn={espn} />;
  }

  // A finished real result with a decisive (non-drawn) score — used to light up
  // the connector line tracing that winner into the next round's slot.
  function isMatchDecided(num: number): boolean {
    const entry = byNum[num] as Match | undefined;
    if (!entry?.home || !entry.away || !FLAG[entry.home] || !FLAG[entry.away]) return false;
    const sc = parseScore(entry.score);
    return !!sc && sc.h !== sc.a;
  }

  function makeBhalf(nums: number[], depth: number, flip = false) {
    const small = depth === 0;
    const sh = small ? BRACKET_BASE_SH : BRACKET_FULL_SH;
    const gap = BRACKET_GAPS[depth];
    const slotArea = nums.length * sh + (nums.length - 1) * gap;
    const pad = Math.max(0, (BRACKET_TOTAL_H - slotArea) / 2);
    const slots = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: gap + 'px', paddingTop: pad + 'px', paddingBottom: pad + 'px' }}>
        {nums.map(n => makeBslot(n, small))}
      </div>
    );
    const wins: { top?: boolean; bottom?: boolean }[] = [];
    for (let i = 0; i < nums.length; i += 2) {
      wins.push({ top: isMatchDecided(nums[i]), bottom: isMatchDecided(nums[i + 1]) });
    }
    const conn = <Connector count={nums.length} sh={sh} gap={gap} flip={flip} wins={wins} />;
    return (
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {flip ? <>{conn}{slots}</> : <>{slots}{conn}</>}
      </div>
    );
  }

  const ROUND_VIEWS = [
    { id: 'r32', l: 'R32' }, { id: 'r16', l: 'R16' }, { id: 'qf', l: 'QF' },
    { id: 'sf', l: 'SF' }, { id: '3rd', l: '3rd' }, { id: 'final', l: 'Final' }
  ];
  const VIEWS = isMobile ? ROUND_VIEWS : [{ id: 'full', l: '🏆 Full Bracket' }, ...ROUND_VIEWS];

  // Round list navigation lookup tables
  const NEXT_M = BRACKET_NEXT;
  const SIBLING_M = BRACKET_SIBLING;
  const ROUND_OF: Record<number, string> = {};
  [73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88].forEach(n => ROUND_OF[n] = 'R16');
  [89, 90, 91, 92, 93, 94, 95, 96].forEach(n => ROUND_OF[n] = 'QF');
  [97, 98, 99, 100].forEach(n => ROUND_OF[n] = 'SF');
  [101, 102].forEach(n => ROUND_OF[n] = 'Final');
  const ROUND_TAB: Record<string, string> = { 'R16': 'r16', 'QF': 'qf', 'SF': 'sf', 'Final': 'final' };

  function effectiveTeam(slot: ProjSlot) {
    if (slot.confidence === 'confirmed' && slot.team && slot.team !== 'TBD') return slot.team;
    if (slot.candidates && slot.candidates.length) {
      const cands = slot.candidates;
      const top = cands[0];
      const secondPct = cands[1] ? cands[1].pct : 0;
      const locked = top.pct >= 0.9 || cands.slice(1).every(c => c.pct < 0.1);
      const projected = top.pct >= 0.55 && (top.pct - secondPct) >= 0.25;
      const ml = getMathLocks(byKey);
      const allLocked = cands.length >= 2 && cands.every(c => ml[c.team] && c.pct >= 0.02);
      if (locked || projected || allLocked) return top.team;
    }
    return null;
  }

  function flagged(name: string) {
    const f = FLAG[name];
    return f ? f + ' ' + name : name;
  }

  const BL = BRACKET_BL;
  const BR = BRACKET_BR;

  return (
    <div>
      {/* View selector */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
        {VIEWS.map(v => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            style={{
              padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 500,
              background: view === v.id ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.05)',
              border: view === v.id ? '1px solid rgba(59,130,246,0.6)' : '1px solid rgba(255,255,255,0.1)',
              color: view === v.id ? '#93c5fd' : '#94a3b8',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {v.l}
          </button>
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '12px', padding: '8px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
        {[
          { color: '#3b82f6', label: 'Bar width = probability across simulations' },
          { color: '#a8a29e', label: 'PRED (predicted from confirmed-qualifier pool)' },
          { color: '#93c5fd', label: 'Projected (strong front-runner)' },
          { color: '#4ade80', label: 'Locked (mathematically certain)' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color }} />
            <span style={{ fontSize: '10px', color: '#9ca3af' }}>{label}</span>
          </div>
        ))}
      </div>

      {/* How it works note */}
      <div style={{ padding: '8px 12px', borderRadius: '8px', marginBottom: '12px', background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)', fontSize: '10px', color: '#6b7280', lineHeight: '1.4' }}>
        <span style={{ color: '#93c5fd', fontWeight: 600 }}>🎲 How this works: </span>
        Each remaining group game is simulated via FIFA-rank Elo + Poisson goal sampling. Across thousands of trials, we record how often each team lands in each Round of 32 slot. Bars show those probabilities. Auto-refreshes when scores update.
      </div>

      {/* Sim status panel */}
      <SimPanel byKey={byKey} byNum={byNum} />

      {/* Content */}
      <div ref={contentRef}>
        {view !== 'full' ? (
          // Round list view
          <div>
            <div style={{ fontSize: '10px', color: '#6b7280', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '8px' }}>
              {SR[view]} · {(ROUND_MATCHES[view] || []).length} match{(ROUND_MATCHES[view] || []).length === 1 ? '' : 'es'}
            </div>
            {(ROUND_MATCHES[view] || []).map(num => {
              const { home, away, entry } = getSlots(num);
              const ko = entry?.date ? new Date(entry.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
              const tm = entry?.time ? localTime(entry.time) : '';
              const venue = entry?.ground || '';
              const meta = [ko, tm].filter(Boolean).join(' · ');
              const nextNum = NEXT_M[num];
              const sibNum = SIBLING_M[num];
              const nextRound = nextNum ? ROUND_OF[num] : null;

              let suffix: h.JSX.Element | null = null;
              if (sibNum) {
                const sibSlots = getSlots(sibNum);
                const hTeam = effectiveTeam(sibSlots.home);
                const aTeam = effectiveTeam(sibSlots.away);
                if (hTeam && aTeam) {
                  suffix = <span style={{ color: '#94a3b8' }}> · winner faces {flagged(hTeam)} / {flagged(aTeam)}</span>;
                } else if (hTeam) {
                  suffix = <span style={{ color: '#94a3b8' }}> · winner faces {flagged(hTeam)}<span style={{ color: '#4b5563' }}> or M{sibNum} away winner</span></span>;
                } else if (aTeam) {
                  suffix = <span style={{ color: '#94a3b8' }}> · winner faces {flagged(aTeam)}<span style={{ color: '#4b5563' }}> or M{sibNum} home winner</span></span>;
                } else {
                  suffix = <span style={{ color: '#4b5563' }}> · winner faces M{sibNum} winner</span>;
                }
              }

              return (
                <div key={num} data-match-num={String(num)} style={{ borderRadius: '8px', marginBottom: '6px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                  {(meta || venue) && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 12px', fontSize: '10px', color: '#6b7280', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: '#374151', fontWeight: 600 }}>M{num}</span>
                        {meta && <span>{meta}</span>}
                      </span>
                      {venue && <span style={{ color: '#4b5563', maxWidth: '45%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{venue}</span>}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}><ProjSlotEl slot={home} byKey={byKey} /></div>
                    <span style={{ fontSize: '10px', color: '#4b5563', padding: '0 4px', flexShrink: 0 }}>vs</span>
                    <div style={{ flex: 1, minWidth: 0 }}><ProjSlotEl slot={away} byKey={byKey} /></div>
                  </div>
                  {nextNum && (
                    <div
                      style={{ padding: '5px 12px 7px', fontSize: '10px', color: '#6b7280', borderTop: '1px solid rgba(255,255,255,0.04)', background: 'rgba(255,255,255,0.015)', cursor: 'pointer' }}
                      onClick={() => {
                        const tabId = ROUND_TAB[nextRound!];
                        if (!tabId) return;
                        setView(tabId);
                        setScrollToMatch(nextNum);
                      }}
                    >
                      <span style={{ color: '#60a5fa' }}>→ M{nextNum} ({nextRound})</span>
                      {suffix}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          // Full SVG bracket view
          <div>
            <div style={{ fontSize: '11px', color: '#4b5563', marginBottom: '8px' }}>← Scroll to see full bracket</div>
            <div style={{ overflowX: 'auto', paddingBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', width: 'max-content', minWidth: '980px', margin: '0 auto', padding: '4px 0' }}>
                {/* Left half */}
                {([
                  ['R32', BL.r32, 0, false],
                  ['R16', BL.r16, 1, false],
                  ['QF',  BL.qf,  2, false],
                ] as [string, number[], number, boolean][]).map(([label, nums, depth]) => (
                  <div key={label + 'L'} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ fontSize: '10px', fontWeight: '600', color: '#4b5563', textTransform: 'uppercase', marginBottom: '8px', textAlign: 'center', whiteSpace: 'nowrap' }}>{label}</div>
                    {makeBhalf(nums, depth, false)}
                  </div>
                ))}

                {/* Center column */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '160px', padding: '0 8px', height: BRACKET_TOTAL_H + 'px' }}>
                  <div style={{ height: '188.5px', flexShrink: 0 }} />
                  <div style={{ fontSize: '10px', fontWeight: '600', color: '#4b5563', textTransform: 'uppercase', height: '14px', flexShrink: 0 }}>SF</div>
                  {makeBslot(101)}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', gap: '4px' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#fbbf24' }}>🏆 FINAL</div>
                    {makeBslot(104)}
                    <div style={{ height: '12px' }} />
                    <div style={{ fontSize: '10px', color: '#6b7280' }}>3rd Place</div>
                    {makeBslot(103)}
                  </div>
                  <div style={{ fontSize: '10px', fontWeight: '600', color: '#4b5563', textTransform: 'uppercase', height: '14px', flexShrink: 0 }}>SF</div>
                  {makeBslot(102)}
                  <div style={{ height: '202.5px', flexShrink: 0 }} />
                </div>

                {/* Right half */}
                {([
                  ['QF',  BR.qf,  2, true],
                  ['R16', BR.r16, 1, true],
                  ['R32', BR.r32, 0, true],
                ] as [string, number[], number, boolean][]).map(([label, nums, depth, flip]) => (
                  <div key={label + 'R'} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ fontSize: '10px', fontWeight: '600', color: '#4b5563', textTransform: 'uppercase', marginBottom: '8px', textAlign: 'center', whiteSpace: 'nowrap' }}>{label}</div>
                    {makeBhalf(nums, depth, flip)}
                  </div>
                ))}
              </div>
            </div>

            {/* Best 3rd place */}
            <div style={{ marginTop: '16px', fontSize: '10px', fontWeight: '600', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
              Best 3rd Place Standings
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '8px' }}>
              {proj.thirds.slice(0, 9).map((t, i) => {
                if (!t.team) return null;
                return (
                  <div
                    key={t.team}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 8px', borderRadius: '6px', background: i < 8 ? 'rgba(59,130,246,0.06)' : 'rgba(239,68,68,0.06)', border: i < 8 ? '1px solid rgba(59,130,246,0.15)' : '1px solid rgba(239,68,68,0.15)', cursor: 'pointer' }}
                    onClick={() => navigateToTeam(t.team!)}
                  >
                    <span style={{ fontSize: '12px', color: i < 8 ? '#9ca3af' : '#6b7280', fontFamily: 'monospace', minWidth: '16px' }}>{i + 1}</span>
                    <span style={{ fontSize: '14px' }}>{FLAG[t.team] || '🏳'}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '11px', color: i < 8 ? '#e2e8f0' : '#6b7280', fontWeight: i < 8 ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.team}</div>
                      <div style={{ fontSize: '9px', color: '#4b5563' }}>{t.pts}pts {t.gf - t.ga >= 0 ? '+' : ''}{t.gf - t.ga} Grp {t.group}</div>
                    </div>
                    {i === 7 && <span style={{ fontSize: '9px', color: '#4ade80', marginLeft: 'auto', flexShrink: 0 }}>✓ in</span>}
                    {i === 8 && <span style={{ fontSize: '9px', color: '#f87171', marginLeft: 'auto', flexShrink: 0 }}>✗ out</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
