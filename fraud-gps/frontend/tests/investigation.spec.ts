import { openSettings, closeSettings } from './helpers/workspace';
import { test, expect, type Page } from '@playwright/test';
import type { Core } from 'cytoscape';
import type { Complaint, TraceResult } from '../src/types';
import { mkdir } from 'node:fs/promises';

type GraphElement = HTMLElement & { _cyreg: { cy: Core } };
const api = 'http://127.0.0.1:8000/api';
async function ready(page: Page) {
  await page.goto('/#/trace');
  await expect(page.getByRole('button', { name: 'Trace Funds', exact: true })).toBeEnabled();
}
async function trace(page: Page) {
  await closeSettings(page);
  const response = page.waitForResponse(
    (r) => r.url() === `${api}/trace` && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Trace Funds', exact: true }).click();
  const result = (await (await response).json()) as TraceResult;
  await expect(page.locator('#network-canvas canvas').first()).toBeVisible();
  await expect(page.getByLabel('Trace overview')).toContainText(
    String(result.metrics.transaction_count),
  );
  return result;
}
async function clickNode(page: Page, id: string, button: 'left' | 'right' = 'left') {
  const graph = page.locator('#network-canvas');
  const point = await graph.evaluate(
    (element, id) => (element as GraphElement)._cyreg.cy.getElementById(id).renderedPosition(),
    id,
  );
  await graph.click({ position: point, button });
}

test('real API investigation, graph interactions, inspector and screenshots', async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  const complaints = (await (await request.get(`${api}/complaints`)).json()).items as Complaint[];
  await ready(page);
  await expect(page.getByRole('button', { name: /Generate Report/ })).toBeDisabled();
  await expect(page.getByRole('button', { name: /Find Linked Cases/ })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Play timeline' })).toBeDisabled();
  await mkdir('../../docs/screenshots', { recursive: true });
  await page.screenshot({ path: '../../docs/screenshots/modular-ready.png' });
  const result = await trace(page);
  expect(result.options.max_depth).toBe(4);
  const count = await page
    .locator('#network-canvas')
    .evaluate((el) => (el as GraphElement)._cyreg.cy.edges().length);
  expect(count).toBe(result.steps.length);
  await clickNode(page, complaints[0].suspect_account);
  const inspector = page.getByRole('complementary', { name: 'Inspector' });
  await expect(inspector.getByText('KYC', { exact: true })).toBeVisible();
  await expect(inspector.getByLabel('Risk assessment')).toBeVisible();
  await expect(inspector).toContainText(complaints[0].suspect_account);
  await page.mouse.move(20, 20);
  await page.screenshot({ path: '../../docs/screenshots/modular-inspector.png' });
  const zoom = await page
    .locator('#network-canvas')
    .evaluate((el) => (el as GraphElement)._cyreg.cy.zoom());
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  expect(
    await page.locator('#network-canvas').evaluate((el) => (el as GraphElement)._cyreg.cy.zoom()),
  ).toBeGreaterThan(zoom);
  await page.getByRole('button', { name: 'Fit graph' }).click();
  await clickNode(page, complaints[0].suspect_account, 'right');
  await page.locator('.graph-context').getByRole('button', { name: 'Expand neighborhood' }).click();
  await expect(page.getByText('Loading neighborhood…')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Clear expansion' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear expansion' }).click();
  await openSettings(page);
  await page.getByLabel('Graph layout').selectOption('Route');
  await closeSettings(page);
  await expect(page.getByText('Transaction route', { exact: true })).toBeVisible();
  await openSettings(page);
  await page.getByLabel('Graph layout').selectOption('Cluster');
  await closeSettings(page);
  await expect(page.getByText('Bank clusters', { exact: true })).toBeVisible();
  await openSettings(page);
  await page.getByLabel('Graph layout').selectOption('Graph');
  await closeSettings(page);
  await page.getByRole('button', { name: 'Browse records' }).click();
  const records = page.getByLabel('Accessible graph records');
  await records.getByRole('button').filter({ hasText: result.steps[0].tx_id }).click();
  await expect(inspector.getByText('TRANSFER DETAILS', { exact: true })).toBeVisible();
  await expect(inspector).toContainText(result.steps[0].channel);
  await expect(inspector).toContainText('IST');
  await openSettings(page);
  await page.getByLabel('Show only suspicious nodes').check();
  await closeSettings(page);
  const visible = await page
    .locator('#network-canvas')
    .evaluate((el) =>
      (el as GraphElement)._cyreg.cy
        .nodes()
        .map((n) => ({ id: n.id(), risk: n.data('risk_score') })),
    );
  expect(visible.every((n) => n.risk >= 0.5 || n.id === result.start_account)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(
    true,
  );
  expect(errors).toEqual([]);
});

test('search by case, victim name and stable account ID', async ({ page, request }) => {
  const complaints = (await (await request.get(`${api}/complaints`)).json()).items as Complaint[];
  await ready(page);
  const search = page
    .getByRole('searchbox', { name: 'Search complaints and accounts' })
    .or(page.getByRole('textbox', { name: 'Search complaints and accounts' }));
  await search.fill(complaints[1].victim_name);
  await page
    .locator('.search-results')
    .getByRole('button')
    .filter({ hasText: complaints[1].complaint_id })
    .click();
  await expect(page.getByLabel('SELECT COMPLAINT')).toHaveValue(complaints[1].complaint_id);
  await search.fill(complaints[1].suspect_account);
  await page.locator('.search-results').getByRole('button').click();
  await expect(
    page.getByRole('complementary', { name: 'Inspector' }).getByText('KYC', { exact: true }),
  ).toBeVisible();
  await expect(page.locator('#network-canvas')).toBeVisible();
});

test('depth and amount filters invalidate old results and support empty trails', async ({
  page,
  request,
}) => {
  const complaints = (await (await request.get(`${api}/complaints`)).json()).items as Complaint[];
  const small = complaints.find((c) => Number(c.amount_lost) < 100000)!;
  await ready(page);
  await trace(page);
  await openSettings(page);
  await page.getByLabel('Trace depth', { exact: true }).focus();
  await openSettings(page);
  await page.getByLabel('Trace depth', { exact: true }).press('Home');
  await closeSettings(page);
  await expect(page.locator('#network-canvas')).toHaveCount(0);
  const result = await trace(page);
  expect(result.options.max_depth).toBe(1);
  expect(result.steps).toHaveLength(1);
  await page.getByLabel('SELECT COMPLAINT').selectOption(small.complaint_id);
  await openSettings(page);
  await page.getByLabel('Minimum amount', { exact: true }).focus();
  await openSettings(page);
  await page.getByLabel('Minimum amount', { exact: true }).press('End');
  await closeSettings(page);
  await trace(page);
  await expect(page.getByText(/No transfers meet the selected minimum/)).toBeVisible();
});

test('backend unavailable and inspector failure can be retried', async ({ page, request }) => {
  await page.route('**/api/graph/full', (route) => route.abort('failed'));
  await page.goto('/#/trace');
  await expect(page.getByRole('alert')).toContainText('Backend connection failed');
  await page.unroute('**/api/graph/full');
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Trace Funds', exact: true })).toBeEnabled();
  const complaint = (await (await request.get(`${api}/complaints`)).json()).items[0] as Complaint;
  await page.route(`**/api/risk/${complaint.suspect_account}`, (route) => route.abort('failed'));
  await trace(page);
  await clickNode(page, complaint.suspect_account);
  await expect(
    page.getByRole('complementary', { name: 'Inspector' }).getByRole('alert'),
  ).toBeVisible();
  await page.unroute(`**/api/risk/${complaint.suspect_account}`);
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByLabel('Risk assessment')).toBeVisible();
});

