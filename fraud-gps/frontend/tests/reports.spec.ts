import { openSettings, closeSettings } from './helpers/workspace';
import { expect, test, type Page } from '@playwright/test';
import type { Core } from 'cytoscape';
import type { TraceResult, TimelineEvent, RiskResult } from '../src/types';
import type { CaseSummary } from '../src/types/reports';
import { mkdir, readFile } from 'node:fs/promises';
type GraphElement = HTMLElement & { _cyreg: { cy: Core } };
const api = 'http://127.0.0.1:8000/api';
async function ready(page: Page) {
  await page.goto('/#/trace');
  await expect(page.getByRole('button', { name: 'Trace Funds', exact: true })).toBeEnabled();
}
async function trace(page: Page) {
  await closeSettings(page);
  const result = page.waitForResponse(
    (r) => r.url() === `${api}/trace` && r.request().method() === 'POST',
  );
  const summary = page.waitForResponse((r) => /\/api\/report\/BH-.*\/summary/.test(r.url()));
  await page.getByRole('button', { name: 'Trace Funds', exact: true }).click();
  const data = (await (await result).json()) as TraceResult;
  const note = (await (await summary).json()) as CaseSummary;
  await expect(page.locator('#network-canvas canvas').first()).toBeVisible();
  return { data, note };
}
async function openSummary(page: Page) {
  await page.getByRole('tab', { name: 'Case Summary', exact: true }).click();
  return page.getByRole('tabpanel', { name: 'Case Summary', exact: true });
}
async function seek(page: Page, step: number) {
  const slider = page.getByRole('slider', { name: 'Timeline event', exact: true });
  await slider.evaluate((element, value) => {
    const input = element as HTMLInputElement;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
      input,
      String(value),
    );
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, step);
  await expect(slider).toHaveValue(String(step));
  await page.clock.runFor(32);
}

test('real summary, persistent review checklist, DNA, and downloadable PDF share trace options', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await ready(page);
  await expect(page.getByRole('button', { name: 'Generate Report', exact: true })).toBeDisabled();
  await openSettings(page);
  await page.getByLabel('Trace depth', { exact: true }).press('ArrowRight');
  await closeSettings(page);
  const { data, note } = await trace(page);
  expect(note.trace.options).toEqual(data.options);
  const dna = page.waitForResponse((r) => /\/api\/dna\/BH-/.test(r.url()));
  await page.getByRole('button', { name: 'Find Linked Cases', exact: true }).click();
  expect((await (await dna).json()).signature_score).toBe(note.dna.signature_score);
  const panel = await openSummary(page);
  await expect(panel.getByLabel('Investigation narrative')).toHaveText(data.summary);
  const boxes = panel.getByRole('checkbox');
  expect(await boxes.count()).toBe(note.recommendations.length);
  await boxes.first().check();
  await expect(panel).toContainText('1 reviewed');
  await page.getByRole('tab', { name: 'Money Trail', exact: true }).click();
  await page.getByRole('tab', { name: 'Case Summary', exact: true }).click();
  await expect(boxes.first()).toBeChecked();
  await mkdir('../../docs/screenshots', { recursive: true });
  await page.screenshot({ path: '../../docs/screenshots/modular-summary.png' });
  const request = page.waitForResponse(
    (r) => r.url() === `${api}/report/${data.complaint_id}` && r.request().method() === 'POST',
  );
  const received = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Generate Report', exact: true }).click();
  const response = await request;
  expect(response.request().postDataJSON()).toEqual({
    ...data.options,
    expected_dataset_version: data.dataset_version,
  });
  const download = await received;
  expect(download.suggestedFilename()).toBe(`FraudGPS-${data.complaint_id}-Investigation.pdf`);
  await mkdir('../../docs/reports', { recursive: true });
  const path = `../../docs/reports/modular-${download.suggestedFilename()}`;
  await download.saveAs(path);
  expect((await readFile(path)).subarray(0, 5).toString()).toBe('%PDF-');
  await expect(page.getByText('Report downloaded', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reset reviewed actions' }).click();
  await expect(boxes.first()).not.toBeChecked();
  expect(errors).toEqual([]);
});

test('report failures retry and object URLs are released after successful delivery', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = URL.revokeObjectURL.bind(URL);
    (window as unknown as { releasedUrls: string[] }).releasedUrls = [];
    URL.revokeObjectURL = (url) => {
      (window as unknown as { releasedUrls: string[] }).releasedUrls.push(url);
      original(url);
    };
  });
  await ready(page);
  await trace(page);
  await page.route('**/api/report/BH-2026-0001', (route) =>
    route.fulfill({
      status: 503,
      json: { error: { message: 'The report renderer is temporarily unavailable.' } },
    }),
  );
  await page.getByRole('button', { name: 'Generate Report', exact: true }).click();
  await expect(page.locator('.report-download-error')).toContainText('temporarily unavailable');
  await expect(page.getByText('Report download failed', { exact: true })).toBeVisible();
  await page.unroute('**/api/report/BH-2026-0001');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Retry report', exact: true }).click();
  await download;
  await expect(page.getByText('Report downloaded', { exact: true })).toBeVisible();
  await expect(page.locator('.report-download-error')).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { releasedUrls: string[] }).releasedUrls.length),
    )
    .toBeGreaterThan(0);
});

