import { openSettings, closeSettings } from './helpers/workspace';
import { expect, test, type Page } from '@playwright/test';
import type { Core, NodeSingular } from 'cytoscape';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import type { Complaint, GraphData, TraceResult } from '../src/types';
type Canvas = HTMLElement & { _cyreg: { cy: Core } };
const api = 'http://127.0.0.1:8000/api';
async function ready(page: Page) {
  await page.goto('/#/trace');
  await expect(page.getByRole('button', { name: 'Trace Funds', exact: true })).toBeEnabled();
}
async function trace(page: Page) {
  await closeSettings(page);
  const response = page.waitForResponse((r) => r.url() === `${api}/trace`);
  await page.getByRole('button', { name: 'Trace Funds', exact: true }).click();
  const result = (await (await response).json()) as TraceResult;
  await expect(page.locator('#network-canvas canvas').first()).toBeVisible();
  return result;
}

for (let rehearsal = 1; rehearsal <= 3; rehearsal++) {
  test(`largest Gamma case completes demo rehearsal ${rehearsal}`, async ({ page, request }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (e) => {
      if (e.type() === 'error' || e.type() === 'warning') errors.push(e.text());
    });
    await page.clock.install({ time: '2026-10-25T00:00:00Z' });
    await ready(page);
    const cases = (await (await request.get(`${api}/complaints?limit=200`)).json())
      .items as Complaint[];
    const paise = (value: string) => {
      const [whole, fraction = ''] = value.split('.');
      return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
    };
    const largest = cases.reduce((a, b) => (paise(a.amount_lost) >= paise(b.amount_lost) ? a : b));
    // Generator truth is used only by this verification, never by the application.
    const manifest = JSON.parse(await readFile('../backend/app/data/manifest.json', 'utf8'));
    expect(manifest.campaigns['Gamma Network'].complaint_ids).toContain(largest.complaint_id);
    await page.getByLabel('SELECT COMPLAINT').selectOption(largest.complaint_id);
    await openSettings(page);
    await page.getByLabel('Trace depth', { exact: true }).press('ArrowRight');
    await closeSettings(page);
    const data = await trace(page);
    expect(data.metrics.account_count).toBeGreaterThanOrEqual(15);
    expect(data.detections.filter((d) => d.type === 'split').length).toBeGreaterThanOrEqual(3);
    expect(data.statistics.probable_endpoint_account_ids.length).toBeGreaterThanOrEqual(2);
    await page.clock.runFor(600);
    expect(
      await page
        .locator('.overview-grid .number-display')
        .evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
    ).toBeGreaterThanOrEqual(14);
    const canvas = page.locator('#network-canvas');
    const highest = await canvas.evaluate((el) => {
      const cy = (el as Canvas)._cyreg.cy;
      const node = cy
        .nodes()
        .sort((a, b) => b.data('risk_score') - a.data('risk_score'))
        .first();
      return { id: node.id(), p: (node as NodeSingular).renderedPosition() };
    });
    await canvas.click({ position: highest.p });
    await expect(page.getByLabel('Risk assessment')).toBeVisible();
    await page.getByText('Risk evidence & source references', { exact: true }).click();
    await expect(page.locator('.evidence-details .evidence').first()).toBeVisible();
    await page.getByRole('button', { name: 'Find Linked Cases', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Shared identifiers' })).toBeVisible();
    await expect(page.locator('.entity-match').first()).toBeVisible();
    expect(
      await canvas.evaluate((el) => (el as Canvas)._cyreg.cy.edges('.dna-link').length),
    ).toBeGreaterThan(0);
    await page.getByRole('tab', { name: 'Money Trail', exact: true }).click();
    await page.clock.pauseAt('2026-10-25T01:00:00Z');
    await page.getByRole('button', { name: 'Play timeline', exact: true }).click();
    await page.clock.runFor(1001);
    await expect(page.locator('.toast-card').first()).toBeVisible();
    await page.getByRole('button', { name: 'Pause timeline', exact: true }).click();
    const slider = page.getByRole('slider', { name: 'Timeline event', exact: true });
    await slider.press('End');
    await expect(slider).toHaveValue((await slider.getAttribute('max')) as string);
    await page.getByRole('button', { name: 'Show full trail', exact: true }).click();
    await page.getByRole('tab', { name: 'Case Summary', exact: true }).click();
    await expect(page.getByLabel('Investigation narrative')).toHaveText(data.summary);
    await page
      .getByRole('tabpanel', { name: 'Case Summary', exact: true })
      .getByRole('checkbox')
      .first()
      .check();
    const received = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Generate Report', exact: true }).click();
    const download = await received;
    await mkdir('../../docs/reports', { recursive: true });
    await download.saveAs(
      `../../docs/reports/modular-${rehearsal}-${download.suggestedFilename()}`,
    );
    await expect(page.getByText('Report downloaded', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'High-risk alerts' }).click();
    await page.clock.runFor(250);
    await expect(page.locator('.account-alert').first()).toBeVisible();
    await page.getByRole('button', { name: 'Close alerts' }).click();
    await mkdir('../../docs/screenshots', { recursive: true });
    await page.screenshot({ path: `../../docs/screenshots/modular-rehearsal-${rehearsal}.png` });
    expect(errors).toEqual([]);
  });
}

test('loading skeletons, exact large amounts and reduced motion remain stable', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/complaints?*', async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    data.items[0].amount_lost = '9007199254740993.01';
    await route.fulfill({ response, json: data });
  });
  await ready(page);
  const amount = page.locator('.case-start-amount .animated-value');
  await expect(amount).toHaveAttribute('data-complete', 'true');
  await expect(amount).toHaveText('₹9,00,71,99,25,47,40,993.01');
  await page.unroute('**/api/complaints?*');
  await trace(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/risk/ACC-*', async (route) => {
    await gate;
    await route.continue();
  });
  try {
    await page.locator('#network-canvas').evaluate((el) => {
      (el as Canvas)._cyreg.cy.nodes().first().emit('tap');
    });
    await expect(page.locator('.evidence-skeleton')).toBeVisible();
    await expect(page.locator('.evidence-skeleton')).toHaveAttribute('aria-busy', 'true');
    release();
    await expect(page.getByLabel('Risk assessment')).toBeVisible();
    await expect(page.locator('.score-ring .animated-value')).toHaveAttribute(
      'data-complete',
      'true',
    );
  } finally {
    release();
  }
  let finish!: () => void;
  const waiting = new Promise<void>((resolve) => {
    finish = resolve;
  });
  await page.route('**/api/dna/BH-*', async (route) => {
    await waiting;
    await route.continue();
  });
  try {
    await page.getByRole('button', { name: 'Find Linked Cases', exact: true }).click();
    await expect(page.locator('#dna-panel .evidence-skeleton')).toBeVisible();
    finish();
    await expect(page.getByRole('heading', { name: 'Shared identifiers' })).toBeVisible();
  } finally {
    finish();
  }
});

