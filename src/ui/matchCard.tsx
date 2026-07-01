import { useState, useEffect as preactUseEffect } from 'preact/hooks';
import type { Match } from '../types';
import { FIFA, FLAG, pkey, parseScore, getMatchWinner, norm, espnNorm } from '../constants';
import { $data, $espn, $espnDetails, navigateToTeam } from '../state';
import { loadEspnSummary } from '../espn';
import { computeSuspensions } from '../suspensions';
import { $sim, getMathLocks } from '../simulation';
import { squadPanel } from './squad';
import { useStore } from '../hooks/useStore';
import { HTMLEl } from './HTMLEl';

// Preact component (new)
interface MatchCardProps {
  entry: Match;
  todayISO: string;
  showSquads?: boolean;
  defaultOpen?: boolean;
}

function resolveDisplay(
  rawName: string,
  simSide: unknown,
  dataByKey: Record<string, any>,
): {
  display: string;
  isPredicted: boolean;
  alternates: string[];
  orig: string;
  kind: string;
  pct?: number;
} {
  if (FLAG[rawName])
    return { display: rawName, isPredicted: false, alternates: [], orig: rawName, kind: 'real' };
  if (!simSide || !Array.isArray(simSide) || !simSide.length) {
    return {
      display: rawName,
      isPredicted: false,
      alternates: [],
      orig: rawName,
      kind: 'placeholder',
    };
  }
  const cands = simSide as { team: string; pct: number }[];
  const top = cands[0];
  const secondPct = cands[1] ? cands[1].pct : 0;
  const mathLocks = getMathLocks(dataByKey);
  const locked = top.pct >= 0.9 || cands.slice(1).every((c) => c.pct < 0.1);
  const projected = !locked && top.pct >= 0.55 && top.pct - secondPct >= 0.25;
  const allLocked = cands.length >= 2 && cands.every((c) => mathLocks[c.team] && c.pct >= 0.02);
  if (locked)
    return {
      display: top.team,
      isPredicted: true,
      alternates: [],
      orig: rawName,
      kind: 'locked',
      pct: top.pct,
    };
  if (projected)
    return {
      display: top.team,
      isPredicted: true,
      alternates: [],
      orig: rawName,
      kind: 'projected',
      pct: top.pct,
    };
  if (allLocked) {
    const pool = cands.filter((c) => mathLocks[c.team] && c.pct >= 0.02);
    return {
      display: pool[0].team,
      isPredicted: true,
      alternates: pool.slice(1, 4).map((c) => c.team),
      orig: rawName,
      kind: 'pool',
    };
  }
  return {
    display: top.team,
    isPredicted: true,
    alternates: [],
    orig: rawName,
    kind: 'stack',
    pct: top.pct,
  };
}

