import type { Match } from '../types';
import { div, span, btn, inp } from '../dom';
import { pkey, timeToMin } from '../constants';
import { $data, $today, $espn, $status, $espnStatus, $squads, $showCompleted, $collapsedDays } from '../state';
import { loadData, loadSquads } from '../data';
import { loadESPN } from '../espn';
import { matchCard } from './matchCard';

export function buildFeedStatus() {
  const st = $status.get();
  const espnSt = $espnStatus.get();
  const sq = $squads.get();
  const isESPNLive = espnSt === "live";

  const dot = div({ style: { width: '8px', height: '8px', borderRadius: '50%', background: st === 'done' ? '#4ade80' : st === 'error' ? '#f87171' : '#60a5fa', flexShrink: 0 } });
  if (st === 'loading') dot.className = 'spin';

  const ofText = span({ style: { color: st === 'done' ? '#4ade80' : st === 'error' ? '#f87171' : '#93c5fd' } },
    st === 'loading' ? 'Loading fixtures…' : st === 'done' ? 'openfootball · live' : 'Fixture source unavailable'
  );

  const sqText = sq.loaded
    ? span({ style: { color: '#6b7280', fontSize: '11px' } }, ' · ' + sq.count + ' squads')
    : sq.error
      ? span({ style: { color: '#f87171', fontSize: '11px' } }, ' · squad data unavailable')
      : span({ style: { color: '#60a5fa', fontSize: '11px' } }, ' · loading squads…');

  const espnBadge = isESPNLive ? span({
    style: { display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '4px', padding: '1px 6px', fontSize: '10px', fontWeight: '700', color: '#f87171', marginLeft: '6px' }
  },
    div({ style: { width: '5px', height: '5px', borderRadius: '50%', background: '#f87171', animation: 'pulse 1s ease-in-out infinite' } }),
    'ESPN LIVE'
  ) : null;

  const refreshBtn = btn({
    style: { marginLeft: 'auto', padding: '3px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#9ca3af', fontSize: '12px' },
    onclick: function () { loadData(); loadESPN(); loadSquads(); }
  }, '↻');

  return div({ style: { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '8px', marginBottom: '16px', fontSize: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' } },
    dot, ofText, sqText, ...(espnBadge ? [espnBadge] : []), refreshBtn);
}

export function buildScheduleView() {
  let sf = 'all', tf = '';
  const data = $data.get();
  const todayISO = $today.get();
  const all = data ? data.all : [];

  const SL: Record<string, string> = { group: "Group", r32: "R32", r16: "R16", qf: "QF", sf: "SF", "3rd": "3rd", final: "FINAL" };
  const SOPTS = [{ id: "all", l: "All" }, { id: "group", l: "Group" }, { id: "r32", l: "R32" }, { id: "r16", l: "R16" }, { id: "qf", l: "QF" }, { id: "sf", l: "SF" }, { id: "3rd", l: "3rd" }, { id: "final", l: "Final" }];

  const container = div({ style: { paddingTop: '0' } });

  function renderList() {
    container.innerHTML = '';
    const lower = tf.toLowerCase();

    const filtered = all.filter(e => {
      if (sf !== 'all' && e.stage !== sf) return false;
      if (lower && !e.home.toLowerCase().includes(lower) && !e.away.toLowerCase().includes(lower)) return false;
      return e.date;
    });

    const today: Match[] = [], upcoming: Match[] = [], completed: Match[] = [];
    filtered.forEach(e => {
      if (e.date === todayISO) today.push(e);
      else if (e.date > todayISO) upcoming.push(e);
      else completed.push(e);
    });

    function todayPriority(e: Match) {
      const ek = $espn.get()[pkey(e.home, e.away)];
      if (ek && ek.isLive) return 0;
      const played = (ek && ek.isPost) || !!e.score;
      if (!played) return 1;
      return 2;
    }
    today.sort((a, b) => {
      const pa = todayPriority(a), pb = todayPriority(b);
      if (pa !== pb) return pa - pb;
      const cmpAsc = timeToMin(a.time) - timeToMin(b.time);
      return pa === 2 ? -cmpAsc : cmpAsc;
    });
    upcoming.sort((a, b) => a.date !== b.date ? a.date.localeCompare(b.date) : timeToMin(a.time) - timeToMin(b.time));
    completed.sort((a, b) => a.date !== b.date ? b.date.localeCompare(a.date) : timeToMin(b.time) - timeToMin(a.time));

    function fmtDate(iso: string) {
      return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }

    function daySection(label: string, entries: Match[], opts: { date?: string; isToday?: boolean; id?: string } = {}) {
      const stage = SL[entries[0].stage];
      const collapsible = !!opts.date && !opts.isToday;
      const isCollapsed = collapsible && !!$collapsedDays.get()[opts.date!];

      const body = div({}, ...entries.map(e => matchCard(e, todayISO, true)!));
      if (isCollapsed) body.style.display = 'none';

      const chevron = collapsible ? span({
        style: {
          fontSize: '10px', color: '#6b7280', transition: 'transform .15s',
          transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0)',
          display: 'inline-block', flexShrink: 0
        }
      }, '▼') : null;

      const countTag = collapsible ? span({ style: { fontSize: '10px', color: '#6b7280', flexShrink: 0 } },
        entries.length + ' match' + (entries.length === 1 ? '' : 'es')
      ) : null;

      const header = div({
        style: Object.assign({
          position: 'sticky', top: '0', zIndex: 5,
          background: 'rgba(10,15,30,0.94)', backdropFilter: 'blur(8px)',
          padding: '10px 4px 7px', marginBottom: '4px',
          display: 'flex', alignItems: 'center', gap: '10px',
          borderBottom: '1px solid ' + (opts.isToday ? 'rgba(217,119,6,0.35)' : 'rgba(255,255,255,0.07)')
        }, collapsible ? { cursor: 'pointer', userSelect: 'none' } : {})
      },
        chevron,
        span({ style: { fontSize: '12px', fontWeight: '700', color: opts.isToday ? '#fbbf24' : '#cbd5e1', letterSpacing: '0.04em', whiteSpace: 'nowrap', flexShrink: 0 } }, label),
        div({ style: { flex: 1 } }),
        isCollapsed && countTag,
        stage && span({ style: { fontSize: '10px', color: '#4b5563', flexShrink: 0 } }, stage)
      );

      if (collapsible) {
        header.onclick = function () {
          const m = { ...$collapsedDays.get() };
          if (m[opts.date!]) delete m[opts.date!]; else m[opts.date!] = true;
          $collapsedDays.set(m);
          const nowCollapsed = !!m[opts.date!];
          body.style.display = nowCollapsed ? 'none' : 'block';
          if (chevron) chevron.style.transform = nowCollapsed ? 'rotate(-90deg)' : 'rotate(0)';
          if (countTag) countTag.style.display = nowCollapsed ? 'inline' : 'none';
        };
      }

      return div({ style: { marginBottom: '18px' }, id: opts.id || undefined }, header, body);
    }

    if (today.length) {
      container.appendChild(daySection('★ TODAY · ' + fmtDate(todayISO), today, { isToday: true, id: 'today-anchor' }));
    }

    const upcomingByDate: Record<string, Match[]> = {};
    upcoming.forEach(e => { (upcomingByDate[e.date] = upcomingByDate[e.date] || []).push(e); });
    Object.keys(upcomingByDate).sort().forEach(date => {
      container.appendChild(daySection(fmtDate(date), upcomingByDate[date], { date }));
    });

    if (completed.length) {
      const completedByDate: Record<string, Match[]> = {};
      completed.forEach(e => { (completedByDate[e.date] = completedByDate[e.date] || []).push(e); });
      const completedDates = Object.keys(completedByDate).sort((a, b) => b.localeCompare(a));

      const wrap = div({ style: { display: $showCompleted.get() ? 'block' : 'none', marginTop: '4px' } });
      completedDates.forEach(date => {
        wrap.appendChild(daySection(fmtDate(date), completedByDate[date], { date }));
      });

      const toggle = btn({
        style: {
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          width: '100%', padding: '10px 14px', marginTop: '20px',
          borderRadius: '8px',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          color: '#9ca3af', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit'
        }
      });
      function refreshToggle() {
        const exp = $showCompleted.get();
        toggle.innerHTML = '';
        toggle.appendChild(span({ style: { color: '#6b7280', marginRight: '2px' } }, exp ? '▾' : '▸'));
        toggle.appendChild(span({}, (exp ? 'Hide ' : 'View ') + completed.length + ' completed match' + (completed.length === 1 ? '' : 'es')));
      }
      refreshToggle();
      toggle.onclick = function () {
        $showCompleted.set(!$showCompleted.get());
        wrap.style.display = $showCompleted.get() ? 'block' : 'none';
        refreshToggle();
      };
      container.appendChild(toggle);
      container.appendChild(wrap);
    }

    if (!today.length && !upcoming.length && !completed.length) {
      container.appendChild(div({ style: { padding: '40px 20px', textAlign: 'center', color: '#6b7280', fontSize: '13px' } },
        'No matches found' + (tf ? ' for "' + tf + '"' : '') + '.'
      ));
    }
  }

  const searchEl = inp({
    type: 'text', placeholder: 'Filter by team…', value: '',
    oninput: function (e: Event) { tf = (e.target as HTMLInputElement).value; renderList(); },
    style: { width: '100%', padding: '7px 12px', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0', fontSize: '14px', outline: 'none', display: 'block', marginBottom: '12px' }
  });

  const filterBtns = div({ style: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' } },
    ...SOPTS.map(s => {
      const b = btn({
        style: { padding: '4px 10px', borderRadius: '4px', fontSize: '11px', background: sf === s.id ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.05)', border: '1px solid ' + (sf === s.id ? 'rgba(59,130,246,0.5)' : 'rgba(255,255,255,0.1)'), color: sf === s.id ? '#93c5fd' : '#94a3b8', fontWeight: sf === s.id ? '600' : '400' },
        onclick: function () {
          sf = s.id;
          filterBtns.querySelectorAll('button').forEach((b, i) => {
            const active = SOPTS[i].id === sf;
            (b as HTMLElement).style.background = active ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.05)';
            (b as HTMLElement).style.border = '1px solid ' + (active ? 'rgba(59,130,246,0.5)' : 'rgba(255,255,255,0.1)');
            (b as HTMLElement).style.color = active ? '#93c5fd' : '#94a3b8';
            (b as HTMLElement).style.fontWeight = active ? '600' : '400';
          });
          renderList();
        }
      }, s.l);
      return b;
    })
  );

  renderList();
  return div({}, searchEl, filterBtns, container);
}