test('report downloads reject incorrect content and mismatched dataset headers', async ({
  page,
}) => {
  await ready(page);
  await trace(page);
  let failure: 'content' | 'version' = 'content';
  let downloads = 0;
  page.on('download', () => downloads++);
  await page.route('**/api/report/BH-2026-0001', async (route) => {
    const response = await route.fetch();
    const headers = response.headers();
    delete headers['content-length'];
    if (failure === 'content')
      await route.fulfill({
        response,
        headers: { ...headers, 'content-type': 'text/html' },
        body: '<html>Not a PDF</html>',
      });
    else
      await route.fulfill({ response, headers: { ...headers, 'x-dataset-version': 'old-data' } });
  });
  await page.getByRole('button', { name: 'Generate Report', exact: true }).click();
  await expect(page.locator('.report-download-error')).toContainText('valid PDF');
  expect(downloads).toBe(0);
  failure = 'version';
  await page.getByRole('button', { name: 'Retry report', exact: true }).click();
  await expect(page.locator('.report-download-error')).toContainText('dataset changed');
  expect(downloads).toBe(0);
});

test('summary failures retry and corrupt evidence stays out of the checklist', async ({ page }) => {
  await page.route('**/api/report/*/summary?*', (route) => route.abort('failed'));
  await ready(page);
  await page.getByRole('button', { name: 'Trace Funds', exact: true }).click();
  await expect(page.locator('#network-canvas canvas').first()).toBeVisible();
  const panel = await openSummary(page);
  await expect(panel.getByRole('alert')).toBeVisible();
  await page.unroute('**/api/report/*/summary?*');
  await panel.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(panel.getByLabel('Investigation narrative')).toBeVisible();
  await page.getByRole('tab', { name: 'Money Trail', exact: true }).click();
  for (const kind of ['version', 'trace', 'action']) {
    await page.route('**/api/report/*/summary?*', async (route) => {
      const response = await route.fetch();
      const note = await response.json();
      if (kind === 'version') note.dataset_version = 'old';
      else if (kind === 'trace') note.trace.steps[0].amount = '0.01';
      else note.recommendations[0].account_ids = ['ACC-999999'];
      await route.fulfill({ response, json: note });
    });
    await trace(page);
    await openSummary(page);
    await expect(panel.getByRole('alert')).toContainText(
      kind === 'version' ? 'dataset changed' : 'does not match this trace',
    );
    await expect(panel.getByRole('checkbox')).toHaveCount(0);
    await page.getByRole('tab', { name: 'Money Trail', exact: true }).click();
    await page.unroute('**/api/report/*/summary?*');
  }
});

