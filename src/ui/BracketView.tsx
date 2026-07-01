import { h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import type { Match } from '../types';
import { FLAG, pkey, parseScore, getMatchWinner, BRACKET_FEEDS } from '../constants';
import { $data, $status, $today, $bracketRound, navigateToTeam } from '../state';
import { $espn } from '../state';
import {
  $sim,
  SIM_TRIALS_DEFAULT,
  startSimulation,
  cancelSimulation,
  projectBracket,
  getMathLocks,
  dataFingerprint,
} from '../simulation';
import { useStore } from '../hooks/useStore';
import { MatchCard } from './matchCard';

// Which round each match number belongs to.
const ROUND_OF_MATCH: Record<number, string> = { 103: '3rd', 104: 'final' };
[73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88].forEach(
  (n) => (ROUND_OF_MATCH[n] = 'r32'),
);
[89, 90, 91, 92, 93, 94, 95, 96].forEach((n) => (ROUND_OF_MATCH[n] = 'r16'));
[97, 98, 99, 100].forEach((n) => (ROUND_OF_MATCH[n] = 'qf'));
[101, 102].forEach((n) => (ROUND_OF_MATCH[n] = 'sf'));

// Walks BRACKET_FEEDS backwards from the Final to find, in true left-to-right
// bracket order, every match at `targetRound` that feeds into `num`. Building
// every round's display order from a single traversal (rather than picking an
// order per round independently) guarantees that adjacent pairs at every
// level actually converge into the next round's slot — a plain numeric sort
// does not, because the draw crosses over between the two bracket halves at
// the semifinal stage.
function leavesAtRound(num: number, targetRound: string): number[] {
  if (ROUND_OF_MATCH[num] === targetRound) return [num];
  const feed = BRACKET_FEEDS[num];
  if (!feed) return [];
  return [...leavesAtRound(feed.home, targetRound), ...leavesAtRound(feed.away, targetRound)];
}

const ROUND_MATCHES: Record<string, number[]> = {
  r32: leavesAtRound(104, 'r32'),
  r16: leavesAtRound(104, 'r16'),
  qf: leavesAtRound(104, 'qf'),
  sf: [101, 102],
  '3rd': [103],
  final: [104],
};

// Round sequence for the pager — one step per knockout round.
const ROUND_SEQ = ['r32', 'r16', 'qf', 'sf', 'final'] as const;
const ROUND_LABELS: Record<string, string> = {
  r32: 'Round of 32',
  r16: 'Round of 16',
  qf: 'Quarter-finals',
  sf: 'Semifinals',
  final: 'Final',
};

// A finished real result (including penalty shootouts) — used to light up the
// connector line tracing that winner into the next round's slot. Module-level
// (rather than a closure inside BracketView) so the pre-layout-effect that
// measures connector positions can call it too, ahead of the component's
// early-return-if-no-data check.
function isMatchDecided(
  num: number,
  byNum: Record<string, Match>,
  espn: Record<string, any>,
): boolean {
  const entry = byNum[num] as Match | undefined;
  if (!entry?.home || !entry.away || !FLAG[entry.home] || !FLAG[entry.away]) return false;
  const espnE = espn[pkey(entry.home, entry.away)];
  const rawScore = espnE && (espnE.isLive || espnE.isPost) ? espnE.score : entry.score;
  const rawPen = espnE && (espnE.isLive || espnE.isPost) && espnE.pen ? espnE.pen : entry.pen;
  return !!getMatchWinner(
    { home: entry.home, away: entry.away, score: rawScore || null, pen: rawPen },
    espnE?.isPost ? espnE.winner : null,
  );
}

type ProjSlot = {
  team?: string;
  confidence?: string;
  alts?: { team: string; condition: string }[];
  candidates?: { team: string; pct: number }[];
};

// ─── SVG CONNECTOR ────────────────────────────────────────────────────────────
// Connector paths are computed from measured DOM positions (see the
// BracketView `measureLines` effect) rather than precomputed pixel math —
// hand-computed spacing drifted out of sync with real rendered card heights
// and the bracket's true convergence order (which crosses between draw halves
// partway through, so a naive "adjacent items pair up" assumption breaks).
const CONNECTOR_DIM = 'rgba(255,255,255,0.15)';
const CONNECTOR_LIT = '#4ade80';
const CONNECTOR_LOSER = '#60a5fa';

// ─── MATCH DETAIL PANEL (left-side drawer) ────────────────────────────────────
// Renders the full schedule-style MatchCard in a fixed slide-over instead of
// growing a bracket row in place — a bracket card is only ~150px wide, nowhere
// near enough room for goals/lineups/events without overlapping other rows.
function MatchDetailPanel({
  entry,
  todayISO,
  onClose,
}: {
  entry: Match;
  todayISO: string;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        background: 'rgba(0,0,0,0.5)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 'min(420px, 92vw)',
          height: '100%',
          background: '#0b1220',
          borderRight: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '4px 0 32px rgba(0,0,0,0.55)',
          overflowY: 'auto',
          padding: '16px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '14px',
          }}
        >
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: '#9ca3af',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}
          >
            Match Details
          </span>
          <button
            onClick={onClose}
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.05)',
              color: '#9ca3af',
              fontSize: '16px',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>
        <MatchCard entry={entry} todayISO={todayISO} defaultOpen />
      </div>
    </div>
  );
}

