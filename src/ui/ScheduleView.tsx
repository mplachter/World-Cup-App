import { useState, useEffect, useRef } from 'preact/hooks';
import type { Match } from '../types';
import { pkey, timeToMin } from '../constants';
import { $data, $today, $espn, $showCompleted, $collapsedDays, $status, $espnStatus, $squads } from '../state';
import { useStore } from '../hooks/useStore';
import { MatchCard } from './matchCard';
import { buildFeedStatus } from './schedule';

function FeedStatusPanel() {
  const ref = useRef<HTMLDivElement>(null);
  // Re-run whenever status stores change so the refresh button stays wired
  const status = useStore($status);
  const espnStatus = useStore($espnStatus);
  const squads = useStore($squads);
  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = '';
    ref.current.appendChild(buildFeedStatus());
  }, [status, espnStatus, squads]);
  return <div ref={ref} />;
}

const SL: Record<string, string> = {
  group: 'Group',
  r32: 'R32',
  r16: 'R16',
  qf: 'QF',
  sf: 'SF',
  '3rd': '3rd',
  final: 'FINAL',
};

const STAGE_OPTIONS = [
  { id: 'all', l: 'All' },
  { id: 'group', l: 'Group' },
  { id: 'r32', l: 'R32' },
  { id: 'r16', l: 'R16' },
  { id: 'qf', l: 'QF' },
  { id: 'sf', l: 'SF' },
  { id: '3rd', l: '3rd' },
  { id: 'final', l: 'Final' },
];

function formatDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function todayPriority(e: Match, espn: Record<string, any>) {
  const ek = espn[pkey(e.home, e.away)];
  if (ek && ek.isLive) return 0;
  const played = (ek && ek.isPost) || !!e.score;
  if (!played) return 1;
  return 2;
}

interface DaySectionProps {
  label: string;
  entries: Match[];
  date?: string;
  isToday?: boolean;
  id?: string;
  todayISO: string;
  isCollapsed: boolean;
  onToggleCollapse: (date: string) => void;
}

function DaySection({
  label,
  entries,
  date,
  isToday,
  id,
  todayISO,
  isCollapsed,
  onToggleCollapse,
}: DaySectionProps) {
  const stage = entries[0] ? SL[entries[0].stage] : '';
  const collapsible = !!date && !isToday;

  const handleClick = () => {
    if (collapsible && date) {
      onToggleCollapse(date);
    }
  };

  return (
    <div style={{ marginBottom: '18px' }} id={id}>
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 5,
          background: 'rgba(10,15,30,0.94)',
          backdropFilter: 'blur(8px)',
          padding: '10px 4px 7px',
          marginBottom: '4px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          borderBottom: `1px solid ${isToday ? 'rgba(217,119,6,0.35)' : 'rgba(255,255,255,0.07)'}`,
          ...(collapsible && { cursor: 'pointer', userSelect: 'none' }),
        }}
        onClick={handleClick}
      >
        {collapsible && (
          <span
            style={{
              fontSize: '10px',
              color: '#6b7280',
              transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0)',
              display: 'inline-block',
              flexShrink: 0,
              transition: 'transform .15s',
            }}
          >
            ▼
          </span>
        )}
        <span
          style={{
            fontSize: '12px',
            fontWeight: 700,
            color: isToday ? '#fbbf24' : '#cbd5e1',
            letterSpacing: '0.04em',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {label}
        </span>
        <div style={{ flex: 1 }} />
        {isCollapsed && collapsible && (
          <span style={{ fontSize: '10px', color: '#6b7280', flexShrink: 0 }}>
            {entries.length} match{entries.length === 1 ? '' : 'es'}
          </span>
        )}
        {stage && (
          <span style={{ fontSize: '10px', color: '#4b5563', flexShrink: 0 }}>
            {stage}
          </span>
        )}
      </div>
      {!isCollapsed && (
        <div>
          {entries.map(e => (
            <MatchCard key={pkey(e.home, e.away)} entry={e} todayISO={todayISO} showSquads />
          ))}
        </div>
      )}
    </div>
  );
}