test('a delayed old summary cannot replace a new case and reviews reset with trace options', async ({
  page,
}) => {
  let release!: () => void;
  let seen!: () => void;
  let done!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const intercepted = new Promise<void>((resolve) => (seen = resolve));
  const finished = new Promise<void>((resolve) => (done = resolve));
  await page.route('**/api/report/BH-2026-0001/summary?*', async (route) => {
    const response = await route.fetch();
    seen();
    await gate;
    await route.fulfill({ response }).catch(() => {});
    done();
  });
  try {
    await ready(page);
    await page.getByRole('button', { name: 'Trace Funds', exact: true }).click();
    await intercepted;
    await page.getByLabel('SELECT COMPLAINT').selectOption('BH-2026-0031');
    const { data } = await trace(page);
    release();
    await finished;
    const panel = await openSummary(page);
    await expect(panel.locator('.summary-case-id')).toContainText('BH-2026-0031');
    await expect(panel.getByLabel('Investigation narrative')).toHaveText(data.summary);
    const boxes = panel.getByRole('checkbox');
    await boxes.first().check();
    await page.getByRole('tab', { name: 'Money Trail', exact: true }).click();
    await openSettings(page);
    await page.getByLabel('Trace depth', { exact: true }).press('Home');
    await closeSettings(page);
    await trace(page);
    await openSummary(page);
    await expect(panel).toContainText('0 reviewed');
    expect(
      await boxes.evaluateAll((elements) => elements.some((e) => (e as HTMLInputElement).checked)),
    ).toBe(false);
  } finally {
    release();
  }
});

test('changing case cancels an in-flight report before it can download', async ({ page }) => {
  await ready(page);
  await trace(page);
  let release!: () => void;
  let seen!: () => void;
  let done!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const intercepted = new Promise<void>((resolve) => (seen = resolve));
  const finished = new Promise<void>((resolve) => (done = resolve));
  let downloads = 0;
  page.on('download', () => downloads++);
  await page.route('**/api/report/BH-2026-0001', async (route) => {
    const response = await route.fetch();
    seen();
    await gate;
    await route.fulfill({ response }).catch(() => {});
    done();
  });
  try {
    await page.getByRole('button', { name: 'Generate Report', exact: true }).click();
    await intercepted;
    await expect(page.locator('.report-button-label')).toContainText('Generating forensic report');
    const canceled = page.waitForEvent(
      'requestfailed',
      (r) => r.url() === `${api}/report/BH-2026-0001`,
    );
    await page.getByLabel('SELECT COMPLAINT').selectOption('BH-2026-0031');
    await canceled;
    await trace(page);
    release();
    await finished;
    expect(downloads).toBe(0);
    await expect(page.getByText('Report downloaded', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Generate Report', exact: true })).toBeEnabled();
  } finally {
    release();
  }
});

test('mobile summary, module navigation and report download preserve the tall graph', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  await trace(page);
  const panel = await openSummary(page);
  await expect(panel.getByLabel('Investigation narrative')).toBeVisible();
  await page.getByRole('tab', { name: 'Money Trail', exact: true }).click();
  await page.getByRole('tab', { name: 'Money Trail', exact: true }).press('End');
  await expect(page.getByRole('tab', { name: 'Case Summary', exact: true })).toBeFocused();
  await expect(panel).toBeVisible();
  const download = page.waitForEvent('download');
  await panel.getByRole('button', { name: 'Download investigation PDF', exact: true }).click();
  await (await download).saveAs(testInfo.outputPath('mobile-report.pdf'));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: '../../docs/screenshots/modular-mobile-summary.png',
    fullPage: true,
  });
  await page.getByRole('tab', { name: 'Money Trail', exact: true }).click();
  expect(await page.locator('#network-canvas').evaluate((el) => el.clientHeight)).toBeGreaterThan(
    500,
  );
});

test('an empty trail still has a truthful summary and downloadable report', async ({
  page,
  request,
}) => {
  const cases = (await (await request.get(`${api}/complaints`)).json()).items as {
    complaint_id: string;
    amount_lost: string;
  }[];
  await ready(page);
  await page
    .getByLabel('SELECT COMPLAINT')
    .selectOption(cases.find((c) => Number(c.amount_lost) < 100000)!.complaint_id);
  await openSettings(page);
  await page.getByLabel('Minimum amount', { exact: true }).press('End');
  await closeSettings(page);
  const { data } = await trace(page);
  expect(data.steps).toHaveLength(0);
  const panel = await openSummary(page);
  await expect(panel.getByLabel('Investigation narrative')).toContainText('No transfers meet');
  await expect(panel.getByRole('checkbox')).toHaveCount(0);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Generate Report', exact: true }).click();
  expect((await download).suggestedFilename()).toContain(data.complaint_id!);
});

