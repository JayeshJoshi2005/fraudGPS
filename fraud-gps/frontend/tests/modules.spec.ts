import { expect, test, type Page } from '@playwright/test';
import type { Core } from 'cytoscape';
import { closeSettings, openSettings } from './helpers/workspace';
type Canvas = HTMLElement & { _cyreg: { cy: Core } };
async function ready(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Trace Funds', exact: true })).toBeEnabled();
}
async function trace(page: Page) {
  await page.getByRole('button', { name: 'Trace Funds', exact: true }).click();
  await expect(page.locator('#network-canvas canvas').first()).toBeVisible();
}

test('case library filters and opens a focused investigation without losing source data', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await ready(page);
  await expect(page.getByRole('tab', { name: 'Cases', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  expect(await page.getByLabel('Complaint files').getByRole('button').count()).toBe(50);
  await expect(page.locator('.case-start-amount .animated-value')).toHaveAttribute(
    'data-complete',
    'true',
  );
  await page.screenshot({ path: '../../docs/screenshots/modular-cases.png' });
  const query = page.getByRole('textbox', { name: 'Filter case files' });
  await query.fill('BH-2026-0001');
  await expect(page.getByLabel('Complaint files').getByRole('button')).toHaveCount(1);
  await page.getByLabel('Filter cases by scam type').selectOption('OTP Fraud');
  await expect(page.getByText('No matching case files', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await page.getByRole('button', { name: 'Open case BH-2026-0005', exact: true }).click();
  await expect(page).toHaveURL(/#\/trace$/);
  await expect(page.getByLabel('SELECT COMPLAINT')).toHaveValue('BH-2026-0005');
  await openSettings(page);
  await page.getByLabel('Trace depth', { exact: true }).press('ArrowRight');
  await page.getByLabel('Forwarding window', { exact: true }).press('Home');
  const pending = page.waitForResponse((response) => response.url().endsWith('/api/trace'));
  await page.getByRole('button', { name: 'Trace with these options' }).click();
  const result = await (await pending).json();
  expect(result.options).toEqual({ max_depth: 5, min_amount: '100', forwarding_window_hours: 1 });
  await expect(page.getByRole('dialog', { name: 'Case settings' })).toHaveCount(0);
  await expect(page.locator('#network-canvas canvas').first()).toBeVisible();
  await page.getByRole('tab', { name: 'Cases', exact: true }).click();
  await expect(page.getByLabel('Selected complaint')).toContainText('Priya Yadav');
  await expect(page.getByLabel('Selected complaint')).toContainText('₹4,70,000');
  expect(errors).toEqual([]);
});

test('section history preserves the graph camera and reviewed actions', async ({ page }) => {
  await ready(page);
  await trace(page);
  const graph = page.locator('#network-canvas');
  const camera = await graph.evaluate((el) => {
    const cy = (el as Canvas)._cyreg.cy;
    cy.zoom(1.2);
    cy.pan({ x: 30, y: 40 });
    return { zoom: cy.zoom(), pan: cy.pan() };
  });
  await page.getByRole('tab', { name: 'Case Summary', exact: true }).click();
  const panel = page.getByRole('tabpanel', { name: 'Case Summary', exact: true });
  await expect(panel.getByLabel('Investigation narrative')).toBeVisible();
  await panel.getByRole('checkbox').first().check();
  await page.goBack();
  await expect(page.getByRole('tab', { name: 'Money Trail', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(graph.locator('canvas').first()).toBeVisible();
  expect(
    await graph.evaluate((el) => {
      const cy = (el as Canvas)._cyreg.cy;
      return { zoom: cy.zoom(), pan: cy.pan() };
    }),
  ).toEqual(camera);
  await page.goForward();
  await expect(panel.getByRole('checkbox').first()).toBeChecked();
  await page.getByRole('tab', { name: 'Fraud DNA', exact: true }).click();
  await page.getByRole('button', { name: 'Analyze Fraud DNA', exact: true }).click();
  await expect(page.getByLabel('Fraud signature', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'View connections on graph' }).click();
  await expect(graph.locator('canvas').first()).toBeVisible();
  expect(
    await graph.evaluate((el) => (el as Canvas)._cyreg.cy.edges('.dna-link').length),
  ).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Expand graph', exact: true }).click();
  await page.evaluate(() => {
    location.hash = '/summary';
  });
  await expect(page.getByRole('tab', { name: 'Case Summary', exact: true })).toBeVisible();
});

test('mobile navigation stays visible, graph stays tall, and settings trap then restore focus', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  await expect(page.getByRole('tab', { name: 'Case Summary', exact: true })).toBeInViewport();
  await trace(page);
  expect(
    await page.locator('#network-canvas').evaluate((el) => el.clientHeight),
  ).toBeGreaterThanOrEqual(500);
  await expect(page.getByRole('tab', { name: 'Cases', exact: true })).toBeInViewport();
  await page.screenshot({ path: '../../docs/screenshots/modular-mobile-trace.png' });
  await openSettings(page);
  await expect(page.getByRole('button', { name: 'Close case settings' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Done', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Close case settings' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Case controls', exact: true })).toBeFocused();
  await page.getByRole('tab', { name: 'Fraud DNA', exact: true }).click();
  await page.getByRole('button', { name: 'Analyze Fraud DNA', exact: true }).click();
  await expect(page.getByLabel('Fraud signature', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('tab', { name: 'Case Summary', exact: true }).click();
  await expect(page.getByLabel('Investigation narrative')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '../../docs/screenshots/modular-mobile-summary.png' });
});

test('deep links recover without a trace, and leaving the graph pauses its story', async ({
  page,
}) => {
  await page.goto('/#/dna');
  await expect(page.getByRole('button', { name: 'Open money trail' })).toBeVisible();
  await page.getByRole('tab', { name: 'Fraud DNA', exact: true }).press('Home');
  await expect(page.getByRole('tab', { name: 'Cases', exact: true })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Trace Funds', exact: true })).toBeEnabled();
  await page.clock.install({ time: '2026-10-25T00:00:00Z' });
  await trace(page);
  await page.clock.pauseAt('2026-10-25T01:00:00Z');
  await page.getByRole('button', { name: 'Play timeline', exact: true }).click();
  await page.clock.runFor(1001);
  const step = await page.locator('input[aria-label="Timeline event"]').inputValue();
  await page.getByRole('tab', { name: 'Fraud DNA', exact: true }).click();
  await page.clock.runFor(5001);
  expect(await page.locator('input[aria-label="Timeline event"]').inputValue()).toBe(step);
  await expect(page.locator('.toast-card')).toHaveCount(0);
  await page.getByRole('tab', { name: 'Money Trail', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Play timeline', exact: true })).toBeVisible();
  await closeSettings(page);
});
