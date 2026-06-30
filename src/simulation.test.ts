import { describe, expect, it } from 'vitest';
import type { Match } from './types';
import { pkey } from './constants';
import {
  rankToElo,
  eloExpectation,
  isClinchedTop2,
  wasAlreadyQualifiedBefore,
  computeFormDelta,
  combineSuspensionPenalty,
  suspensionBasePenalty,
  suspensionPositionMultiplier,
} from './simulation';

// Group A per constants.ts: Mexico, South Africa, South Korea, Czech Republic.
const GROUP = 'A';
const [T1, T2, T3, T4] = ['Mexico', 'South Africa', 'South Korea', 'Czech Republic'];

function mkMatch(
  home: string,
  away: string,
  score: string | null,
  date: string,
  opts: Partial<Match> = {},
): Match {
  return {
    home,
    away,
    score,
    ht: null,
    pen: null,
    goals1: [],
    goals2: [],
    date,
    time: '18:00',
    ground: null,
    stage: 'group',
    group: GROUP,
    round: null,
    num: null,
    ...opts,
  };
}

describe('rankToElo', () => {
  it('gives the top-ranked team the highest Elo', () => {
    expect(rankToElo(1)).toBe(2080);
  });
  it('decays linearly with rank', () => {
    expect(rankToElo(11)).toBe(2080 - 10 * 9);
  });
  it('falls back to 1500 for unranked teams', () => {
    expect(rankToElo(0)).toBe(1500);
    expect(rankToElo(250)).toBe(1500);
  });
});

describe('eloExpectation', () => {
  it('favors the higher-ranked team', () => {
    expect(eloExpectation('Argentina', 'Haiti')).toBeGreaterThan(0.5);
  });
  it('shifts in favor of whichever side gets a positive delta', () => {
    const base = eloExpectation('Argentina', 'Brazil');
    const homeBoosted = eloExpectation('Argentina', 'Brazil', 60, 0);
    const awayBoosted = eloExpectation('Argentina', 'Brazil', 0, 60);
    expect(homeBoosted).toBeGreaterThan(base);
    expect(awayBoosted).toBeLessThan(base);
  });
});

describe('isClinchedTop2', () => {
  it('is true once a team has an unassailable points lead', () => {
    const byKey: Record<string, Match> = {};
    // T1 beats T2 and T3 big — 6 pts, +6 GD, one game left (vs T4).
    byKey[pkey(T1, T2)] = mkMatch(T1, T2, '3-0', '2026-06-12');
    byKey[pkey(T1, T3)] = mkMatch(T1, T3, '3-0', '2026-06-16');
    // T2/T3/T4 still fighting over the last spot, can't catch T1's 6 pts even winning out.
    byKey[pkey(T2, T4)] = mkMatch(T2, T4, '1-1', '2026-06-12');
    expect(isClinchedTop2(T1, GROUP, byKey)).toBe(true);
  });

  it('is false while the table is still contested', () => {
    const byKey: Record<string, Match> = {};
    byKey[pkey(T1, T2)] = mkMatch(T1, T2, '1-0', '2026-06-12');
    expect(isClinchedTop2(T1, GROUP, byKey)).toBe(false);
  });
});

describe('wasAlreadyQualifiedBefore', () => {
  it('reconstructs the table as of a cutoff date', () => {
    const byKey: Record<string, Match> = {};
    byKey[pkey(T1, T2)] = mkMatch(T1, T2, '3-0', '2026-06-12');
    byKey[pkey(T1, T3)] = mkMatch(T1, T3, '3-0', '2026-06-16');
    byKey[pkey(T2, T4)] = mkMatch(T2, T4, '1-1', '2026-06-12');
    // Before the second T1 win, the lead isn't locked yet.
    expect(wasAlreadyQualifiedBefore(T1, GROUP, byKey, '2026-06-16')).toBe(false);
    // After it, T1 is unassailable for the still-unplayed third match.
    expect(wasAlreadyQualifiedBefore(T1, GROUP, byKey, '2026-06-20')).toBe(true);
  });
});

