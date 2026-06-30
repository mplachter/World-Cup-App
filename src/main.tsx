import './styles.css';
import { render } from 'preact';
import Router, { Route, useRouter } from 'preact-router';
import { useState, useEffect } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { navigate, hashHistory } from './router';

const APP_VERSION = 'v0.14.0';
const BUILD_DATE = '2026-06-28';

import { loadData, loadSquads } from './data';
import { loadESPN } from './espn';
import { ScheduleView } from './ui/ScheduleView';
import { GroupsView } from './ui/GroupsView';
import { TeamsView, TeamDetailPage } from './ui/TeamsView';
import { BracketView } from './ui/BracketView';
import { CatalogView } from './ui/CatalogView';
import { $data, $espn, $today } from './state';
import { useStore } from './hooks/useStore';

// Side effects
loadData();
setInterval(loadData, 90000);
loadSquads();
loadESPN();
setInterval(loadESPN, 60000);

const TABS = [
  { id: 'schedule', path: '/', l: '📅 Schedule' },
  { id: 'groups', path: '/groups', l: '🔡 Groups' },
  { id: 'bracket', path: '/bracket', l: '🏆 Bracket' },
  { id: 'teams', path: '/teams', l: '⚽ Teams' },
];

function TodayButton() {
  const data = useStore($data);
  const espn = useStore($espn);
  const today = useStore($today);

  const todayN = (data ? data.all : []).filter((e) => e.date === today).length;
  const liveN = Object.values(espn || {}).filter((e) => e && e.isLive).length;

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
        navigate('/');
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
        <span style={{ color: '#9ca3af', fontWeight: 400 }}>· {todayN} today</span>
      )}
    </button>
  );
}

function TabBar() {
  const [routerState] = useRouter();
  const currentPath = routerState?.url ?? hashHistory.location.pathname;

  function isActive(tabPath: string, tabId: string) {
    if (tabPath === '/') return currentPath === '/';
    // Teams tab is active for both /teams and /teams/:team
    if (tabId === 'teams') return currentPath.startsWith('/teams');
    return currentPath.startsWith(tabPath);
  }

  return (
    <div style={{ display: 'flex', gap: '2px', overflowX: 'auto' }}>
      {TABS.map((t) => {
        const active = isActive(t.path, t.id);
        return (
          <button
            key={t.id}
            onClick={() => navigate(t.path)}
            style={{
              padding: '8px 12px',
              fontSize: '13px',
              fontWeight: '500',
              borderRadius: '8px 8px 0 0',
              whiteSpace: 'nowrap',
              background: active ? 'rgba(255,255,255,0.07)' : 'transparent',
              borderBottom: active ? '2px solid #3b82f6' : '2px solid transparent',
              color: active ? '#e2e8f0' : '#6b7280',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {t.l}
          </button>
        );
      })}
    </div>
  );
}

function useHashPath() {
  const [path, setPath] = useState(() => window.location.hash.replace(/^#/, '') || '/');
  useEffect(() => {
    const h = () => setPath(window.location.hash.replace(/^#/, '') || '/');
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);
  return path;
}

function App() {
  const hashPath = useHashPath();
  const innerMax = hashPath.startsWith('/bracket') ? '100%' : '768px';

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
          <TabBar />
        </div>
      </div>

      <div
        style={{ flex: 1, maxWidth: '1400px', margin: '0 auto', padding: '16px', width: '100%' }}
      >
        <div style={{ maxWidth: innerMax, margin: '0 auto' }}>
          <Router history={hashHistory}>
            <Route path="/" component={ScheduleView} />
            <Route path="/groups" component={GroupsView} />
            <Route path="/bracket" component={BracketView} />
            <Route path="/teams" component={TeamsView} />
            <Route path="/teams/:team" component={TeamDetailPage} />
            <Route default component={ScheduleView} />
          </Router>
        </div>
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

const isDevCatalog = import.meta.env.DEV && window.location.search.includes('catalog');
render(isDevCatalog ? <CatalogView /> : <App />, document.getElementById('root')!);
