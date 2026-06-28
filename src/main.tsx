import './styles.css';
import { render } from 'preact';

const APP_VERSION = 'v0.13.0';
const BUILD_DATE = '2026-06-26';

import { loadData, loadSquads } from './data';
import { loadESPN } from './espn';
import { buildFeedStatus, buildScheduleView } from './ui/schedule';
import { buildGroupsView } from './ui/groups';
import { buildBracketView } from './ui/bracket';
import { buildTeamsView } from './ui/teams';
import { $data, $espn, $tab } from './state';
import { useStore } from './hooks/useStore';
import { LegacyView } from './ui/LegacyView';

// Side effects
loadData();
setInterval(loadData, 90000);
loadSquads();
loadESPN();
setInterval(loadESPN, 60000);

interface TabDef {
  id: string;
  l: string;
}

const TABS: TabDef[] = [
  { id: 'schedule', l: '📅 Schedule' },
  { id: 'groups', l: '🔡 Groups' },
  { id: 'bracket', l: '🏆 Bracket' },
  { id: 'teams', l: '⚽ Teams' },
];


function TodayButton() {
  const data = useStore($data);
  const espn = useStore($espn);
  const today = useStore($today);

  const todayN = (data ? data.all : []).filter(e => e.date === today).length;
  const liveN = Object.values(espn || {}).filter(e => e && e.isLive).length;

  const isLive = liveN > 0;
  const hasToday = todayN > 0;
  const shouldShow = isLive || hasToday;

  if (!shouldShow) return null;

  const bgColor = isLive ? 'rgba(239,68,68,0.18)' : 'rgba(217,119,6,0.2)';
  const borderColor = isLive ? 'rgba(239,68,68,0.6)' : 'rgba(217,119,6,0.55)';
  const textColor = isLive ? '#fca5a5' : '#fbbf24';

  return (
    <button
      style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 12px',
        borderRadius: '8px',
        fontSize: '12px',
        fontWeight: '600',
        background: bgColor,
        border: `1px solid ${borderColor}`,
        color: textColor,
        cursor: 'pointer',
      }}
      onClick={() => {
        $tab.set('schedule');
        setTimeout(() => {
          const liveCard = document.querySelector('[data-live="true"]');
          if (liveCard) {
            liveCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
          }
          const el = document.getElementById('today-anchor');
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 80);
      }}
    >
      {isLive && (
        <span
          style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            background: '#f87171',
            display: 'inline-block',
            animation: 'pulse 1s ease-in-out infinite',
          }}
        />
      )}
      <span style={{ fontWeight: 700, letterSpacing: '0.5px' }}>
        {isLive ? `${liveN} LIVE` : `★ ${todayN} Today`}
      </span>
      {isLive && todayN > liveN && (
        <span style={{ color: '#9ca3af', fontWeight: 400 }}>
          · {todayN} today
        </span>
      )}
    </button>
  );
}

interface TabBarProps {
  activeTab: string;
  onTabChange: (id: string) => void;
}

function TabBar({ activeTab, onTabChange }: TabBarProps) {
  return (
    <div style={{ display: 'flex', gap: '2px', overflowX: 'auto' }}>
      {TABS.map(t => (
        <button
          key={t.id}
          onClick={() => onTabChange(t.id)}
          style={{
            padding: '8px 12px',
            fontSize: '13px',
            fontWeight: '500',
            borderRadius: '8px 8px 0 0',
            whiteSpace: 'nowrap',
            background: activeTab === t.id ? 'rgba(255,255,255,0.07)' : 'transparent',
            borderBottom: activeTab === t.id ? '2px solid #3b82f6' : '2px solid transparent',
            color: activeTab === t.id ? '#e2e8f0' : '#6b7280',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          {t.l}
        </button>
      ))}
    </div>
  );
}

interface ContentAreaProps {
  tab: string;
  data: any;
  espn: Record<string, any>;
  sim: any;
}

function ContentArea({ tab, data, espn, sim }: ContentAreaProps) {
  const INNER_MAX: Record<string, string> = {
    bracket: '100%',
    schedule: '768px',
    groups: '768px',
    teams: '768px',
  };

  const viewMap: Record<string, { build: () => HTMLElement; deps: any[] }> = {
    schedule: { build: buildScheduleView, deps: [data, espn] },
    groups: { build: buildGroupsView, deps: [data, espn] },
    bracket: { build: buildBracketView, deps: [data, espn, sim] },
    teams: { build: buildTeamsView, deps: [data, espn] },
  };

  const view = viewMap[tab] || viewMap.schedule;

  return (
    <div
      style={{
        maxWidth: INNER_MAX[tab] || '768px',
        margin: '0 auto',
      }}
    >
      <LegacyView build={buildFeedStatus} deps={[data, espn]} />
      <LegacyView key={tab} build={view.build} deps={[...view.deps, tab]} />
    </div>
  );
}

function App() {
  const tab = useStore($tab);
  const data = useStore($data);
  const espn = useStore($espn);

  const handleTabChange = (newTab: string) => {
    $tab.set(newTab);
  };

  return (
    <div
      style={{
        background: 'linear-gradient(160deg,#0a0f1e 0%,#0f172a 60%,#0a1628 100%)',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          background: 'rgba(255,255,255,0.02)',
          padding: '16px 16px 0',
        }}
      >
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '10px',
            }}
          >
            <span style={{ fontSize: '28px' }}>⚽</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1
                style={{
                  fontSize: '18px',
                  fontWeight: '700',
                  color: '#fff',
                  lineHeight: '1.2',
                  margin: 0,
                }}
              >
                2026 FIFA World Cup
              </h1>
              <div style={{ fontSize: '11px', color: '#4b5563' }}>
                48 teams · 104 matches · Live via openfootball
              </div>
            </div>
            <TodayButton />
          </div>
          <TabBar activeTab={tab} onTabChange={handleTabChange} />
        </div>
      </div>

      <div style={{ flex: 1, maxWidth: '1400px', margin: '0 auto', padding: '16px', width: '100%' }}>
        <ContentArea tab={tab} data={data} espn={espn} sim={null} />
      </div>

      <div
        style={{
          padding: '16px',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          background: 'rgba(0,0,0,0.2)',
          textAlign: 'center',
          marginTop: '24px',
        }}
      >
        <div
          style={{
            maxWidth: '1400px',
            margin: '0 auto',
            fontSize: '10px',
            color: '#374151',
            fontFamily: 'monospace',
          }}
        >
          {APP_VERSION} · built {BUILD_DATE}
        </div>
      </div>
    </div>
  );
}

render(<App />, document.getElementById('root')!);