export function ScheduleView() {
  const [stageFilter, setStageFilter] = useState('all');
  const [teamFilter, setTeamFilter] = useState('');

  const data = useStore($data);
  const todayISO = useStore($today);
  const espn = useStore($espn);
  const showCompleted = useStore($showCompleted);
  const collapsedDays = useStore($collapsedDays);

  const all = data ? data.all : [];

  // Filter matches
  const lower = teamFilter.toLowerCase();
  const filtered = all.filter(e => {
    if (stageFilter !== 'all' && e.stage !== stageFilter) return false;
    if (lower && !e.home.toLowerCase().includes(lower) && !e.away.toLowerCase().includes(lower))
      return false;
    return e.date;
  });

  // Categorize by date
  const today: Match[] = [],
    upcoming: Match[] = [],
    completed: Match[] = [];
  filtered.forEach(e => {
    if (e.date === todayISO) today.push(e);
    else if (e.date > todayISO) upcoming.push(e);
    else completed.push(e);
  });

  // Sort today's matches
  today.sort((a, b) => {
    const pa = todayPriority(a, espn),
      pb = todayPriority(b, espn);
    if (pa !== pb) return pa - pb;
    const cmpAsc = timeToMin(a.time) - timeToMin(b.time);
    return pa === 2 ? -cmpAsc : cmpAsc;
  });

  // Sort upcoming matches
  upcoming.sort((a, b) =>
    a.date !== b.date ? a.date.localeCompare(b.date) : timeToMin(a.time) - timeToMin(b.time)
  );

  // Sort completed matches
  completed.sort((a, b) =>
    a.date !== b.date ? b.date.localeCompare(a.date) : timeToMin(b.time) - timeToMin(a.time)
  );

  const handleCollapsedToggle = (date: string) => {
    const m = { ...collapsedDays };
    if (m[date]) delete m[date];
    else m[date] = true;
    $collapsedDays.set(m);
  };

  return (
    <div>
      <FeedStatusPanel />

      {/* Search Input */}
      <input
        type="text"
        placeholder="Filter by team…"
        value={teamFilter}
        onInput={(e) => setTeamFilter((e.target as HTMLInputElement).value)}
        style={{
          width: '100%',
          padding: '7px 12px',
          borderRadius: '6px',
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: '#e2e8f0',
          fontSize: '14px',
          outline: 'none',
          display: 'block',
          marginBottom: '12px',
          boxSizing: 'border-box',
        }}
      />

      {/* Stage Filter Buttons */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
        {STAGE_OPTIONS.map(s => (
          <button
            key={s.id}
            onClick={() => setStageFilter(s.id)}
            style={{
              padding: '4px 10px',
              borderRadius: '4px',
              fontSize: '11px',
              background:
                stageFilter === s.id ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${stageFilter === s.id ? 'rgba(59,130,246,0.5)' : 'rgba(255,255,255,0.1)'}`,
              color: stageFilter === s.id ? '#93c5fd' : '#94a3b8',
              fontWeight: stageFilter === s.id ? '600' : '400',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {s.l}
          </button>
        ))}
      </div>

      {/* Match Lists */}
      <div style={{ paddingTop: 0 }}>
        {today.length > 0 && (
          <DaySection
            label={`★ TODAY · ${formatDate(todayISO)}`}
            entries={today}
            isToday
            id="today-anchor"
            todayISO={todayISO}
            isCollapsed={false}
            onToggleCollapse={handleCollapsedToggle}
          />
        )}

        {/* Upcoming Matches */}
        {(() => {
          const upcomingByDate: Record<string, Match[]> = {};
          upcoming.forEach(e => {
            (upcomingByDate[e.date] = upcomingByDate[e.date] || []).push(e);
          });
          return Object.keys(upcomingByDate)
            .sort()
            .map(date => (
              <DaySection
                key={date}
                label={formatDate(date)}
                entries={upcomingByDate[date]}
                date={date}
                todayISO={todayISO}
                isCollapsed={!!collapsedDays[date]}
                onToggleCollapse={handleCollapsedToggle}
              />
            ));
        })()}

        {/* Completed Matches */}
        {completed.length > 0 && (
          <div>
            {(() => {
              const completedByDate: Record<string, Match[]> = {};
              completed.forEach(e => {
                (completedByDate[e.date] = completedByDate[e.date] || []).push(e);
              });
              const completedDates = Object.keys(completedByDate).sort((a, b) =>
                b.localeCompare(a)
              );

              return (
                <>
                  <button
                    onClick={() => $showCompleted.set(!showCompleted)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      width: '100%',
                      padding: '10px 14px',
                      marginTop: '20px',
                      borderRadius: '8px',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      color: '#9ca3af',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    <span style={{ color: '#6b7280', marginRight: '2px' }}>
                      {showCompleted ? '▾' : '▸'}
                    </span>
                    <span>
                      {showCompleted ? 'Hide ' : 'View '}
                      {completed.length} completed match
                      {completed.length === 1 ? '' : 'es'}
                    </span>
                  </button>

                  {showCompleted && (
                    <div>
                      {completedDates.map(date => (
                        <DaySection
                          key={date}
                          label={formatDate(date)}
                          entries={completedByDate[date]}
                          date={date}
                          todayISO={todayISO}
                          isCollapsed={!!collapsedDays[date]}
                          onToggleCollapse={handleCollapsedToggle}
                        />
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {/* No Matches Found */}
        {today.length === 0 && upcoming.length === 0 && completed.length === 0 && (
          <div
            style={{
              padding: '40px 20px',
              textAlign: 'center',
              color: '#6b7280',
              fontSize: '13px',
            }}
          >
            No matches found{teamFilter ? ` for "${teamFilter}"` : ''}.
          </div>
        )}
      </div>
    </div>
  );
}