describe('computeFormDelta', () => {
  it('returns 0 for a team with no completed matches', () => {
    const out = computeFormDelta({});
    expect(out[T1] || 0).toBe(0);
  });

  it('gives a positive delta to a team on a recent winning streak', () => {
    const byKey: Record<string, Match> = {};
    byKey[pkey(T1, T2)] = mkMatch(T1, T2, '3-0', '2026-06-12');
    byKey[pkey(T1, T3)] = mkMatch(T1, T3, '2-0', '2026-06-16');
    byKey[pkey(T1, T4)] = mkMatch(T1, T4, '2-1', '2026-06-20');
    const out = computeFormDelta(byKey);
    expect(out[T1]).toBeGreaterThan(0);
  });

  it('gives a negative delta to a team on a recent losing streak', () => {
    const byKey: Record<string, Match> = {};
    byKey[pkey(T1, T2)] = mkMatch(T1, T2, '0-3', '2026-06-12');
    byKey[pkey(T1, T3)] = mkMatch(T1, T3, '0-2', '2026-06-16');
    byKey[pkey(T1, T4)] = mkMatch(T1, T4, '1-2', '2026-06-20');
    const out = computeFormDelta(byKey);
    expect(out[T1]).toBeLessThan(0);
  });

  it('discounts a dead-rubber loss after the team already clinched qualification', () => {
    const liveLossByKey: Record<string, Match> = {};
    liveLossByKey[pkey(T1, T4)] = mkMatch(T1, T4, '0-3', '2026-06-20');

    const deadRubberByKey: Record<string, Match> = {
      ...liveLossByKey,
      [pkey(T1, T2)]: mkMatch(T1, T2, '3-0', '2026-06-08'),
      [pkey(T1, T3)]: mkMatch(T1, T3, '3-0', '2026-06-14'),
    };
    // In the dead-rubber scenario T1 already clinched before the 0-3 loss, so
    // that result should be downweighted vs. the same loss with no cushion.
    const liveDelta = computeFormDelta(liveLossByKey)[T1];
    const deadRubberDelta = computeFormDelta(deadRubberByKey)[T1];
    expect(deadRubberDelta).toBeGreaterThan(liveDelta);
  });
});

describe('suspension penalty combiner', () => {
  it('weighs a top-ranked player heavier than an unranked one', () => {
    const star = combineSuspensionPenalty([{ rank: 1 }]);
    const squadPlayer = combineSuspensionPenalty([{ rank: null }]);
    expect(star).toBeLessThan(squadPlayer); // more negative
  });

  it('weighs a suspended goalkeeper heavier than an outfield player of the same rank', () => {
    const gk = combineSuspensionPenalty([{ rank: null, pos: 'GK' }]);
    const outfield = combineSuspensionPenalty([{ rank: null, pos: 'FWD' }]);
    expect(gk).toBeLessThan(outfield);
  });

  it('returns 0 for no suspended players', () => {
    expect(combineSuspensionPenalty([])).toBe(0);
  });

  it('caps the total penalty even with several suspended players', () => {
    const many = combineSuspensionPenalty([
      { rank: 1 },
      { rank: 2 },
      { rank: 3 },
      { rank: 4 },
      { rank: 5 },
    ]);
    expect(many).toBe(-60);
  });

  it('base penalty tiers by star rank', () => {
    expect(suspensionBasePenalty(1)).toBe(35);
    expect(suspensionBasePenalty(20)).toBe(20);
    expect(suspensionBasePenalty(null)).toBe(8);
  });

  it('GK multiplier is greater than the default', () => {
    expect(suspensionPositionMultiplier('GK')).toBeGreaterThan(suspensionPositionMultiplier('FWD'));
  });
});
