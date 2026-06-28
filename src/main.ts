import './styles.css';

const APP_VERSION = 'v0.13.0';
const BUILD_DATE = '2026-06-26';

import { loadData, loadSquads } from './data';
import { loadESPN } from './espn';
import { buildFeedStatus, buildScheduleView } from './ui/schedule';
import { buildGroupsView } from './ui/groups';
import { buildBracketView } from './ui/bracket';
import { buildTeamsView } from './ui/teams';
import { $data, $espn, $espnStatus, $squads, $status, $tab, $today, $selectedTeam } from './state';
import { div, span, btn, ce } from './dom';
import { FLAG } from './constants';

// Side effects
loadData();
setInterval(loadData, 90000);
loadSquads();
loadESPN();
setInterval(loadESPN, 60000);

function buildApp() {
  const TABS = [{ id: "schedule", l: "📅 Schedule" }, { id: "groups", l: "🔡 Groups" }, { id: "bracket", l: "🏆 Bracket" }, { id: "teams", l: "⚽ Teams" }];
  const contentArea = div({ style: { maxWidth: '1400px', margin: '0 auto', padding: '16px' } });
  const tabButtons = div({ style: { display: 'flex', gap: '2px', overflowX: 'auto' } });

  const INNER_MAX: Record<string, string> = { bracket: '100%', schedule: '768px', groups: '768px', teams: '768px' };

  function renderContent() {
    contentArea.innerHTML = '';
    const t = $tab.get();
    const inner = div({ style: { maxWidth: INNER_MAX[t] || '768px', margin: '0 auto' } });
    inner.appendChild(buildFeedStatus());
    if (t === 'schedule') inner.appendChild(buildScheduleView());
    else if (t === 'groups') inner.appendChild(buildGroupsView());
    else if (t === 'bracket') inner.appendChild(buildBracketView());
    else if (t === 'teams') inner.appendChild(buildTeamsView());
    contentArea.appendChild(inner);
    tabButtons.querySelectorAll('button').forEach(b => {
      const active = (b as HTMLButtonElement).dataset.tab === $tab.get();
      (b as HTMLElement).style.borderBottom = active ? '2px solid #3b82f6' : '2px solid transparent';
      (b as HTMLElement).style.color = active ? '#e2e8f0' : '#6b7280';
      (b as HTMLElement).style.background = active ? 'rgba(255,255,255,0.07)' : 'transparent';
    });
  }

  TABS.forEach(t => {
    tabButtons.appendChild(btn({
      'data-tab': t.id,
      style: { padding: '8px 12px', fontSize: '13px', fontWeight: '500', borderRadius: '8px 8px 0 0', whiteSpace: 'nowrap', background: $tab.get() === t.id ? 'rgba(255,255,255,0.07)' : 'transparent', borderBottom: $tab.get() === t.id ? '2px solid #3b82f6' : '2px solid transparent', color: $tab.get() === t.id ? '#e2e8f0' : '#6b7280', border: 'none' },
      onclick: function () { $tab.set(t.id); renderContent(); }
    }, t.l));
  });

  $data.sub(renderContent);
  $espn.sub(renderContent);
  $squads.sub(renderContent);
  $tab.sub(renderContent);

  function refreshStatusBar() {
    const inner = contentArea.firstChild as HTMLElement | null;
    if (!inner) return;
    const fs = inner.firstChild;
    if (fs) inner.replaceChild(buildFeedStatus(), fs);
  }
  $status.sub(refreshStatusBar);
  $espnStatus.sub(refreshStatusBar);

  const todayBtn = btn({
    id: 'today-btn',
    style: { flexShrink: 0, display: 'none', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', background: 'rgba(217,119,6,0.2)', border: '1px solid rgba(217,119,6,0.55)', color: '#fbbf24', cursor: 'pointer' },
    onclick: function () {
      $tab.set('schedule');
      renderContent();
      setTimeout(() => {
        const liveCard = document.querySelector('[data-live="true"]');
        if (liveCard) { liveCard.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
        const el = document.getElementById('today-anchor');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
    }
  });
  function updateTodayBtn() {
    const todayN = ($data.get() ? $data.get()!.all : []).filter(e => e.date === $today.get()).length;
    const liveN = Object.values($espn.get() || {}).filter(e => e && e.isLive).length;
    todayBtn.textContent = '';
    if (liveN > 0) {
      todayBtn.style.background = 'rgba(239,68,68,0.18)';
      todayBtn.style.border = '1px solid rgba(239,68,68,0.6)';
      todayBtn.style.color = '#fca5a5';
      todayBtn.appendChild(span({ style: { width: '7px', height: '7px', borderRadius: '50%', background: '#f87171', display: 'inline-block', animation: 'pulse 1s ease-in-out infinite' } }));
      todayBtn.appendChild(span({ style: { fontWeight: 700, letterSpacing: '0.5px' } }, liveN + ' LIVE'));
      if (todayN > liveN) todayBtn.appendChild(span({ style: { color: '#9ca3af', fontWeight: 400 } }, '· ' + todayN + ' today'));
      todayBtn.style.display = 'flex';
    } else if (todayN > 0) {
      todayBtn.style.background = 'rgba(217,119,6,0.2)';
      todayBtn.style.border = '1px solid rgba(217,119,6,0.55)';
      todayBtn.style.color = '#fbbf24';
      todayBtn.appendChild(span({}, '★ ' + todayN + ' Today'));
      todayBtn.style.display = 'flex';
    } else {
      todayBtn.style.display = 'none';
    }
  }
  $data.sub(updateTodayBtn);
  $espn.sub(updateTodayBtn);

  renderContent();

  return div({ style: { background: 'linear-gradient(160deg,#0a0f1e 0%,#0f172a 60%,#0a1628 100%)', minHeight: '100vh', display: 'flex', flexDirection: 'column' } },
    div({ style: { borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)', padding: '16px 16px 0' } },
      div({ style: { maxWidth: '1400px', margin: '0 auto' } },
        div({ style: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' } },
          span({ style: { fontSize: '28px' } }, '⚽'),
          div({ style: { flex: 1, minWidth: 0 } },
            ce('h1', { style: { fontSize: '18px', fontWeight: '700', color: '#fff', lineHeight: '1.2' } }, '2026 FIFA World Cup'),
            div({ style: { fontSize: '11px', color: '#4b5563' } }, '48 teams · 104 matches · Live via openfootball')
          ),
          todayBtn
        ),
        tabButtons
      )
    ),
    div({ style: { flex: 1 } }, contentArea),
    div({ style: { padding: '16px', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.2)', textAlign: 'center', marginTop: '24px' } },
      div({ style: { maxWidth: '1400px', margin: '0 auto', fontSize: '10px', color: '#374151', fontFamily: 'monospace' } },
        APP_VERSION + ' · built ' + BUILD_DATE
      )
    )
  );
}

document.getElementById('root')!.appendChild(buildApp());