test('switching cases discards a delayed old trace', async ({ page, request }) => {
  const complaints = (await (await request.get(`${api}/complaints`)).json()).items as Complaint[];
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
  await page.route('**/api/trace', async (route) => {
    if (route.request().postDataJSON().complaint_id !== complaints[0].complaint_id)
      return route.continue();
    const response = await route.fetch();
    intercepted();
    await gate;
    await route.fulfill({ response }).catch(() => {});
    finished();
  });
  await ready(page);
  await page.getByRole('button', { name: 'Trace Funds', exact: true }).click();
  await seen;
  await expect(page.getByLabel('SELECT COMPLAINT')).toBeEnabled({ timeout: 1500 });
  await page
    .getByLabel('SELECT COMPLAINT')
    .selectOption(complaints[1].complaint_id, { timeout: 1500 });
  const next = await trace(page);
  release();
  await done;
  expect(next.complaint_id).toBe(complaints[1].complaint_id);
  const nodes = await page
    .locator('#network-canvas')
    .evaluate((el) => (el as GraphElement)._cyreg.cy.nodes().map((n) => n.id()));
  expect(nodes).toContain(complaints[1].victim_account);
  expect(nodes).not.toContain(complaints[0].victim_account);
});

test('small screen remains usable without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  await trace(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '../../docs/screenshots/modular-mobile.png', fullPage: true });
});