// ─── PBSLOT (SVG bracket card) ─────────────────────────────────────────────────
function PBSlot({
  num,
  projHome,
  projAway,
  entry,
  small,
  byKey,
  espn,
  expandable,
  onExpandToggle,
}: {
  num: number;
  projHome: ProjSlot | null;
  projAway: ProjSlot | null;
  entry: Match | undefined;
  small?: boolean;
  byKey: Record<string, Match>;
  espn: Record<string, any>;
  expandable?: boolean;
  onExpandToggle?: () => void;
}) {
  const w = small ? 128 : 148;
  const mathLocks = getMathLocks(byKey);
  const espnE = entry ? espn[pkey(entry.home || '', entry.away || '')] : null;
  const rawScore = espnE && (espnE.isLive || espnE.isPost) ? espnE.score : entry?.score;
  const rawPen =
    espnE && (espnE.isLive || espnE.isPost) && espnE.pen ? espnE.pen : entry?.pen || null;
  const sc = parseScore(rawScore || null);
  const winner = getMatchWinner(
    { home: entry?.home || '', away: entry?.away || '', score: rawScore || null, pen: rawPen },
    espnE?.isPost ? espnE.winner : null,
  );
  const hW = !!entry?.home && winner === entry.home;
  const aW = !!entry?.away && winner === entry.away;
  const hScore = sc !== null ? String(sc.h) : null;
  const aScore = sc !== null ? String(sc.a) : null;
  const isLive = !!(espnE && espnE.isLive);
  const ds = entry?.date
    ? new Date(entry.date + 'T12:00:00').toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    : '';

  const homeProj =
    projHome ||
    (entry
      ? { team: entry.home, confidence: 'confirmed', alts: [] }
      : { team: 'TBD', confidence: 'unknown', alts: [] });
  const awayProj =
    projAway ||
    (entry
      ? { team: entry.away, confidence: 'confirmed', alts: [] }
      : { team: 'TBD', confidence: 'unknown', alts: [] });

  function makeStack(proj: ProjSlot, isHomeRow: boolean) {
    const raw = (proj.candidates || []).slice(0, 3);
    if (!raw.length) {
      return (
        <div
          data-testid="bracket-team-row"
          data-team=""
          data-confidence="unknown"
          style={{
            padding: '6px',
            fontSize: '10px',
            color: '#6b7280',
            borderBottom: isHomeRow ? '1px solid rgba(255,255,255,0.07)' : 'none',
          }}
        >
          TBD
        </div>
      );
    }
    const top = raw[0];
    const secondPct = raw[1] ? raw[1].pct : 0;
    const allCands = proj.candidates || [];
    const locked = top.pct >= 0.9 || raw.slice(1).every((c) => c.pct < 0.1);
    const projected = !locked && top.pct >= 0.55 && top.pct - secondPct >= 0.25;
    const allLocked =
      allCands.length >= 2 && allCands.every((c) => mathLocks[c.team] && c.pct >= 0.02);

    if (locked) {
      return (
        <div
          data-testid="bracket-team-row"
          data-team={top.team}
          data-confidence="locked"
          style={{
            padding: '8px 8px',
            borderBottom: isHomeRow ? '1px solid rgba(255,255,255,0.07)' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(74,222,128,0.05)',
            cursor: 'pointer',
          }}
          onClick={(e) => {
            e.stopPropagation();
            navigateToTeam(top.team);
          }}
        >
          <span style={{ fontSize: (small ? 14 : 16) + 'px', flexShrink: 0 }}>
            {FLAG[top.team] || '❓'}
          </span>
          <span
            style={{
              fontSize: (small ? 11 : 12) + 'px',
              color: '#e2e8f0',
              fontWeight: 600,
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {top.team}
          </span>
          <span
            style={{
              fontSize: '8px',
              color: '#4ade80',
              fontFamily: 'monospace',
              flexShrink: 0,
              background: 'rgba(74,222,128,0.12)',
              padding: '1px 4px',
              borderRadius: '3px',
            }}
          >
            {top.pct >= 0.995 ? 'LOCKED' : Math.round(top.pct * 100) + '%'}
          </span>
        </div>
      );
    }

    if (allLocked && !projected) {
      const poolTeams = allCands.filter((c) => mathLocks[c.team] && c.pct >= 0.02).slice(0, 4);
      const predicted = poolTeams[0];
      const alternates = poolTeams.slice(1);
      return (
        <div
          data-testid="bracket-team-row"
          data-team={predicted.team}
          data-confidence="pred"
          style={{
            borderBottom: isHomeRow ? '1px solid rgba(255,255,255,0.07)' : 'none',
            background: 'rgba(168,162,158,0.04)',
          }}
        >
          <div
            style={{
              padding: '6px 8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
            }}
            onClick={(e) => {
              e.stopPropagation();
              navigateToTeam(predicted.team);
            }}
          >
            <span style={{ fontSize: (small ? 14 : 16) + 'px', flexShrink: 0 }}>
              {FLAG[predicted.team] || '❓'}
            </span>
            <span
              style={{
                fontSize: (small ? 11 : 12) + 'px',
                color: '#e2e8f0',
                fontWeight: 600,
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {predicted.team}
            </span>
            <span
              style={{
                fontSize: '8px',
                color: '#a8a29e',
                fontFamily: 'monospace',
                flexShrink: 0,
                background: 'rgba(168,162,158,0.14)',
                padding: '1px 4px',
                borderRadius: '3px',
                letterSpacing: '0.3px',
              }}
            >
              PRED
            </span>
          </div>
          {alternates.length > 0 && (
            <div
              style={{
                padding: '1px 8px 4px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '9px',
                color: '#78716c',
                overflow: 'hidden',
              }}
            >
              <span style={{ flexShrink: 0 }}>or</span>
              {alternates.map((c) => (
                <span
                  key={c.team}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '2px',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateToTeam(c.team);
                  }}
                >
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
        <div
          data-testid="bracket-team-row"
          data-team={top.team}
          data-confidence="projected"
          style={{
            padding: '8px 8px',
            borderBottom: isHomeRow ? '1px solid rgba(255,255,255,0.07)' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(147,197,253,0.04)',
            cursor: 'pointer',
          }}
          onClick={(e) => {
            e.stopPropagation();
            navigateToTeam(top.team);
          }}
        >
          <span style={{ fontSize: (small ? 14 : 16) + 'px', flexShrink: 0 }}>
            {FLAG[top.team] || '❓'}
          </span>
          <span
            style={{
              fontSize: (small ? 11 : 12) + 'px',
              color: '#e2e8f0',
              fontWeight: 600,
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {top.team}
          </span>
          <span
            style={{
              fontSize: '8px',
              color: '#93c5fd',
              fontFamily: 'monospace',
              flexShrink: 0,
              background: 'rgba(147,197,253,0.12)',
              padding: '1px 4px',
              borderRadius: '3px',
            }}
          >
            {Math.round(top.pct * 100)}%
          </span>
        </div>
      );
    }

    return (
      <div
        style={{
          padding: '3px 5px',
          borderBottom: isHomeRow ? '1px solid rgba(255,255,255,0.07)' : 'none',
        }}
      >
        {raw.map((c) => {
          const pctTxt =
            c.pct >= 0.995 ? '>99%' : c.pct < 0.005 ? '<1%' : Math.round(c.pct * 100) + '%';
          return (
            <div
              key={c.team}
              data-testid="bracket-team-row"
              data-team={c.team}
              data-confidence="candidate"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                padding: '1px 0',
                position: 'relative',
                cursor: 'pointer',
              }}
              onClick={(e) => {
                e.stopPropagation();
                navigateToTeam(c.team);
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 1,
                  bottom: 1,
                  width: Math.max(2, c.pct * 100) + '%',
                  background: 'rgba(59,130,246,0.25)',
                  borderRadius: '2px',
                  zIndex: 0,
                }}
              />
              <span style={{ fontSize: '11px', flexShrink: 0, zIndex: 1, position: 'relative' }}>
                {FLAG[c.team] || '❓'}
              </span>
              <span
                style={{
                  fontSize: (small ? 9 : 10) + 'px',
                  color: '#e2e8f0',
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  zIndex: 1,
                  position: 'relative',
                }}
              >
                {c.team}
              </span>
              <span
                style={{
                  fontSize: '9px',
                  color: '#9ca3af',
                  fontFamily: 'monospace',
                  flexShrink: 0,
                  zIndex: 1,
                  position: 'relative',
                }}
              >
                {pctTxt}
              </span>
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
    const displayFlag = isUnknown ? '❓' : FLAG[proj.team!] || '❓';
    const hasAlts = !isUnknown && proj.alts && proj.alts.length > 0;
    const color =
      proj.confidence === 'confirmed'
        ? null
        : proj.confidence === 'projected'
          ? '#93c5fd'
          : proj.confidence === 'contested'
            ? '#fbbf24'
            : '#6b7280';
    return (
      <div
        data-testid="bracket-team-row"
        data-team={isUnknown ? '' : proj.team}
        data-confidence={proj.confidence || 'unknown'}
        data-has-score={scoreVal !== null}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '3px',
          padding: '4px 6px',
          borderBottom: isHomeRow ? '1px solid rgba(255,255,255,0.07)' : 'none',
          background: won ? 'rgba(59,130,246,0.15)' : 'transparent',
          cursor: 'pointer',
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (expandable && onExpandToggle) {
            onExpandToggle();
            return;
          }
          if (!isUnknown) navigateToTeam(proj.team!);
        }}
      >
        <span style={{ fontSize: (small ? 11 : 13) + 'px', flexShrink: 0 }}>{displayFlag}</span>
        <span
          style={{
            fontSize: (small ? 9 : 11) + 'px',
            color: won ? '#fff' : isUnknown ? '#4b5563' : color || '#9ca3af',
            fontWeight: won ? '700' : '400',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {displayTeam}
          {color && !won && !isUnknown ? ' ✦' : ''}
        </span>
        {scoreVal !== null && (
          <span
            style={{
              fontSize: (small ? 11 : 13) + 'px',
              fontWeight: '700',
              color: isLive ? '#f87171' : won ? '#fff' : '#6b7280',
              minWidth: '14px',
              textAlign: 'right',
            }}
          >
            {scoreVal}
          </span>
        )}
        {hasAlts && (
          <span style={{ fontSize: '9px', color: '#fbbf24', flexShrink: 0 }}>
            +{proj.alts!.length}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      data-testid="bracket-slot"
      data-match-num={num}
      style={{
        width: w + 'px',
        borderRadius: '6px',
        overflow: 'hidden',
        border: isLive ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(255,255,255,0.1)',
        background: 'rgba(255,255,255,0.04)',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {makeRow(homeProj, hW, hScore, true)}
      {makeRow(awayProj, aW, aScore, false)}
      {ds && (
        <div
          style={{
            padding: '2px 6px 3px',
            background: 'rgba(0,0,0,0.2)',
            fontSize: '9px',
            color: '#374151',
            marginTop: 'auto',
          }}
        >
          {ds}
          {entry?.time ? ' · ' + entry.time : ''}
          {entry?.ground ? ' · ' + entry.ground : ''}
          {isLive && espnE?.clock ? ' · ' + espnE.clock : ''}
          {rawPen ? ' · ' + rawPen + ' p' : ''}
        </div>
      )}
    </div>
  );
}

// ─── SIM PANEL ────────────────────────────────────────────────────────────────
function SimPanel({
  byKey,
  byNum,
}: {
  byKey: Record<string, Match>;
  byNum: Record<string, Match>;
}) {
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
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 14px',
          borderRadius: '8px',
          background: 'rgba(255,255,255,0.04)',
          border:
            '1px solid ' +
            (isRunning
              ? 'rgba(59,130,246,0.3)'
              : hasStale
                ? 'rgba(251,191,36,0.25)'
                : 'rgba(255,255,255,0.08)'),
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          {isRunning ? (
            <>
              <div
                style={{ fontSize: '12px', fontWeight: 600, color: '#93c5fd', marginBottom: '4px' }}
              >
                Simulating… {sim.completed.toLocaleString()} / {sim.trials.toLocaleString()} ({pct}
                %)
              </div>
              <div
                style={{
                  height: '5px',
                  background: 'rgba(255,255,255,0.06)',
                  borderRadius: '3px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: pct + '%',
                    background: '#3b82f6',
                    transition: 'width 0.2s',
                  }}
                />
              </div>
            </>
          ) : hasFresh ? (
            <>
              <div
                style={{ fontSize: '12px', fontWeight: 600, color: '#4ade80', marginBottom: '2px' }}
              >
                ✓ {sim.trials.toLocaleString()} simulations · {sim.elapsedMs}ms
              </div>
              <div style={{ fontSize: '10px', color: '#6b7280' }}>
                Run {fmtAge(sim.savedAt)} · auto-refreshes when scores update
              </div>
            </>
          ) : hasStale ? (
            <>
              <div
                style={{ fontSize: '12px', fontWeight: 600, color: '#fbbf24', marginBottom: '2px' }}
              >
                ⚠ Recomputing — scores have updated
              </div>
              <div style={{ fontSize: '10px', color: '#9ca3af' }}>
                Previous run {fmtAge(sim.savedAt)}
              </div>
            </>
          ) : (
            <>
              <div
                style={{ fontSize: '12px', fontWeight: 600, color: '#e2e8f0', marginBottom: '2px' }}
              >
                Preparing simulation…
              </div>
              <div style={{ fontSize: '10px', color: '#9ca3af' }}>
                Computing bracket probabilities
              </div>
            </>
          )}
        </div>
        {isRunning ? (
          <button
            style={{
              padding: '7px 14px',
              borderRadius: '6px',
              background: 'rgba(239,68,68,0.15)',
              border: '1px solid rgba(239,68,68,0.4)',
              color: '#f87171',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              flexShrink: 0,
            }}
            onClick={cancelSimulation}
          >
            Cancel
          </button>
        ) : (
          <button
            style={{
              padding: '7px 14px',
              borderRadius: '6px',
              background: 'rgba(59,130,246,0.2)',
              border: '1px solid rgba(59,130,246,0.5)',
              color: '#93c5fd',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              flexShrink: 0,
            }}
            onClick={() => startSimulation(byKey, byNum, SIM_TRIALS_DEFAULT)}
          >
            ↻ Re-run
          </button>
        )}
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
  const todayISO = useStore($today);
  const bracketRoundId = useStore($bracketRound);
  const [expandedNum, setExpandedNum] = useState<number | null>(null);
  const [showThirds, setShowThirds] = useState(false);
  const [rowsHeight, setRowsHeight] = useState<number | null>(null);
  const [lines, setLines] = useState<{ d: string; stroke: string }[]>([]);
  const [phase, setPhase] = useState<'idle' | 'out' | 'in'>('idle');
  const [dir, setDir] = useState<1 | -1>(1);
  const pendingRoundRef = useRef<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const leftRowsRef = useRef<HTMLDivElement>(null);
  const slotRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const roundIndex = Math.max(0, ROUND_SEQ.indexOf(bracketRoundId as (typeof ROUND_SEQ)[number]));

  // Desktop shows the whole remaining bracket (every round from the focused
  // one through the Final) and trims the passed round off as you step
  // forward; mobile only has room for the focused round plus a next-round
  // preview.
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== 'undefined' && window.innerWidth >= 768,
  );
  useEffect(() => {
    function onResize() {
      setIsDesktop(window.innerWidth >= 768);
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const visibleRounds = isDesktop
    ? ROUND_SEQ.slice(roundIndex)
    : ROUND_SEQ.slice(roundIndex, roundIndex + 2);

  // Slide-and-fade transition between rounds: animate the current pair out,
  // then commit the new round to the persisted store (so a reload keeps the
  // user's place) and animate the new pair in from the opposite side.
  function goToRound(newIndex: number) {
    const clamped = Math.max(0, Math.min(ROUND_SEQ.length - 1, newIndex));
    if (clamped === roundIndex || phase !== 'idle') return;
    setDir(clamped > roundIndex ? 1 : -1);
    pendingRoundRef.current = ROUND_SEQ[clamped];
    setPhase('out');
  }

  useEffect(() => {
    if (phase === 'out') {
      const t = window.setTimeout(() => {
        if (pendingRoundRef.current) $bracketRound.set(pendingRoundRef.current);
        setPhase('in');
      }, 200);
      return () => clearTimeout(t);
    }
    if (phase === 'in') {
      let raf2 = 0;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setPhase('idle'));
      });
      return () => {
        cancelAnimationFrame(raf1);
        if (raf2) cancelAnimationFrame(raf2);
      };
    }
  }, [phase]);

  // The left (currently focused) column's rendered height sets the reference;
  // the right (next-round preview) column stretches to fill that same height
  // via CSS `justify-content: space-evenly` (see renderColumn) instead of
  // hand-computed per-round gaps, so it stays correct even if a row's real
  // rendered height varies (e.g. a candidate-probability stack is taller than
  // a plain score row).
  useEffect(() => {
    function measureHeight() {
      const h = leftRowsRef.current?.getBoundingClientRect().height;
      if (h) setRowsHeight(h);
    }
    measureHeight();
    const ro = new ResizeObserver(measureHeight);
    if (leftRowsRef.current) ro.observe(leftRowsRef.current);
    window.addEventListener('resize', measureHeight);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measureHeight);
    };
  }, [data, espn, sim, bracketRoundId]);

  // Draws connector lines between real, measured row positions for every
  // adjacent pair of currently visible rounds, instead of precomputed pixel
  // offsets — robust to any row's actual rendered height and to the
  // bracket's true convergence order (see leavesAtRound above).
  useEffect(() => {
    function measureLines() {
      const stage = stageRef.current;
      if (!stage) {
        setLines([]);
        return;
      }
      const byNum = (data?.byNum || {}) as Record<string, Match>;
      const stageRect = stage.getBoundingClientRect();
      function box(num: number) {
        const el = slotRefs.current[num];
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return {
          left: r.left - stageRect.left,
          right: r.right - stageRect.left,
          midY: (r.top + r.bottom) / 2 - stageRect.top,
        };
      }
      const segs: { d: string; stroke: string }[] = [];
      for (let c = 0; c < visibleRounds.length - 1; c++) {
        const leftId = visibleRounds[c];
        const rightId = visibleRounds[c + 1];
        if (rightId === 'final') continue;
        const fromNums = ROUND_MATCHES[leftId] || [];
        const toNums = ROUND_MATCHES[rightId] || [];
        for (let i = 0; i < fromNums.length; i += 2) {
          const top = box(fromNums[i]);
          const bottom = box(fromNums[i + 1]);
          const dest = box(toNums[i / 2]);
          if (!top || !bottom || !dest) continue;
          const midX = (top.right + dest.left) / 2;
          const avgY = (top.midY + bottom.midY) / 2;
          const topLit = isMatchDecided(fromNums[i], byNum, espn);
          const bottomLit = isMatchDecided(fromNums[i + 1], byNum, espn);
          segs.push({
            d: `M${top.right},${top.midY} H${midX} V${avgY}`,
            stroke: topLit ? CONNECTOR_LIT : CONNECTOR_DIM,
          });
          segs.push({
            d: `M${bottom.right},${bottom.midY} H${midX} V${avgY}`,
            stroke: bottomLit ? CONNECTOR_LIT : CONNECTOR_DIM,
          });
          segs.push({
            d: `M${midX},${avgY} H${dest.left}`,
            stroke: topLit || bottomLit ? CONNECTOR_LIT : CONNECTOR_DIM,
          });
        }
      }
      // Semifinal winners feed the Final (green); semifinal losers feed the
      // 3rd-place match (blue). This is a fan-out (2 sources, 2 destinations
      // each) rather than the usual 2-into-1 convergence, so it's drawn
      // separately from the loop above.
      if (visibleRounds.includes('sf') && visibleRounds.includes('final')) {
        const finalBox = box(104);
        const thirdBox = box(103);
        [101, 102].forEach((num) => {
          const src = box(num);
          if (!src) return;
          const stroke = isMatchDecided(num, byNum, espn) ? null : CONNECTOR_DIM;
          if (finalBox) {
            const midX = (src.right + finalBox.left) / 2;
            segs.push({
              d: `M${src.right},${src.midY} H${midX} V${finalBox.midY} H${finalBox.left}`,
              stroke: stroke || CONNECTOR_LIT,
            });
          }
          if (thirdBox) {
            const midX = (src.right + thirdBox.left) / 2;
            segs.push({
              d: `M${src.right},${src.midY} H${midX} V${thirdBox.midY} H${thirdBox.left}`,
              stroke: stroke || CONNECTOR_LOSER,
            });
          }
        });
      }
      setLines(segs);
    }
    const raf = requestAnimationFrame(measureLines);
    const ro = new ResizeObserver(measureLines);
    if (stageRef.current) ro.observe(stageRef.current);
    window.addEventListener('resize', measureLines);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('resize', measureLines);
    };
  }, [data, espn, sim, rowsHeight, bracketRoundId, phase, isDesktop]);

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

  if (!data || !data.byKey || Object.keys(data.byKey).length === 0) {
    const msg =
      status === 'error'
        ? {
            icon: '⚠️',
            title: 'Bracket data unavailable',
            body: "Could not load fixtures from openfootball. The bracket can't be drawn without group standings. Try the refresh button above, or check back in a minute.",
          }
        : status === 'loading'
          ? {
              icon: '⏳',
              title: 'Loading bracket data…',
              body: 'Fetching the latest fixtures from openfootball.',
            }
          : { icon: '—', title: 'No bracket data', body: 'Fixture source has no data to display.' };
    return (
      <div
        style={{
          padding: '24px 16px',
          borderRadius: '8px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '28px', marginBottom: '8px' }}>{msg.icon}</div>
        <div style={{ fontSize: '14px', fontWeight: 600, color: '#e2e8f0', marginBottom: '6px' }}>
          {msg.title}
        </div>
        <div
          style={{
            fontSize: '12px',
            color: '#9ca3af',
            maxWidth: '440px',
            margin: '0 auto',
            lineHeight: '1.5',
          }}
        >
          {msg.body}
        </div>
      </div>
    );
  }

  const byKey = data.byKey;
  const byNum = data.byNum || {};
  const curKey = dataFingerprint(byKey);
  const simData =
    sim.status === 'done' && sim.key === curKey
      ? (sim.data as Record<
          string,
          { home: { team: string; pct: number }[]; away: { team: string; pct: number }[] }
        >)
      : null;

  const proj = projectBracket(byKey, 'simulated');
  const r32Map: Record<number, (typeof proj.r32)[0]> = {};
  proj.r32.forEach((m) => {
    r32Map[m.num] = m;
  });

  function getSlots(num: number) {
    const entry = byNum[num] as Match | undefined;
    // A real, resolved fixture always wins — covers R32 and any later round once
    // openfootball publishes the matchup (even pre-kickoff or mid-live).
    if (entry?.home && entry.away && FLAG[entry.home] && FLAG[entry.away]) {
      return {
        home: { team: entry.home, confidence: 'confirmed', alts: [] as any[] },
        away: { team: entry.away, confidence: 'confirmed', alts: [] as any[] },
        entry,
      };
    }
    // Monte Carlo candidates now cover every round (R32 through Final).
    if (simData && simData[num]) {
      return {
        home: {
          team: 'TBD',
          confidence: 'unknown',
          alts: [] as any[],
          candidates: simData[num].home || [],
        },
        away: {
          team: 'TBD',
          confidence: 'unknown',
          alts: [] as any[],
          candidates: simData[num].away || [],
        },
        entry,
      };
    }
    // Deterministic group-standings fallback (R32 only) for while the sim is still running.
    const pm = r32Map[num];
    if (pm) return { home: pm.home, away: pm.away, entry };
    return {
      home: { team: 'TBD', confidence: 'unknown', alts: [] as any[] },
      away: { team: 'TBD', confidence: 'unknown', alts: [] as any[] },
      entry,
    };
  }

  // A row for one match slot. Clicking a resolved fixture opens the full
  // match card in the left-side detail panel instead of expanding in place,
  // so this row's height (and therefore connector-line geometry) never
  // changes based on click state. Registers a ref so the measure-lines effect
  // can find its real rendered position.
  function pagerSlot(num: number) {
    const { home, away, entry } = getSlots(num);
    const isResolved = !!(entry?.home && entry.away && FLAG[entry.home] && FLAG[entry.away]);
    return (
      <div
        key={num}
        ref={(el) => {
          slotRefs.current[num] = el;
        }}
      >
        <PBSlot
          num={num}
          projHome={home}
          projAway={away}
          entry={entry}
          byKey={byKey}
          espn={espn}
          expandable={isResolved}
          onExpandToggle={() => setExpandedNum(num)}
        />
      </div>
    );
  }

  const ROW_GAP = 12;

  // Renders one round's column. `isLeft` is the currently focused round
  // (natural height, sets the reference for the right column); the right
  // column is the next-round preview, stretched to match via space-evenly.
  function renderColumn(roundId: (typeof ROUND_SEQ)[number], isLeft: boolean) {
    // The Final isn't part of the doubling chain (it's fed by both
    // semifinals), so it's just centered on its own; 3rd place sits below it
    // without a connector, same convention the old full-bracket view used
    // (this pairing — 2 sources, 2 destinations — doesn't reduce to a single
    // line the way every other round transition does).
    if (roundId === 'final') {
      return (
        <div
          key={roundId}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '10px',
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#fbbf24' }}>🏆 FINAL</div>
          {pagerSlot(104)}
          <div style={{ height: '16px' }} />
          <div style={{ fontSize: '10px', color: '#6b7280' }}>3rd Place</div>
          {pagerSlot(103)}
        </div>
      );
    }

    const nums = ROUND_MATCHES[roundId] || [];
    return (
      <div key={roundId} style={{ flexShrink: 0 }}>
        <div
          ref={isLeft ? leftRowsRef : undefined}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: isLeft ? ROW_GAP + 'px' : 0,
            height: !isLeft && rowsHeight ? rowsHeight + 'px' : undefined,
            justifyContent: isLeft ? undefined : 'space-evenly',
          }}
        >
          {nums.map((n) => pagerSlot(n))}
        </div>
      </div>
    );
  }

  function navBtnStyle(disabled: boolean): h.JSX.CSSProperties {
    return {
      width: '32px',
      height: '32px',
      borderRadius: '50%',
      border: '1px solid rgba(255,255,255,0.12)',
      background: 'rgba(255,255,255,0.04)',
      color: disabled ? '#374151' : '#e2e8f0',
      fontSize: '16px',
      cursor: disabled ? 'default' : 'pointer',
      flexShrink: 0,
    };
  }

  const expandedEntry = expandedNum !== null ? (byNum[expandedNum] as Match | undefined) : null;

  return (
    <div>
      {expandedEntry && (
        <MatchDetailPanel
          entry={expandedEntry}
          todayISO={todayISO}
          onClose={() => setExpandedNum(null)}
        />
      )}

      {/* Legend */}
      <div
        style={{
          display: 'flex',
          gap: '10px',
          flexWrap: 'wrap',
          marginBottom: '12px',
          padding: '8px 12px',
          borderRadius: '8px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.07)',
        }}
      >
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
      <div
        style={{
          padding: '8px 12px',
          borderRadius: '8px',
          marginBottom: '12px',
          background: 'rgba(59,130,246,0.05)',
          border: '1px solid rgba(59,130,246,0.15)',
          fontSize: '10px',
          color: '#6b7280',
          lineHeight: '1.4',
        }}
      >
        <span style={{ color: '#93c5fd', fontWeight: 600 }}>🎲 How this works: </span>
        Each remaining group game is simulated via FIFA-rank Elo + Poisson goal sampling. Across
        thousands of trials, we record how often each team lands in each Round of 32 slot. Bars show
        those probabilities. Auto-refreshes when scores update.
      </div>

      {/* Sim status panel */}
      <SimPanel byKey={byKey} byNum={byNum} />

      {/* Round pager header — click a round name to jump straight to it */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '10px',
          gap: '8px',
        }}
      >
        <button
          onClick={() => goToRound(roundIndex - 1)}
          disabled={roundIndex === 0 || phase !== 'idle'}
          style={navBtnStyle(roundIndex === 0 || phase !== 'idle')}
        >
          ‹
        </button>
        <div
          style={{
            display: 'flex',
            gap: '14px',
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          {ROUND_SEQ.map((r, i) => (
            <span
              key={r}
              onClick={() => goToRound(i)}
              style={{
                fontSize: i === roundIndex ? '14px' : '12px',
                fontWeight: i === roundIndex ? 700 : 400,
                color: i === roundIndex ? '#e2e8f0' : '#6b7280',
                whiteSpace: 'nowrap',
                cursor: phase === 'idle' ? 'pointer' : 'default',
              }}
            >
              {ROUND_LABELS[r]}
            </span>
          ))}
        </div>
        <button
          onClick={() => goToRound(roundIndex + 1)}
          disabled={roundIndex === ROUND_SEQ.length - 1 || phase !== 'idle'}
          style={navBtnStyle(roundIndex === ROUND_SEQ.length - 1 || phase !== 'idle')}
        >
          ›
        </button>
      </div>

      {/* Focused round onward (desktop) or focused + next-round preview
          (mobile), animated between rounds. Horizontal scroll covers the
          case where the full remaining bracket is wider than the viewport. */}
      <div
        style={{
          width: '100%',
          minWidth: 0,
          display: 'flex',
          justifyContent: 'center',
          overflowX: 'auto',
          overflowY: 'hidden',
          paddingBottom: '8px',
        }}
      >
        <div
          ref={stageRef}
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0,
            gap: '40px',
            transform:
              phase === 'out'
                ? `translateX(${dir * -24}px)`
                : phase === 'in'
                  ? `translateX(${dir * 24}px)`
                  : 'translateX(0)',
            opacity: phase === 'idle' ? 1 : 0,
            transition: phase === 'in' ? 'none' : 'transform 200ms ease, opacity 200ms ease',
          }}
        >
          {visibleRounds.map((r, i) => renderColumn(r, i === 0))}
          <svg
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              overflow: 'visible',
            }}
          >
            {lines.map((seg, i) => (
              <path key={i} d={seg.d} fill="none" stroke={seg.stroke} stroke-width="1.5" />
            ))}
          </svg>
        </div>
      </div>

      {/* Best 3rd place — collapsed by default, it's reference info rather
          than something most visits need front and center. */}
      <div
        onClick={() => setShowThirds((v) => !v)}
        style={{
          marginTop: '16px',
          marginBottom: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          cursor: 'pointer',
        }}
      >
        <span
          style={{
            fontSize: '10px',
            color: '#4b5563',
            transform: showThirds ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 150ms ease',
            display: 'inline-block',
          }}
        >
          ▶
        </span>
        <span
          style={{
            fontSize: '10px',
            fontWeight: '600',
            color: '#4b5563',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Best 3rd Place Standings
        </span>
      </div>
      {showThirds && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '6px',
            marginBottom: '8px',
          }}
        >
          {proj.thirds.slice(0, 9).map((t, i) => {
            if (!t.team) return null;
            return (
              <div
                key={t.team}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 8px',
                  borderRadius: '6px',
                  background: i < 8 ? 'rgba(59,130,246,0.06)' : 'rgba(239,68,68,0.06)',
                  border:
                    i < 8 ? '1px solid rgba(59,130,246,0.15)' : '1px solid rgba(239,68,68,0.15)',
                  cursor: 'pointer',
                }}
                onClick={() => navigateToTeam(t.team!)}
              >
                <span
                  style={{
                    fontSize: '12px',
                    color: i < 8 ? '#9ca3af' : '#6b7280',
                    fontFamily: 'monospace',
                    minWidth: '16px',
                  }}
                >
                  {i + 1}
                </span>
                <span style={{ fontSize: '14px' }}>{FLAG[t.team] || '🏳'}</span>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '11px',
                      color: i < 8 ? '#e2e8f0' : '#6b7280',
                      fontWeight: i < 8 ? 600 : 400,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {t.team}
                  </div>
                  <div style={{ fontSize: '9px', color: '#4b5563' }}>
                    {t.pts}pts {t.gf - t.ga >= 0 ? '+' : ''}
                    {t.gf - t.ga} Grp {t.group}
                  </div>
                </div>
                {i === 7 && (
                  <span
                    style={{ fontSize: '9px', color: '#4ade80', marginLeft: 'auto', flexShrink: 0 }}
                  >
                    ✓ in
                  </span>
                )}
                {i === 8 && (
                  <span
                    style={{ fontSize: '9px', color: '#f87171', marginLeft: 'auto', flexShrink: 0 }}
                  >
                    ✗ out
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