test('50 source accounts render within the two-second target', async ({ page, request }) => {
  const full = (await (await request.get(`${api}/graph/full`)).json()) as GraphData;
  const nodes = full.nodes.slice(0, 50);
  const ids = new Set(nodes.map((n) => n.data.id));
  const graph = {
    ...full,
    nodes,
    edges: full.edges.filter((e) => ids.has(e.data.source) && ids.has(e.data.target)),
  };
  await page.route('**/api/graph/trail/*', (route) => route.fulfill({ json: graph }));
  const samples: number[] = [];
  for (let i = 0; i < 3; i++) {
    await ready(page);
    const elapsed = await page
      .getByRole('button', { name: 'Trace Funds', exact: true })
      .evaluate(async (el) => {
        const start = performance.now();
        (el as HTMLButtonElement).click();
        let stableFrames = 0;
        while (performance.now() - start < 5000) {
          await new Promise<void>((done) => requestAnimationFrame(() => done()));
          const host = document.getElementById('network-canvas') as Canvas | null;
          const cy = host?._cyreg?.cy;
          const ready =
            cy &&
            cy.nodes().length === 50 &&
            cy.elements(':animated').empty() &&
            cy.nodes().every((node) => Number(node.style('opacity')) >= 0.99);
          stableFrames = ready ? stableFrames + 1 : 0;
          if (stableFrames === 2) return performance.now() - start;
        }
        return performance.now() - start;
      });
    samples.push(elapsed);
  }
  await mkdir('../../docs/performance', { recursive: true });
  await writeFile(
    '../../docs/performance/modular-graph.json',
    JSON.stringify(
      {
        browser: await page.evaluate(() => navigator.userAgent),
        viewport: page.viewportSize(),
        dataset_version: full.dataset_version,
        node_count: 50,
        edge_count: graph.edges.length,
        conditions:
          'Production bundle; three page loads in one browser context, first lazy-renderer load cold, subsequent HTTP cache warm. Includes click, real trace HTTP, layout, entrance, and two animation frames. Graph fixture is 50 source accounts and all transfers between them.',
        samples_ms: samples,
        target_ms: 2000,
      },
      null,
      2,
    ) + '\n',
  );
  expect(Math.max(...samples)).toBeLessThan(2000);
});
