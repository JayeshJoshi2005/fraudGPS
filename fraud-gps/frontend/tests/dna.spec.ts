import { openSettings, closeSettings } from './helpers/workspace';
import { expect, test, type Page } from '@playwright/test';
import type { Core } from 'cytoscape';
import type { DNAReport } from '../src/types/dna';
import type { TraceResult } from '../src/types';
import { formatCurrency } from '../src/utils/formatters';
import { percent } from '../src/utils/dna';
import { mkdir } from 'node:fs/promises';

type GraphElement = HTMLElement & { _cyreg: { cy: Core } };
async function ready(page: Page) {
  await page.goto('/#/trace');
  await expect(page.getByRole('button', { name: 'Trace Funds', exact: true })).toBeEnabled();
}
async function trace(page: Page) {
  await closeSettings(page);
  const response = page.waitForResponse(
    (r) => r.url().endsWith('/api/trace') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Trace Funds', exact: true }).click();
  const result = (await (await response).json()) as TraceResult;
  await expect(
    page.getByRole('button', { name: 'Find Linked Cases', exact: true, includeHidden: true }),
  ).toBeEnabled();
  await expect(page.locator('#network-canvas canvas').first()).toBeVisible();
  return result;
}
async function analyze(page: Page) {
  if (!(await page.getByRole('button', { name: 'Find Linked Cases', exact: true }).isVisible())) {
    await page.getByRole('tab', { name: 'Money Trail', exact: true }).click();
  }
  const response = page.waitForResponse((r) => /\/api\/dna\/BH-/.test(r.url()));
  await page.getByRole('button', { name: 'Find Linked Cases', exact: true }).click();
  const report = (await (await response).json()) as DNAReport;
  await expect(page.getByRole('tab', { name: 'Fraud DNA', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByLabel('Fraud signature', { exact: true })).toBeVisible();
  return report;
}

test('real DNA analysis, masked evidence and nonfinancial graph links', async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' || message.text().includes('is invalid'))
      errors.push(message.text());
  });
  await ready(page);
  await expect(page.getByRole('button', { name: 'Find Linked Cases', exact: true })).toBeDisabled();
  const trail = await trace(page);
  const report = await analyze(page);
  expect(report.options).toEqual(trail.options);
  expect(report.campaign!.case_count).toBe(30);
  const panel = page.getByRole('tabpanel', { name: 'Fraud DNA', exact: true });
  await expect(panel.getByLabel('Detected campaign family')).toContainText(
    formatCurrency(report.campaign!.total_loss),
  );
  await expect(panel).toContainText(`${report.entity_dna.unique_linked_complaints} other cases`);
  const campaigns = await (
    await request.get('http://127.0.0.1:8000/api/dna/campaigns?max_depth=4')
  ).json();
  expect(campaigns.items.map((item: { case_count: number }) => item.case_count)).toEqual([
    30, 16, 4,
  ]);
  const relations = await page.locator('#network-canvas').evaluate((el) =>
    (el as GraphElement)._cyreg.cy.edges('.dna-link').map((edge) => ({
      data: edge.data(),
      arrow: edge.style('target-arrow-shape'),
      color: edge.style('line-color'),
      dashed: edge.style('line-style'),
    })),
  );
  expect(relations.length).toBe(report.link_graph.edges.length);
  expect(relations.length).toBeGreaterThan(0);
  expect(
    relations.every(
      (edge) =>
        edge.data.kind === 'entity_link' &&
        edge.data.amount === undefined &&
        edge.data.timestamp === undefined &&
        edge.arrow === 'none' &&
        edge.dashed === 'dashed',
    ),
  ).toBe(true);
  expect(relations.every((edge) => edge.color === 'rgb(192,132,252)')).toBe(true);
  const transfers = await page
    .locator('#network-canvas')
    .evaluate((el) =>
      (el as GraphElement)._cyreg.cy.edges('[kind = "transaction"]').map((edge) => edge.id()),
    );
  expect(transfers.sort()).toEqual(trail.steps.map((step) => step.tx_id).sort());
  await mkdir('../../docs/screenshots', { recursive: true });
  await page.screenshot({ path: '../../docs/screenshots/modular-dna.png' });
  await panel.getByRole('button', { name: /Show all .* identifiers/ }).click();
  const eid = report.link_graph.edges[0].data.entity_ids[0];
  const match = panel.locator('.entity-match').filter({ hasText: eid });
  await match.locator('.entity-match-toggle').click();
  await expect(match.locator('.entity-evidence')).toBeVisible();
  const focused = await page
    .locator('#network-canvas')
    .evaluate((el) =>
      (el as GraphElement)._cyreg.cy.edges('.dna-focused').map((edge) => edge.data('entity_ids')),
    );
  expect(focused.length).toBeGreaterThan(0);
  expect(focused.every((ids) => ids.includes(eid))).toBe(true);
  await expect(match).toContainText(
    report.entity_dna.entity_matches.find((item) => item.entity_id === eid)!.masked_value,
  );
  await page.screenshot({ path: '../../docs/screenshots/modular-entity.png' });
  await match.locator('.entity-evidence > button').first().click();
  await expect(page.getByRole('tab', { name: 'Money Trail' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(
    page.getByRole('complementary', { name: 'Inspector' }).getByText('KYC', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Browse records' }).click();
  await page
    .getByLabel('Accessible graph records')
    .getByRole('button')
    .filter({ hasText: report.link_graph.edges[0].data.id })
    .click();
  const inspector = page.getByRole('complementary', { name: 'Inspector' });
  await expect(inspector).toContainText('SHARED IDENTIFIER LINK');
  await expect(inspector).not.toContainText('Trace attribution');
  await expect(inspector).not.toContainText('₹');
  await page.getByRole('tab', { name: 'Fraud DNA', exact: true }).click();
  await expect(page.getByLabel('Fraud signature', { exact: true })).toContainText(
    percent(report.signature_score),
  );
  expect(errors).toEqual([]);
});

test('similar-case navigation loads its real trace and clears old DNA', async ({ page }) => {
  await ready(page);
  await trace(page);
  const report = await analyze(page);
  const target = report.similar_cases[0].complaint_id;
  const response = page.waitForResponse(
    (r) => r.url().endsWith('/api/trace') && r.request().postDataJSON().complaint_id === target,
  );
  await page.getByRole('button', { name: `Investigate ${target}`, exact: true }).click();
  expect((await (await response).json()).complaint_id).toBe(target);
  await expect(page.getByLabel('SELECT COMPLAINT')).toHaveValue(target);
  await expect(page.getByLabel('Fraud DNA summary')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Find Linked Cases', exact: true })).toBeEnabled();
  const kinds = await page
    .locator('#network-canvas')
    .evaluate((el) => (el as GraphElement)._cyreg.cy.edges().map((edge) => edge.data('kind')));
  expect(kinds.every((kind) => kind === 'transaction')).toBe(true);
});

test('DNA failure retries while retaining the investigation', async ({ page }) => {
  await page.route('**/api/dna/BH-**', (route) => route.abort('failed'));
  await ready(page);
  await trace(page);
  await page.getByRole('button', { name: 'Find Linked Cases', exact: true }).click();
  const panel = page.getByRole('tabpanel', { name: 'Fraud DNA', exact: true });
  await expect(panel.getByRole('alert')).toBeVisible();
  await page.getByRole('tab', { name: 'Money Trail', exact: true }).click();
  await expect(page.locator('#network-canvas')).toBeVisible();
  await page.getByRole('tab', { name: 'Fraud DNA', exact: true }).click();
  await page.unroute('**/api/dna/BH-**');
  await panel.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByLabel('Fraud signature', { exact: true })).toBeVisible();
});

test('DNA rejects dataset changes and inconsistent scores before drawing links', async ({
  page,
}) => {
  let phase = 'version';
  await page.route('**/api/dna/BH-**', async (route) => {
    const response = await route.fetch();
    const report = await response.json();
    if (phase === 'version') report.dataset_version = 'changed';
    else report.signature_score = 0.01;
    await route.fulfill({ response, json: report });
  });
  await ready(page);
  await trace(page);
  await page.getByRole('button', { name: 'Find Linked Cases', exact: true }).click();
  const panel = page.getByRole('tabpanel', { name: 'Fraud DNA', exact: true });
  await expect(panel.getByRole('alert')).toContainText('dataset changed');
  phase = 'score';
  await panel.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(panel.getByRole('alert')).toContainText('does not match');
  await expect(page.getByLabel('Fraud DNA summary')).toHaveCount(0);
  await page.unroute('**/api/dna/BH-**');
  await panel.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByLabel('Fraud signature', { exact: true })).toBeVisible();
});

test('late DNA response cannot overwrite a different case', async ({ page }) => {
  let release!: () => void;
  let intercepted!: () => void;
  let finished!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const seen = new Promise<void>((resolve) => {
    intercepted = resolve;
  });
  const done = new Promise<void>((resolve) => {
    finished = resolve;
  });
  await page.route('**/api/dna/BH-2026-0001?**', async (route) => {
    const response = await route.fetch();
    intercepted();
    await gate;
    await route.fulfill({ response }).catch(() => {});
    finished();
  });
  await ready(page);
  await trace(page);
  await page.getByRole('button', { name: 'Find Linked Cases', exact: true }).click();
  await seen;
  await page.getByLabel('SELECT COMPLAINT').selectOption('BH-2026-0031');
  await trace(page);
  const report = await analyze(page);
  release();
  await done;
  expect(report.complaint_id).toBe('BH-2026-0031');
  await expect(page.getByLabel('Fraud DNA summary')).toContainText(report.campaign!.campaign_name);
  await expect(page.getByLabel('Fraud signature', { exact: true })).toContainText(
    percent(report.signature_score),
  );
});

test('identifier links can be hidden, filtered, and dimmed during replay', async ({ page }) => {
  await ready(page);
  await trace(page);
  const report = await analyze(page);
  await page.getByRole('tab', { name: 'Money Trail', exact: true }).click();
  await page.getByRole('button', { name: 'Hide DNA connections', exact: true }).click();
  let count = await page
    .locator('#network-canvas')
    .evaluate((el) => (el as GraphElement)._cyreg.cy.edges('.dna-link').length);
  expect(count).toBe(0);
  await page.getByRole('button', { name: 'Show DNA links', exact: true }).click();
  count = await page
    .locator('#network-canvas')
    .evaluate((el) => (el as GraphElement)._cyreg.cy.edges('.dna-link').length);
  expect(count).toBe(report.link_graph.edges.length);
  await openSettings(page);
  await page.getByLabel('Show only suspicious nodes').check();
  await closeSettings(page);
  const orphanCount = await page
    .locator('#network-canvas')
    .evaluate(
      (el) =>
        (el as GraphElement)._cyreg.cy
          .edges()
          .filter((edge) => edge.source().empty() || edge.target().empty()).length,
    );
  expect(orphanCount).toBe(0);
  await openSettings(page);
  await page.getByLabel('Show only suspicious nodes').uncheck();
  await closeSettings(page);
  await expect(page.getByRole('button', { name: 'Replay Trail', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Replay Trail', exact: true }).click();
  await page.getByRole('button', { name: 'Pause timeline', exact: true }).click();
  const links = await page.locator('#network-canvas').evaluate((el) =>
    (el as GraphElement)._cyreg.cy.edges('.dna-link').map((edge) => ({
      opacity: edge.style('opacity'),
      animated: edge.hasClass('trail') || edge.hasClass('story-current'),
    })),
  );
  expect(links.length).toBeGreaterThan(0);
  expect(links.every((edge) => edge.opacity === '0.15' && !edge.animated)).toBe(true);
  await expect(page.getByLabel('Fraud DNA summary')).toHaveCount(0);
  await page.getByRole('button', { name: 'Show full trail' }).click();
  await expect(page.getByLabel('Fraud DNA summary')).toBeVisible();
  await openSettings(page);
  await page.getByLabel('Trace depth', { exact: true }).press('Home');
  await closeSettings(page);
  await expect(page.locator('#network-canvas')).toHaveCount(0);
  await expect(page.getByLabel('Fraud DNA summary')).toHaveCount(0);
});

test('Lone Wolf reports same-family links without inventing external relations', async ({
  page,
}) => {
  await ready(page);
  await page.getByLabel('SELECT COMPLAINT').selectOption('BH-2026-0047');
  await trace(page);
  const report = await analyze(page);
  expect(report.entity_dna.unique_linked_complaints).toBe(3);
  expect(report.campaign!.case_count).toBe(4);
  expect(report.link_graph.edges).toHaveLength(0);
  await expect(page.getByLabel('Fraud DNA summary')).toContainText('Morning activity');
  await page.locator('.entity-match-toggle').first().click();
  await expect(
    page.getByText('Links reuse accounts already in this trail. No self-edge is drawn.', {
      exact: true,
    }),
  ).toBeVisible();
});

test('mobile DNA panel and keyboard tabs stay within the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  await trace(page);
  await analyze(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('tab', { name: 'Fraud DNA', exact: true }).press('ArrowLeft');
  await expect(page.getByRole('tab', { name: 'Money Trail', exact: true })).toBeFocused();
  await page.getByRole('tab', { name: 'Money Trail', exact: true }).press('End');
  await expect(page.getByRole('tab', { name: 'Case Summary', exact: true })).toBeFocused();
  await page.getByRole('tab', { name: 'Case Summary', exact: true }).press('ArrowLeft');
  await expect(page.getByRole('tab', { name: 'Fraud DNA', exact: true })).toBeFocused();
  await expect(page.getByLabel('Fraud signature', { exact: true })).toBeVisible();
  await page.screenshot({
    path: '../../docs/screenshots/modular-mobile-dna.png',
    fullPage: true,
  });
});
