import { test, expect, type Page } from '@playwright/test';

async function openBracket(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: '🏆 Bracket' }).click();
  await expect(page.getByRole('button', { name: 'Full Bracket', exact: false })).toBeVisible();
}

test('app loads and tabs switch without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/');
  await expect(page.getByRole('heading', { name: '2026 FIFA World Cup' })).toBeVisible();

  for (const tab of ['🔡 Groups', '🏆 Bracket', '⚽ Teams', '📅 Schedule']) {
    await page.getByRole('button', { name: tab }).click();
  }

  expect(errors).toEqual([]);
});

test('bracket view renders all rounds with no thrown errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await openBracket(page);
  await expect(page.getByText('R32', { exact: true }).first()).toBeVisible();
  // Fixed bracket tree: 16 R32 + 8 R16 + 4 QF + 2 SF + 1 third-place + 1 final.
  await expect(page.locator('[data-testid="bracket-slot"]')).toHaveCount(32, { timeout: 15_000 });

  expect(errors).toEqual([]);
});

test('a row with a visible score never displays an unresolved team (live/today match regression)', async ({ page }) => {
  await openBracket(page);

  // A scoreline only renders once entry/ESPN data identifies the real teams
  // (see PBSlot in BracketView.tsx); a row showing a score but flagged
  // "unknown" would mean the team name fell back to a probabilistic TBD slot
  // despite a result already being known — exactly the live-match regression.
  const scoredUnresolvedRows = page.locator(
    '[data-testid="bracket-team-row"][data-has-score="true"][data-confidence="unknown"]'
  );
  await expect(scoredUnresolvedRows).toHaveCount(0);
});

test('knockout rounds beyond R32 are populated once any R32 match is decided', async ({ page }) => {
  await openBracket(page);

  const lockedOrPredictedR32 = page.locator(
    '[data-testid="bracket-slot"] [data-testid="bracket-team-row"][data-confidence="confirmed"], ' +
    '[data-testid="bracket-slot"] [data-testid="bracket-team-row"][data-confidence="locked"]'
  );
  const anyR32Decided = (await lockedOrPredictedR32.count()) > 0;
  test.skip(!anyR32Decided, 'no R32 result available yet in current tournament data');

  // R16 slots are match numbers 89-96. If any R32 result exists, propagation
  // should have populated at least one downstream slot with real or candidate
  // data instead of a flat "TBD" double-unknown row.
  const r16Nums = [89, 90, 91, 92, 93, 94, 95, 96];
  const downstreamSlots = page.locator(r16Nums.map(n => `[data-testid="bracket-slot"][data-match-num="${n}"]`).join(', '));
  const resolvedRows = downstreamSlots.locator('[data-testid="bracket-team-row"]:not([data-confidence="unknown"])');
  await expect(resolvedRows.first()).toBeVisible({ timeout: 15_000 });
});
