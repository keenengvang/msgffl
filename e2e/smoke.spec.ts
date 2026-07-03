import { expect, test } from '@playwright/test';

/**
 * Smoke: every route renders real content against the live Sleeper API —
 * no error panel, no blank page. Wiring/provider/routing regressions fail here.
 * (Data-math correctness is covered by the vitest unit suite.)
 */

const ROUTES: Array<[path: string, marker: string | RegExp]> = [
  ['/', /SEASON SNAPSHOT/i],
  ['/standings?season=2024', /STANDINGS 2024/i],
  ['/matchups?season=2024&week=14', /FINAL · MARGIN/i],
  ['/teams?season=2024', /CLICK A TEAM/i],
  ['/draft?season=2024', /DRAFT GRADES/i],
  ['/players?season=2024', /TOP 150 SHOWN/i],
  ['/power?season=2024', /THE ALGORITHM HAS SPOKEN/i],
  ['/bracket?season=2024', /TITLE GAME/i],
  ['/history', /TROPHY WALL/i],
  ['/rules', /THE CONSTITUTION/i],
  ['/suggest', /TRANSMIT PROPOSAL/i],
];

for (const [path, marker] of ROUTES) {
  test(`renders ${path}`, async ({ page }) => {
    await page.goto(path);
    // shell is up
    await expect(page.getByText('M$G FANTASY FOOTBALL').first()).toBeVisible();
    // page-specific content arrived (live API), not a spinner or blank
    await expect(page.getByText(marker).first()).toBeVisible({ timeout: 30_000 });
    // no error boundary
    await expect(page.getByText(/Sleeper hung up on us/i)).toHaveCount(0);
  });
}

test('team detail opens from the teams grid', async ({ page }) => {
  await page.goto('/teams?season=2024');
  await page.getByText('CLICK A TEAM').waitFor();
  await page.locator('a[href*="/teams/"]').first().click();
  await expect(page.getByText(/CAREER LEDGER/i)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/RIVALRY LEDGER/i)).toBeVisible();
});