test('global alerts rank measured risks and investigate an account outside the current trail', async ({
  page,
}) => {
  await ready(page);
  const { data } = await trace(page);
  const seen = page.waitForResponse((r) => r.url().includes('/api/risk/top'));
  await page.getByRole('button', { name: 'High-risk alerts' }).click();
  const risks = (await (await seen).json()) as RiskResult[];
  const panel = page.getByRole('dialog', { name: 'High-risk accounts' });
  await expect(panel.locator('.account-alert')).toHaveCount(
    risks.filter((r) => r.total_score >= 0.5).length,
  );
  const ids = await panel
    .locator('.account-alert')
    .evaluateAll((elements) => elements.map((e) => e.getAttribute('data-account-id')));
  expect(ids).toEqual(risks.filter((r) => r.total_score >= 0.5).map((r) => r.account_id));
  expect(
    await panel.locator('.alert-reason').evaluateAll((elements) =>
      elements.every((el) => {
        const style = getComputedStyle(el);
        return (
          el.clientHeight <= Math.ceil(parseFloat(style.lineHeight)) &&
          el.getAttribute('title') === el.textContent
        );
      }),
    ),
  ).toBe(true);
  await page.screenshot({ path: '../../docs/screenshots/modular-alerts.png' });
  const current = new Set([
    data.start_account,
    ...data.steps.flatMap((s) => [s.from_account, s.to_account]),
  ]);
  const external = risks.find((item) => item.total_score >= 0.5 && !current.has(item.account_id))!;
  expect(external).toBeTruthy();
  await panel
    .getByRole('button', { name: `Investigate alert ${external.account_id}`, exact: true })
    .click();
  await expect(
    page.getByRole('complementary', { name: 'Inspector' }).getByText('KYC', { exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.locator('#network-canvas').evaluate((el, id) => {
        const cy = (el as GraphElement)._cyreg.cy;
        const node = cy.getElementById(id);
        if (node.empty()) return false;
        const p = node.renderedPosition();
        return node.selected() && p.x > 0 && p.x < cy.width() && p.y > 0 && p.y < cy.height();
      }, external.account_id),
    )
    .toBe(true);
  await expect(panel).toHaveCount(0);
});

test('alert failures retry, stale versions are rejected, and empty results are explicit', async ({
  page,
}) => {
  await ready(page);
  await page.route('**/api/risk/top?*', (route) => route.abort('failed'));
  await page.getByRole('button', { name: 'High-risk alerts' }).click();
  const panel = page.getByRole('dialog', { name: 'High-risk accounts' });
  await expect(panel.getByRole('alert')).toBeVisible();
  await page.unroute('**/api/risk/top?*');
  await panel.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(panel.locator('.account-alert').first()).toBeVisible();
  await panel.getByRole('button', { name: 'Close alerts' }).click();
  await page.route('**/api/risk/top?*', async (route) => {
    const response = await route.fetch();
    const items = await response.json();
    items[0].dataset_version = 'old';
    await route.fulfill({ response, json: items });
  });
  await page.getByRole('button', { name: 'High-risk alerts' }).click();
  await expect(panel.getByRole('alert')).toContainText('dataset changed');
  await panel.getByRole('button', { name: 'Close alerts' }).click();
  await page.unroute('**/api/risk/top?*');
  await page.route('**/api/risk/top?*', (route) => route.fulfill({ json: [] }));
  await page.getByRole('button', { name: 'High-risk alerts' }).click();
  await expect(panel).toContainText('No accounts meet the high-risk threshold');
});

test('keyboard shortcuts control the graph and replay while respecting typing and native controls', async ({
  page,
}) => {
  await page.clock.install({ time: '2026-10-25T00:00:00Z' });
  await ready(page);
  await trace(page);
  await page.clock.pauseAt('2026-10-25T01:00:00Z');
  const slider = page.getByRole('slider', { name: 'Timeline event', exact: true });
  await page.locator('.graph-toolbar').click();
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Pause timeline', exact: true })).toBeVisible();
  await page.clock.runFor(1001);
  await page.keyboard.press('Space');
  await expect(slider).toHaveValue('1');
  await page.keyboard.press('ArrowRight');
  await expect(slider).toHaveValue('2');
  await page.keyboard.press('ArrowLeft');
  await expect(slider).toHaveValue('1');
  await page.keyboard.press('r');
  await expect(slider).toHaveValue('0');
  await page.keyboard.press('Space');
  const search = page.getByRole('textbox', { name: 'Search complaints and accounts' });
  await search.fill('f');
  await search.press('r');
  await search.press('Space');
  await search.press('ArrowLeft');
  await expect(slider).toHaveValue('0');
  await expect(search).toHaveValue('fr ');
  await search.press('Escape');
  await search.fill('');
  await page.locator('.graph-toolbar').click();
  await page.locator('#network-canvas').evaluate((el) => {
    (el as GraphElement)._cyreg.cy.zoom(1.8);
  });
  await page.keyboard.press('f');
  expect(
    await page.locator('#network-canvas').evaluate((el) => (el as GraphElement)._cyreg.cy.zoom()),
  ).toBeLessThan(1.8);
  const graph = page.locator('#network-canvas');
  const p = await graph.evaluate((el) =>
    (el as GraphElement)._cyreg.cy.nodes().first().renderedPosition(),
  );
  await graph.click({ position: p });
  await page.keyboard.press('Escape');
  expect(
    await graph.evaluate((el) => (el as GraphElement)._cyreg.cy.elements(':selected').length),
  ).toBe(0);
  await page.getByRole('button', { name: 'Keyboard shortcuts', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Keyboard shortcuts' })).toContainText('Fit graph');
});

test('played event toasts are factual, bounded, expire, and do not backfill on seeks', async ({
  page,
}) => {
  await page.clock.install({ time: '2026-10-25T00:00:00Z' });
  await ready(page);
  await openSettings(page);
  await page.getByLabel('Trace depth', { exact: true }).press('ArrowRight');
  await closeSettings(page);
  const eventsResponse = page.waitForResponse((r) => r.url().includes('/api/timeline/'));
  await trace(page);
  const events = (await (await eventsResponse).json()) as TimelineEvent[];
  await page.clock.pauseAt('2026-10-25T01:00:00Z');
  await page.getByRole('button', { name: 'Play timeline', exact: true }).click();
  await page.clock.runFor(1001);
  await page.getByRole('button', { name: 'Pause timeline', exact: true }).click();
  await expect(page.getByText('High-risk account found', { exact: true })).toBeVisible();
  await expect(page.getByText('Multi-case account match', { exact: true })).toBeVisible();
  expect(await page.locator('.toast-card').count()).toBeLessThanOrEqual(4);
  await page.clock.runFor(4001);
  await expect(page.locator('.toast-card')).toHaveCount(0);
  const split = events.find((e) => e.type === 'split')!;
  await seek(page, split.step - 1);
  await expect(page.locator('.toast-card')).toHaveCount(0);
  await page.getByRole('button', { name: 'Play timeline', exact: true }).click();
  await page.clock.runFor(1001);
  await page.getByRole('button', { name: 'Pause timeline', exact: true }).click();
  await expect(page.getByText('Suspicious split detected', { exact: true })).toBeVisible();
  await page.screenshot({ path: '../../docs/screenshots/modular-toasts.png' });
  const terminal = events.find((e) => e.type === 'terminal')!;
  await seek(page, terminal.step - 1);
  await expect(page.locator('.toast-card')).toHaveCount(0);
  await page.getByRole('button', { name: 'Play timeline', exact: true }).click();
  await page.clock.runFor(1001);
  await expect(
    page.locator('.toast-card').filter({ hasText: 'Probable endpoint reached' }),
  ).toContainText('Withdrawal method unknown');
  await page.getByLabel('SELECT COMPLAINT').selectOption('BH-2026-0031');
  await expect(page.locator('.toast-card')).toHaveCount(0);
  await page.clock.runFor(5000);
  await expect(page.locator('.toast-card')).toHaveCount(0);
});
