import type { Player } from '../types';
import { div, span } from '../dom';
import { LEAGUES, LC, getLC, getPlayerRank } from '../constants';
import { SQUADS, $squads } from '../state';

export function leagueBar(counts: Record<string, number>, total: number) {
  const bars = LEAGUES.map((l) => ({
    l,
    n: counts[l] || 0,
    pct: total ? ((counts[l] || 0) / total) * 100 : 0,
  })).filter((b) => b.n > 0);
  return div(
    { style: { marginBottom: '4px' } },
    div(
      {
        style: {
          display: 'flex',
          height: '7px',
          borderRadius: '4px',
          overflow: 'hidden',
          gap: '1px',
          marginBottom: '4px',
        },
      },
      ...bars.map((b) =>
        div({
          style: { width: b.pct + '%', background: LC[b.l], minWidth: '3px', flexShrink: 0 },
          title: b.l + ': ' + b.n,
        }),
      ),
    ),
    div(
      { style: { display: 'flex', flexWrap: 'wrap', gap: '4px 10px' } },
      ...bars.map((b) =>
        span(
          { style: { display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px' } },
          span({
            style: {
              width: '5px',
              height: '5px',
              borderRadius: '50%',
              background: LC[b.l],
              flexShrink: 0,
            },
          }),
          span({ style: { color: '#9ca3af' } }, b.l),
          span({ style: { color: '#d1d5db', fontFamily: 'monospace' } }, b.n),
        ),
      ),
    ),
  );
}

export function squadPanel(team: string) {
  const sq: Player[] | undefined = SQUADS[team];
  if (!sq || !sq.length) {
    if (!$squads.get().loaded)
      return span(
        { style: { fontSize: '11px', color: '#4b5563', fontStyle: 'italic' } },
        'Loading squad…',
      );
    return span(
      { style: { fontSize: '11px', color: '#4b5563', fontStyle: 'italic' } },
      'Squad data unavailable',
    );
  }
  const counts = getLC(sq);
  return div(
    {},
    div({ style: { marginBottom: '8px' } }, leagueBar(counts, sq.length)),
    ...LEAGUES.map((lg) => {
      const lp = sq.filter((p) => p.league === lg);
      if (!lp.length) return null;
      return div(
        { style: { marginBottom: '8px' } },
        div(
          { style: { display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px' } },
          div({
            style: {
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: LC[lg],
              flexShrink: 0,
            },
          }),
          span(
            {
              style: {
                fontSize: '10px',
                fontWeight: 600,
                color: LC[lg] === '#292524' ? '#6b7280' : LC[lg],
              },
            },
            lg + ' (' + lp.length + ')',
          ),
        ),
        div(
          { style: { display: 'flex', flexWrap: 'wrap' } },
          ...lp.map((p) => {
            const rank = getPlayerRank(p.name);
            const rankColor = rank
              ? rank <= 10
                ? '#fbbf24'
                : rank <= 30
                  ? '#60a5fa'
                  : '#9ca3af'
              : null;
            return span(
              {
                style: {
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  marginRight: '3px',
                  marginBottom: '3px',
                  background: LC[p.league] + '28',
                  color: '#cbd5e1',
                  border: '1px solid ' + LC[p.league] + '44',
                },
                title: p.club + (rank ? ' · Ranked #' + rank : ''),
              },
              rank &&
                span(
                  {
                    style: {
                      fontSize: '8px',
                      fontWeight: '700',
                      color: rankColor!,
                      background: rankColor! + '22',
                      padding: '1px 3px',
                      borderRadius: '3px',
                      fontFamily: 'monospace',
                      flexShrink: 0,
                    },
                  },
                  '#' + rank,
                ),
              span({ style: { opacity: '0.4', fontSize: '9px' } }, p.pos),
              p.name,
              span({ style: { opacity: '0.3', fontSize: '9px' } }, ' ' + p.club),
            );
          }),
        ),
      );
    }).filter(Boolean),
  );
}