test('delayed account evidence cannot replace a newer selection', async ({ page, request }) => {
  const complaint = (await (await request.get(`${api}/complaints`)).json()).items[0] as Complaint;
  let release!: () => void;
  let seen!: () => void;
  let finished!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const intercepted = new Promise<void>((resolve) => {
    seen = resolve;
  });
  const done = new Promise<void>((resolve) => {
    finished = resolve;
  });
  await page.route(`**/api/risk/${complaint.suspect_account}`, async (route) => {
    const response = await route.fetch();
    seen();
    await gate;
    await route.fulfill({ response }).catch(() => {});
    finished();
  });
  await ready(page);
  await trace(page);
  await clickNode(page, complaint.suspect_account);
  await intercepted;
  await clickNode(page, complaint.victim_account);
  const inspector = page.getByRole('complementary', { name: 'Inspector' });
  await expect(inspector.getByText('KYC', { exact: true })).toBeVisible();
  release();
  await done;
  await expect(inspector).toContainText(complaint.victim_name);
  await expect(inspector).toContainText(complaint.victim_account);
  await expect(inspector).not.toContainText(complaint.suspect_account);
});

test('trace and neighborhood failures retry the intended operation', async ({ page, request }) => {
  const complaint = (await (await request.get(`${api}/complaints`)).json()).items[0] as Complaint;
  await ready(page);
  await page.route('**/api/trace', (route) => route.abort('failed'));
  await page.getByRole('button', { name: 'Trace Funds', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.unroute('**/api/trace');
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.locator('#network-canvas canvas').first()).toBeVisible();
  await page.route('**/api/graph/subgraph/**', (route) => route.abort('failed'));
  await clickNode(page, complaint.suspect_account, 'right');
  await page.locator('.graph-context').getByRole('button', { name: 'Expand neighborhood' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.unroute('**/api/graph/subgraph/**');
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Clear expansion' })).toBeVisible();
});

test('mixed dataset evidence is rejected and workspace can reload', async ({ page, request }) => {
  const complaint = (await (await request.get(`${api}/complaints`)).json()).items[0] as Complaint;
  await page.route(`**/api/risk/${complaint.suspect_account}`, async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      json: { ...(await response.json()), dataset_version: 'changed' },
    });
  });
  await ready(page);
  await trace(page);
  await clickNode(page, complaint.suspect_account);
  await expect(page.getByRole('alert')).toContainText('dataset changed');
  await page.unroute(`**/api/risk/${complaint.suspect_account}`);
  await page.getByRole('button', { name: 'Reload workspace' }).click();
  await expect(page.getByRole('button', { name: 'Trace Funds', exact: true })).toBeEnabled();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.locator('#network-canvas')).toHaveCount(0);
});