function MatchEvents({
  espnDetail,
  home,
  away,
  goals1,
  goals2,
}: {
  espnDetail: any;
  home: string;
  away: string;
  goals1: any[];
  goals2: any[];
}) {
  if (!espnDetail)
    return (
      <div style={{ fontSize: '11px', color: '#4b5563', fontStyle: 'italic' }}>
        Loading match events…
      </div>
    );
  if (espnDetail.loading && !espnDetail.loaded)
    return (
      <div style={{ fontSize: '11px', color: '#4b5563', fontStyle: 'italic' }}>
        Loading match events…
      </div>
    );
  if (espnDetail.error && !espnDetail.loaded)
    return (
      <div style={{ fontSize: '11px', color: '#7f1d1d' }}>
        Could not load match events ({espnDetail.error})
      </div>
    );

  const subs = espnDetail.subs || [];
  const cards = espnDetail.cards || [];
  const espnGoals = espnDetail.goals || [];
  const lineups = espnDetail.lineups || { home: null, away: null };
  const hasLineups = !!lineups.home?.starters?.length || !!lineups.away?.starters?.length;
  const showEspnGoals = espnGoals.length > 0 && goals1.length === 0 && goals2.length === 0;

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

  if (!subs.length && !cards.length && !showEspnGoals && !hasLineups) {
    return (
      <div
        style={{ fontSize: '11px', color: '#4b5563', fontStyle: 'italic', marginBottom: '12px' }}
      >
        No events yet.
      </div>
    );
  }

  function bucketize(starters: any[]) {
    const buckets: Record<string, any[]> = { G: [], D: [], M: [], F: [], '': [] };
    (starters || []).forEach((p: any) => {
      const pos = (p.position || '').toUpperCase();
      let k = '';
      if (pos.includes('G')) k = 'G';
      else if (pos.startsWith('D') || ['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(pos)) k = 'D';
      else if (pos.startsWith('M') || ['CDM', 'CAM', 'CM'].includes(pos)) k = 'M';
      else if (pos.startsWith('F') || ['ST', 'CF', 'LW', 'RW'].includes(pos)) k = 'F';
      buckets[k].push(p);
    });
    return ['G', 'D', 'M', 'F', ''].flatMap((k) => buckets[k]);
  }

  const homeSide = teamSide(lineups.home?.team || '');
  let homeLU = lineups.home,
    awayLU = lineups.away;
  if (homeLU && homeSide === 'away') {
    const tmp = homeLU;
    homeLU = awayLU;
    awayLU = tmp;
  }

  return (
    <div style={{ marginBottom: '12px' }}>
      {showEspnGoals &&
        (() => {
          const hg = espnGoals.filter((g: any) => teamSide(g.team) === 'home');
          const ag = espnGoals.filter((g: any) => teamSide(g.team) === 'away');
          return (
            <>
              <div
                style={{
                  fontSize: '10px',
                  color: '#6b7280',
                  fontWeight: 600,
                  letterSpacing: '0.5px',
                  marginBottom: '4px',
                  textTransform: 'uppercase',
                }}
              >
                Goals
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '8px',
                  marginBottom: '10px',
                }}
              >
                <div>
                  {hg.map((g: any, i: number) => (
                    <div key={i} style={{ fontSize: '11px', color: '#9ca3af', lineHeight: '1.8' }}>
                      {g.ownGoal ? '⚽ OG ' : g.penalty ? '⚽ P ' : '⚽ '}
                      {g.scorer || '?'} <span style={{ color: '#4b5563' }}>{g.minute}</span>
                    </div>
                  ))}
                </div>
                <div style={{ textAlign: 'right' }}>
                  {ag.map((g: any, i: number) => (
                    <div key={i} style={{ fontSize: '11px', color: '#9ca3af', lineHeight: '1.8' }}>
                      <span style={{ color: '#4b5563' }}>{g.minute}</span> {g.scorer || '?'}{' '}
                      {g.ownGoal ? 'OG ⚽' : g.penalty ? 'P ⚽' : '⚽'}
                    </div>
                  ))}
                </div>
              </div>
            </>
          );
        })()}
      {subs.length > 0 &&
        (() => {
          const hs = subs.filter((s: any) => teamSide(s.team) === 'home');
          const as_ = subs.filter((s: any) => teamSide(s.team) === 'away');
          return (
            <>
              <div
                style={{
                  fontSize: '10px',
                  color: '#6b7280',
                  fontWeight: 600,
                  letterSpacing: '0.5px',
                  marginBottom: '4px',
                  textTransform: 'uppercase',
                }}
              >
                Substitutions
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '8px',
                  marginBottom: '10px',
                }}
              >
                <div>
                  {hs.map((s: any, i: number) => (
                    <div key={i} style={{ fontSize: '11px', color: '#9ca3af', lineHeight: '1.7' }}>
                      🔄 <span style={{ color: '#10b981' }}>{s.playerIn || '?'}</span> ←{' '}
                      <span style={{ color: '#9ca3af' }}>{s.playerOut || '?'}</span>{' '}
                      <span style={{ color: '#4b5563' }}>{s.minute}</span>
                    </div>
                  ))}
                </div>
                <div style={{ textAlign: 'right' }}>
                  {as_.map((s: any, i: number) => (
                    <div key={i} style={{ fontSize: '11px', color: '#9ca3af', lineHeight: '1.7' }}>
                      <span style={{ color: '#4b5563' }}>{s.minute}</span>{' '}
                      <span style={{ color: '#9ca3af' }}>{s.playerOut || '?'}</span> →{' '}
                      <span style={{ color: '#10b981' }}>{s.playerIn || '?'}</span> 🔄
                    </div>
                  ))}
                </div>
              </div>
            </>
          );
        })()}
      {cards.length > 0 &&
        (() => {
          const hc = cards.filter((c: any) => teamSide(c.team) === 'home');
          const ac = cards.filter((c: any) => teamSide(c.team) === 'away');
          return (
            <>
              <div
                style={{
                  fontSize: '10px',
                  color: '#6b7280',
                  fontWeight: 600,
                  letterSpacing: '0.5px',
                  marginBottom: '4px',
                  textTransform: 'uppercase',
                }}
              >
                Cards
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '8px',
                  marginBottom: '10px',
                }}
              >
                <div>
                  {hc.map((c: any, i: number) => (
                    <div key={i} style={{ fontSize: '11px', color: '#9ca3af', lineHeight: '1.7' }}>
                      {c.type === 'red' ? '🟥' : c.type === 'yellowred' ? '🟨🟥' : '🟨'}{' '}
                      {c.player || '?'} <span style={{ color: '#4b5563' }}>{c.minute}</span>
                    </div>
                  ))}
                </div>
                <div style={{ textAlign: 'right' }}>
                  {ac.map((c: any, i: number) => (
                    <div key={i} style={{ fontSize: '11px', color: '#9ca3af', lineHeight: '1.7' }}>
                      <span style={{ color: '#4b5563' }}>{c.minute}</span> {c.player || '?'}{' '}
                      {c.type === 'red' ? '🟥' : c.type === 'yellowred' ? '🟨🟥' : '🟨'}
                    </div>
                  ))}
                </div>
              </div>
            </>
          );
        })()}
      {hasLineups &&
        (() => {
          const homeFmt = homeLU?.formation || '';
          const awayFmt = awayLU?.formation || '';
          function lineupCol(lu: any, align: string) {
            if (!lu)
              return (
                <div
                  style={{
                    fontSize: '11px',
                    color: '#4b5563',
                    fontStyle: 'italic',
                    textAlign: align as any,
                  }}
                >
                  —
                </div>
              );
            return (
              <div>
                {bucketize(lu.starters).map((p: any, i: number) => (
                  <div
                    key={i}
                    style={{
                      fontSize: '11px',
                      color: '#9ca3af',
                      lineHeight: '1.7',
                      textAlign: align as any,
                    }}
                  >
                    {align === 'right' ? (
                      <>
                        {p.position && (
                          <span style={{ color: '#4b5563', fontSize: '10px', marginRight: '4px' }}>
                            {p.position}
                          </span>
                        )}
                        {p.name || '?'}
                        {p.jersey && (
                          <span style={{ color: '#4b5563', marginLeft: '4px' }}>#{p.jersey}</span>
                        )}
                      </>
                    ) : (
                      <>
                        {p.jersey && (
                          <span style={{ color: '#4b5563', marginRight: '4px' }}>#{p.jersey}</span>
                        )}
                        {p.name || '?'}
                        {p.position && (
                          <span style={{ color: '#4b5563', fontSize: '10px', marginLeft: '4px' }}>
                            {p.position}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            );
          }
          return (
            <>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  marginBottom: '4px',
                }}
              >
                <span
                  style={{
                    fontSize: '10px',
                    color: '#6b7280',
                    fontWeight: 600,
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase',
                  }}
                >
                  Starting XI
                </span>
                {(homeFmt || awayFmt) && (
                  <span style={{ fontSize: '10px', color: '#4b5563' }}>
                    {homeFmt || '?'} · {awayFmt || '?'}
                  </span>
                )}
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '8px',
                  marginBottom: '10px',
                }}
              >
                {lineupCol(homeLU, 'left')}
                {lineupCol(awayLU, 'right')}
              </div>
            </>
          );
        })()}
    </div>
  );
}

export function MatchCard({
  entry,
  todayISO,
  showSquads = true,
  defaultOpen = false,
}: MatchCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const espnMap = useStore($espn);
  const espnDetailsMap = useStore($espnDetails);
  const data = useStore($data);
  const sim = useStore($sim);

  const { home, away, goals1 = [], goals2 = [], date, time, ground, stage, round } = entry;
  const espnKey = pkey(home, away);
  const espn = espnMap[espnKey] || null;

  const dataByKey = (data || {}).byKey || {};
  const simData =
    sim && sim.data
      ? (sim.data as Record<
          string,
          { home: { team: string; pct: number }[]; away: { team: string; pct: number }[] }
        >)
      : null;
  const simSlot = simData && entry.num ? simData[entry.num] : null;

  const homeD = resolveDisplay(home, simSlot && simSlot.home, dataByKey);
  const awayD = resolveDisplay(away, simSlot && simSlot.away, dataByKey);

  const score = espn && (espn.isLive || espn.isPost) ? espn.score : entry.score;
  const pen = espn && (espn.isLive || espn.isPost) && espn.pen ? espn.pen : entry.pen;
  const isLive = !!(espn && espn.isLive);
  const clock = isLive ? espn.clock : null;
  const broadcast = espn && espn.broadcast ? espn.broadcast : null;

  const sc = parseScore(score);
  const scoreDisp = sc !== null ? `${sc.h}-${sc.a}` : null;

  const status = isLive
    ? 'live'
    : scoreDisp
      ? 'played'
      : date === todayISO
        ? 'today'
        : date && date < todayISO
          ? 'played'
          : 'upcoming';

  const sColor =
    status === 'live'
      ? '#f87171'
      : status === 'played'
        ? '#6b7280'
        : status === 'today'
          ? '#f59e0b'
          : '#3b82f6';
  const sLabel =
    status === 'live'
      ? 'LIVE'
      : status === 'played'
        ? 'FT'
        : status === 'today'
          ? 'TODAY'
          : 'Upcoming';
  const barBg =
    status === 'live'
      ? 'rgba(239,68,68,0.12)'
      : status === 'played'
        ? 'rgba(75,85,99,0.12)'
        : status === 'today'
          ? 'rgba(217,119,6,0.15)'
          : 'rgba(30,58,95,0.10)';
  const border =
    status === 'live'
      ? '1px solid rgba(239,68,68,0.35)'
      : status === 'today'
        ? '1px solid rgba(217,119,6,0.4)'
        : '1px solid rgba(255,255,255,0.07)';

  const espnEventId = espn && espn.id;
  const canHaveEvents = !!espnEventId && (isLive || status === 'played');
  const isUpcoming = (status === 'upcoming' || status === 'today') && !isLive && !scoreDisp;

  preactUseEffect(() => {
    if (isOpen && canHaveEvents && espnEventId) {
      loadEspnSummary(espnEventId);
    }
  }, [isOpen, canHaveEvents, espnEventId]);

  const sH = isUpcoming
    ? computeSuspensions(homeD.display, date, stage)
    : { suspended: [], onYellow: [] };
  const sA = isUpcoming
    ? computeSuspensions(awayD.display, date, stage)
    : { suspended: [], onYellow: [] };

  const dateStr = date
    ? new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
    : '';

  const espnDetail = espnEventId ? (espnDetailsMap[espnEventId] as any) : null;

  const ht = entry.ht;
  const detail = espn ? espn.detail : null;
  const winner = getMatchWinner(
    { home, away, score, pen },
    espn && espn.isPost ? espn.winner : null,
  );
  const hWon = winner === home;
  const aWon = winner === away;
  const r1 = FIFA[homeD.display];
  const r2 = FIFA[awayD.display];

  const [squadsOpen, setSquadsOpen] = useState(false);

  return (
    <div
      style={{
        borderRadius: '8px',
        marginBottom: '8px',
        overflow: 'hidden',
        border,
        background: 'rgba(255,255,255,0.03)',
      }}
      data-live={isLive ? 'true' : 'false'}
      data-match-key={`${home}__${away}__${date || ''}`}
    >
      {/* Clickable header + team row */}
      <div style={{ cursor: 'pointer' }} onClick={() => setIsOpen(!isOpen)}>
        {/* Status bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 12px',
            background: barBg,
            borderBottom: '1px solid rgba(255,255,255,0.05)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isLive && (
              <div
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  background: '#f87171',
                  flexShrink: 0,
                  animation: 'pulse 1s ease-in-out infinite',
                }}
              />
            )}
            <span style={{ fontSize: '11px', fontWeight: '700', color: sColor }}>
              {sLabel}
              {isLive && clock ? ' ' + clock : ''}
            </span>
            {dateStr && <span style={{ fontSize: '11px', color: '#6b7280' }}>{dateStr}</span>}
            {!isLive && time && <span style={{ fontSize: '11px', color: '#9ca3af' }}>{time}</span>}
            {broadcast && (
              <span
                style={{
                  fontSize: '10px',
                  color: '#4b5563',
                  background: 'rgba(255,255,255,0.05)',
                  padding: '1px 5px',
                  borderRadius: '3px',
                }}
              >
                {broadcast}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontSize: '11px',
                color: '#374151',
                maxWidth: '90px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {ground || round || ''}
            </span>
            {scoreDisp && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span
                  style={{
                    fontSize: '15px',
                    fontWeight: '800',
                    color: isLive ? '#f87171' : '#fff',
                    background: 'rgba(0,0,0,0.35)',
                    padding: '3px 10px',
                    borderRadius: '6px',
                    border: isLive ? '1px solid rgba(239,68,68,0.5)' : 'none',
                    letterSpacing: '1px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {scoreDisp}
                </span>
                {ht && !isLive && (
                  <span style={{ fontSize: '9px', color: '#4b5563' }}>{ht} HT</span>
                )}
                {pen && <span style={{ fontSize: '9px', color: '#4b5563' }}>{pen} PEN</span>}
                {isLive && detail && detail !== clock && (
                  <span style={{ fontSize: '9px', color: '#f87171' }}>{detail}</span>
                )}
              </div>
            )}
            <span style={{ fontSize: '11px', color: '#4b5563' }}>{isOpen ? '▲' : '▼'}</span>
          </div>
        </div>

        {/* Team row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px' }}>
          {/* Home */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              minWidth: 0,
              cursor: FLAG[homeD.display] ? 'pointer' : undefined,
            }}
            onClick={(e) => {
              e.stopPropagation();
              navigateToTeam(homeD.display);
            }}
          >
            <span style={{ fontSize: '22px', flexShrink: 0 }}>{FLAG[homeD.display] || '🏳'}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
                <span
                  style={{
                    fontSize: '14px',
                    fontWeight: hWon ? '700' : '500',
                    color: hWon ? '#fff' : '#e2e8f0',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {homeD.display}
                </span>
                {homeD.isPredicted && (
                  <span
                    style={{
                      fontSize: '8px',
                      color: '#a8a29e',
                      fontFamily: 'monospace',
                      flexShrink: 0,
                      background: 'rgba(168,162,158,0.12)',
                      padding: '1px 4px',
                      borderRadius: '3px',
                      letterSpacing: '0.3px',
                    }}
                  >
                    PRED
                  </span>
                )}
              </div>
              {r1 && <div style={{ fontSize: '10px', color: '#6b7280' }}>FIFA #{r1}</div>}
              {homeD.alternates.length > 0 && (
                <div
                  style={{
                    fontSize: '9px',
                    color: '#78716c',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  or {homeD.alternates.map((t) => (FLAG[t] || '') + ' ' + t).join(', ')}
                </div>
              )}
            </div>
          </div>

          <div style={{ fontSize: '11px', fontWeight: '700', color: '#4b5563', padding: '0 4px' }}>
            VS
          </div>

          {/* Away */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              minWidth: 0,
              justifyContent: 'flex-end',
              cursor: FLAG[awayD.display] ? 'pointer' : undefined,
            }}
            onClick={(e) => {
              e.stopPropagation();
              navigateToTeam(awayD.display);
            }}
          >
            <div style={{ minWidth: 0, textAlign: 'right' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  minWidth: 0,
                  justifyContent: 'flex-end',
                }}
              >
                {awayD.isPredicted && (
                  <span
                    style={{
                      fontSize: '8px',
                      color: '#a8a29e',
                      fontFamily: 'monospace',
                      flexShrink: 0,
                      background: 'rgba(168,162,158,0.12)',
                      padding: '1px 4px',
                      borderRadius: '3px',
                      letterSpacing: '0.3px',
                    }}
                  >
                    PRED
                  </span>
                )}
                <span
                  style={{
                    fontSize: '14px',
                    fontWeight: aWon ? '700' : '500',
                    color: aWon ? '#fff' : '#e2e8f0',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {awayD.display}
                </span>
              </div>
              {r2 && <div style={{ fontSize: '10px', color: '#6b7280' }}>FIFA #{r2}</div>}
              {awayD.alternates.length > 0 && (
                <div
                  style={{
                    fontSize: '9px',
                    color: '#78716c',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  or {awayD.alternates.map((t) => (FLAG[t] || '') + ' ' + t).join(', ')}
                </div>
              )}
            </div>
            <span style={{ fontSize: '22px', flexShrink: 0 }}>{FLAG[awayD.display] || '🏳'}</span>
          </div>
        </div>
      </div>

      {/* Expanded body */}
      {isOpen && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '12px' }}>
          {/* openfootball goals */}
          {(goals1.length > 0 || goals2.length > 0) && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '8px',
                marginBottom: '12px',
              }}
            >
              <div>
                {goals1.map((g, i) => (
                  <div key={i} style={{ fontSize: '11px', color: '#9ca3af', lineHeight: '1.8' }}>
                    {(g as any).owngoal ? '⚽ OG ' : (g as any).penalty ? '⚽ P ' : '⚽ '}
                    {g.name} <span style={{ color: '#4b5563' }}>{String(g.minute)}'</span>
                  </div>
                ))}
              </div>
              <div style={{ textAlign: 'right' }}>
                {goals2.map((g, i) => (
                  <div key={i} style={{ fontSize: '11px', color: '#9ca3af', lineHeight: '1.8' }}>
                    <span style={{ color: '#4b5563' }}>{String(g.minute)}'</span> {g.name}{' '}
                    {(g as any).owngoal ? 'OG ⚽' : (g as any).penalty ? 'P ⚽' : '⚽'}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ESPN events */}
          {canHaveEvents && (
            <MatchEvents
              espnDetail={espnDetail}
              home={home}
              away={away}
              goals1={goals1}
              goals2={goals2}
            />
          )}

          {/* Suspensions */}
          {isUpcoming &&
            (sH.suspended.length > 0 ||
              sA.suspended.length > 0 ||
              sH.onYellow.length > 0 ||
              sA.onYellow.length > 0) && (
              <div style={{ marginBottom: '12px' }}>
                {(sH.suspended.length > 0 || sA.suspended.length > 0) && (
                  <>
                    <div
                      style={{
                        fontSize: '10px',
                        color: '#6b7280',
                        fontWeight: 600,
                        letterSpacing: '0.5px',
                        marginBottom: '4px',
                        textTransform: 'uppercase',
                      }}
                    >
                      Suspensions
                    </div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '8px',
                        marginBottom: '8px',
                      }}
                    >
                      <div>
                        {sH.suspended.map((p, i) => (
                          <div
                            key={i}
                            style={{ fontSize: '11px', color: '#fca5a5', lineHeight: '1.7' }}
                          >
                            ⛔ <span style={{ color: '#e2e8f0', fontWeight: 500 }}>{p.name}</span>
                            <span style={{ color: '#6b7280', marginLeft: '4px' }}>{p.reason}</span>
                          </div>
                        ))}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        {sA.suspended.map((p, i) => (
                          <div
                            key={i}
                            style={{ fontSize: '11px', color: '#fca5a5', lineHeight: '1.7' }}
                          >
                            <span style={{ color: '#6b7280', marginRight: '4px' }}>{p.reason}</span>
                            <span style={{ color: '#e2e8f0', fontWeight: 500 }}>{p.name}</span> ⛔
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                {(sH.onYellow.length > 0 || sA.onYellow.length > 0) && (
                  <>
                    <div
                      style={{
                        fontSize: '10px',
                        color: '#6b7280',
                        fontWeight: 600,
                        letterSpacing: '0.5px',
                        marginBottom: '4px',
                        textTransform: 'uppercase',
                      }}
                    >
                      On a yellow
                    </div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '8px',
                        marginBottom: '8px',
                      }}
                    >
                      <div>
                        {sH.onYellow.map((p, i) => (
                          <div
                            key={i}
                            style={{ fontSize: '11px', color: '#fcd34d', lineHeight: '1.7' }}
                          >
                            🟨 <span style={{ color: '#cbd5e1' }}>{p.name}</span>
                          </div>
                        ))}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        {sA.onYellow.map((p, i) => (
                          <div
                            key={i}
                            style={{ fontSize: '11px', color: '#fcd34d', lineHeight: '1.7' }}
                          >
                            <span style={{ color: '#cbd5e1' }}>{p.name}</span> 🟨
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

          {/* Squads */}
          {showSquads &&
            (() => {
              const squadsGrid = (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '12px',
                    marginTop: '8px',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginBottom: '8px',
                      }}
                    >
                      <span style={{ fontSize: '18px' }}>{FLAG[homeD.display] || '🏳'}</span>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          color: '#e2e8f0',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {homeD.display}
                      </span>
                      {r1 && <span style={{ fontSize: '10px', color: '#6b7280' }}>#{r1}</span>}
                    </div>
                    <HTMLEl factory={() => squadPanel(homeD.display)} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginBottom: '8px',
                      }}
                    >
                      <span style={{ fontSize: '18px' }}>{FLAG[awayD.display] || '🏳'}</span>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          color: '#e2e8f0',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {awayD.display}
                      </span>
                      {r2 && <span style={{ fontSize: '10px', color: '#6b7280' }}>#{r2}</span>}
                    </div>
                    <HTMLEl factory={() => squadPanel(awayD.display)} />
                  </div>
                </div>
              );
              if (!canHaveEvents) return squadsGrid;
              return (
                <>
                  <div
                    style={{
                      marginTop: '8px',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '11px',
                      color: '#9ca3af',
                      userSelect: 'none',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSquadsOpen(!squadsOpen);
                    }}
                  >
                    <span>Squads</span>
                    <span
                      style={{
                        fontSize: '10px',
                        color: '#6b7280',
                        transform: squadsOpen ? 'rotate(180deg)' : 'rotate(0)',
                        display: 'inline-block',
                        transition: 'transform .15s',
                      }}
                    >
                      ▼
                    </span>
                  </div>
                  {squadsOpen && squadsGrid}
                </>
              );
            })()}
        </div>
      )}
    </div>
  );
}
