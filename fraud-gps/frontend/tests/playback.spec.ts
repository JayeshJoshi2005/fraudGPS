import { test, expect, type Page } from '@playwright/test';
import type { Core } from 'cytoscape';
import type { Complaint, TimelineEvent, TraceResult } from '../src/types';
import { eventDelay } from '../src/utils/playback';
import { mkdir } from 'node:fs/promises';

type GraphElement = HTMLElement & { _cyreg: { cy: Core } };
const api = 'http://127.0.0.1:8000/api';
async function ready(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Trace Funds', exact: true })).toBeEnabled();
}
async function trace(page: Page) {
  const response = page.waitForResponse(
    (r) => r.url() === `${api}/trace` && r.request().method() === 'POST',
  );
  const timeline = page.waitForResponse((r) => r.url().includes('/api/timeline/'));
  await page.getByRole('button', { name: 'Trace Funds', exact: true }).click();
  const result = (await (await response).json()) as TraceResult;
  const events = (await (await timeline).json()) as TimelineEvent[];
  await expect(
    page.getByRole('button', { name: 'Replay Trail', exact: true, includeHidden: true }),
  ).toBeEnabled();
  await expect(page.locator('#network-canvas canvas').first()).toBeVisible();
  return { result, events };
}
async function freeze(page: Page) {
  await page.clock.pauseAt('2026-10-23T01:00:00Z');
}
async function seek(page: Page, step: number, clockInstalled = true) {
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
  await expect(page.locator('.graph-host')).toHaveAttribute('data-story-step', String(step));
  // Let Cytoscape paint the new prefix when the test clock is paused.
  if (clockInstalled) await page.clock.runFor(32);
}
async function snapshot(page: Page) {
  return page.locator('#network-canvas').evaluate((element) =>
    (element as GraphElement)._cyreg.cy.elements().map((e) => ({
      id: e.id(),
      classes: e
        .classes()
        .filter((c) => c.startsWith('story-'))
        .sort(),
      opacity: e.style('opacity'),
      offset: e.style('line-dash-offset'),
    })),
  );
}

test('play/pause, speed cadence, steps, scrubbing and replay share one state', async ({ page }) => {
  await page.clock.install({ time: '2026-10-23T00:00:00Z' });
  await ready(page);
  await page.getByLabel('Trace depth', { exact: true }).press('ArrowRight');
  const { result, events } = await trace(page);
  await freeze(page);
  const slider = page.getByRole('slider', { name: 'Timeline event', exact: true });
  await page.getByRole('button', { name: 'Play timeline', exact: true }).click();
  await expect(page.locator('.graph-host')).toHaveAttribute('data-story-step', '0');
  const initial = await page
    .locator('#network-canvas')
    .evaluate((el) => (el as GraphElement)._cyreg.cy.nodes('.story-revealed').map((n) => n.id()));
  expect(initial).toEqual([result.start_account]);
  await page.clock.runFor(999);
  await expect(slider).toHaveValue('0');
  await page.clock.runFor(2);
  await expect(slider).toHaveValue('1');
  await page.getByRole('button', { name: 'Pause timeline', exact: true }).click();
  const paused = await snapshot(page);
  await page.clock.runFor(5000);
  expect(await snapshot(page)).toEqual(paused);
  await page.getByRole('button', { name: 'Next event', exact: true }).click();
  const target = await snapshot(page);
  await seek(page, events.length);
  await page.getByRole('button', { name: 'Previous event', exact: true }).click();
  await seek(page, 2);
  expect(await snapshot(page)).toEqual(target);
  for (const speed of [0.5, 1, 2, 3] as const) {
    await seek(page, 0);
    await page.getByLabel('Playback speed').selectOption(String(speed));
    await page.getByRole('button', { name: 'Play timeline', exact: true }).click();
    await page.clock.runFor(1000 / speed - 1);
    await expect(slider).toHaveValue('0');
    await page.clock.runFor(2);
    await expect(slider).toHaveValue('1');
  }
  await page.getByRole('button', { name: 'Pause replay', exact: true }).click();
  await page.getByRole('button', { name: 'Replay Trail', exact: true }).click();
  await expect(slider).toHaveValue('0');
  // Native keyboard scrubbing pauses even at a boundary.
  await slider.press('Home');
  await expect(page.getByRole('button', { name: 'Play timeline', exact: true })).toBeVisible();
  await page.clock.runFor(1000);
  await expect(slider).toHaveValue('0');
  // Drag the actual scrubber to an arbitrary prefix, then reproduce it directly.
  const box = (await slider.boundingBox())!;
  await page.mouse.move(box.x + 4, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.55, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();
  const draggedStep = Number(await slider.inputValue());
  expect(draggedStep).toBeGreaterThan(0);
  const dragged = await snapshot(page);
  await seek(page, 0);
  await seek(page, draggedStep);
  expect(await snapshot(page)).toEqual(dragged);
  await seek(page, events.length);
  await expect(page.getByText('Trail complete', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next event' })).toBeDisabled();
  await page.getByRole('button', { name: 'Play timeline' }).click();
  await expect(slider).toHaveValue('0');
  await page.getByRole('button', { name: 'Show full trail' }).click();
  await expect(page.locator('.graph-host')).toHaveAttribute('data-story-step', 'overview');
  expect((await snapshot(page)).every((e) => e.classes.length === 0)).toBe(true);
});

test('event effects, role labels and cards follow the rendered viewport', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' || message.text().includes('is invalid'))
      errors.push(message.text());
  });
  await page.clock.install({ time: '2026-10-23T00:00:00Z' });
  await ready(page);
  await page.getByLabel('Trace depth', { exact: true }).press('ArrowRight');
  const { result, events } = await trace(page);
  await freeze(page);
  const split = events.find((e) => e.type === 'split')!;
  await seek(page, split.step);
  const card = page.getByLabel('Story event', { exact: true });
  await expect(card).toContainText('Split detected');
  await expect(card).toContainText(`${split.metrics.destination_count} accounts`);
  const active = await page
    .locator('#network-canvas')
    .evaluate((el) => (el as GraphElement)._cyreg.cy.edges('.story-current').map((e) => e.id()));
  expect(active.sort()).toEqual(split.outputs.map((o) => o.transaction_id).sort());
  expect(await page.locator('.node-role-label').count()).toBeGreaterThan(0);
  await page.clock.runFor(5000);
  await expect(card).toBeVisible();
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await page.locator('#network-canvas').evaluate((el) => {
    const cy = (el as GraphElement)._cyreg.cy;
    const pan = cy.pan();
    cy.pan({ x: pan.x + 75, y: pan.y + 40 });
  });
  const position = await page
    .locator('#network-canvas')
    .evaluate(
      (el, id) => (el as GraphElement)._cyreg.cy.getElementById(id).renderedPosition(),
      split.account_ids[0],
    );
  const canvas = (await page.locator('.graph-host').boundingBox())!;
  const rect = (await card.boundingBox())!;
  expect(rect.x).toBeGreaterThanOrEqual(canvas.x + 7);
  expect(rect.y).toBeGreaterThanOrEqual(canvas.y + 7);
  expect(rect.x + rect.width).toBeLessThanOrEqual(canvas.x + canvas.width - 7);
  expect(rect.y + rect.height).toBeLessThanOrEqual(canvas.y + canvas.height - 7);
  expect(
    Math.abs(
      rect.x - canvas.x - Math.max(8, Math.min(position.x + 20, canvas.width - rect.width - 8)),
    ),
  ).toBeLessThan(2);
  await page.getByRole('button', { name: 'Fit graph' }).click();
  await mkdir('../../docs/screenshots', { recursive: true });
  await page.screenshot({ path: '../../docs/screenshots/ui-refresh-story.png' });
  for (const type of ['rapid_forward', 'terminal']) {
    const event = events.find((e) => e.type === type)!;
    await seek(page, event.step);
    await expect(card).toHaveAttribute('data-event-id', event.event_id);
    if (type === 'rapid_forward')
      expect((await snapshot(page)).some((e) => e.classes.includes('story-rapid'))).toBe(true);
    if (type === 'terminal')
      expect(
        (await snapshot(page)).filter((e) => e.classes.includes('story-terminal')).length,
      ).toBeGreaterThan(1);
  }
  await seek(page, events.length);
  expect((await snapshot(page)).every((element) => element.opacity === '1')).toBe(true);
  await expect(page.locator('.story-complete')).toContainText(
    `${result.statistics.probable_endpoint_account_ids.length} probable endpoints`,
  );
  await page.screenshot({ path: '../../docs/screenshots/ui-refresh-complete.png' });
  const network = page.locator('#network-canvas');
  const nodePoint = await network.evaluate(
    (el, id) => (el as GraphElement)._cyreg.cy.getElementById(id).renderedPosition(),
    split.account_ids[0],
  );
  await network.click({ position: nodePoint, button: 'right' });
  await page.locator('.graph-context').getByRole('button', { name: 'Expand neighborhood' }).click();
  await expect(page.getByRole('button', { name: 'Clear expansion' })).toBeVisible();
  const traced = new Set([
    result.start_account,
    ...result.steps.flatMap((step) => [step.tx_id, step.from_account, step.to_account]),
  ]);
  const expanded = (await snapshot(page)).filter((element) => !traced.has(element.id));
  expect(expanded.length).toBeGreaterThan(0);
  expect(expanded.every((element) => element.classes.includes('story-dim'))).toBe(true);
  await page.getByLabel('Show only suspicious nodes').check();
  await expect(page.getByLabel('Replay progress', { exact: true })).toContainText(
    `${events.length} / ${events.length}`,
  );
  await expect(page.locator('.story-complete')).toContainText(
    `${result.metrics.account_count} accounts`,
  );
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(
    true,
  );
  expect(errors).toEqual([]);
});

test('timeline failure retries without discarding the trace', async ({ page }) => {
  await page.route('**/api/timeline/**', (route) => route.abort('failed'));
  await ready(page);
  await page.getByRole('button', { name: 'Trace Funds', exact: true }).click();
  const footer = page.getByLabel('Evidence timeline', { exact: true });
  await expect(footer.getByRole('alert')).toBeVisible();
  await expect(page.locator('#network-canvas')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Replay Trail', exact: true })).toBeDisabled();
  await page.unroute('**/api/timeline/**');
  await footer.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Replay Trail', exact: true })).toBeEnabled();
  await expect(footer.getByRole('alert')).toHaveCount(0);
});

test('timeline dataset and source mismatches are rejected before replay', async ({ page }) => {
  let invalidVersion = true;
  await page.route('**/api/timeline/**', async (route) => {
    const response = await route.fetch();
    const events = await response.json();
    if (!invalidVersion) events[0].amount = '999999';
    await route.fulfill({
      response,
      headers: {
        ...response.headers(),
        'x-dataset-version': invalidVersion ? 'changed' : response.headers()['x-dataset-version'],
      },
      json: events,
    });
  });
  await ready(page);
  await page.getByRole('button', { name: 'Trace Funds', exact: true }).click();
  const footer = page.getByLabel('Evidence timeline', { exact: true });
  await expect(footer.getByRole('alert')).toContainText('dataset changed');
  invalidVersion = false;
  await footer.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(footer.getByRole('alert')).toContainText('does not match');
  await expect(page.getByRole('button', { name: 'Replay Trail', exact: true })).toBeDisabled();
  await page.unroute('**/api/timeline/**');
  await footer.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Replay Trail', exact: true })).toBeEnabled();
});

test('delayed timeline cannot attach to a different case', async ({ page, request }) => {
  const cases = (await (await request.get(`${api}/complaints`)).json()).items as Complaint[];
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
  await page.route(`**/api/timeline/${cases[0].complaint_id}?**`, async (route) => {
    const response = await route.fetch();
    intercepted();
    await gate;
    await route.fulfill({ response }).catch(() => {});
    finished();
  });
  await ready(page);
  await page.getByRole('button', { name: 'Trace Funds', exact: true }).click();
  await seen;
  await page.getByLabel('SELECT COMPLAINT').selectOption(cases[1].complaint_id);
  const { events } = await trace(page);
  release();
  await done;
  await expect(page.getByRole('slider', { name: 'Timeline event', exact: true })).toHaveAttribute(
    'max',
    String(events.length),
  );
  await page.getByRole('button', { name: 'Replay Trail', exact: true }).click();
  const revealed = await page
    .locator('#network-canvas')
    .evaluate((el) => (el as GraphElement)._cyreg.cy.nodes('.story-revealed').map((n) => n.id()));
  expect(revealed).toEqual([cases[1].victim_account]);
});

test('case/options changes clear timers and hidden tabs pause playback', async ({
  page,
  request,
}) => {
  await page.clock.install({ time: '2026-10-23T00:00:00Z' });
  const cases = (await (await request.get(`${api}/complaints`)).json()).items as Complaint[];
  await ready(page);
  await trace(page);
  await freeze(page);
  await page.getByRole('button', { name: 'Replay Trail', exact: true }).click();
  await page.clock.runFor(1001);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByRole('button', { name: 'Play timeline', exact: true })).toBeVisible();
  await page.clock.runFor(5000);
  await expect(page.getByRole('slider', { name: 'Timeline event', exact: true })).toHaveValue('1');
  await page.evaluate(() => {
    delete (document as unknown as { hidden?: boolean }).hidden;
  });
  await page.getByRole('button', { name: 'Play timeline', exact: true }).click();
  await page.getByLabel('SELECT COMPLAINT').selectOption(cases[1].complaint_id);
  await page.clock.runFor(5000);
  await expect(page.locator('#network-canvas')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Replay Trail', exact: true })).toBeDisabled();
  await trace(page);
  await expect(page.getByLabel('Replay progress', { exact: true })).toContainText('OVERVIEW');
  await page.getByRole('button', { name: 'Replay Trail', exact: true }).click();
  await page.getByLabel('Trace depth', { exact: true }).press('Home');
  await page.clock.runFor(5000);
  await expect(page.locator('.story-event-card')).toHaveCount(0);
  await expect(page.locator('#network-canvas')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Play timeline', exact: true })).toBeDisabled();
});

test('autoplay reaches the final state in API event order', async ({ page }) => {
  test.setTimeout(90000);
  await page.clock.install({ time: '2026-10-23T00:00:00Z' });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  const { result, events } = await trace(page);
  await freeze(page);
  await page.getByLabel('Playback speed').selectOption('3');
  await page.getByRole('button', { name: 'Replay Trail', exact: true }).click();
  for (let index = 0; index < events.length; index++) {
    await page.clock.runFor(eventDelay(events[index - 1], 3) + 1);
    await expect(page.getByRole('slider', { name: 'Timeline event', exact: true })).toHaveValue(
      String(index + 1),
    );
  }
  await expect(page.getByRole('button', { name: 'Play timeline', exact: true })).toBeVisible();
  await expect(page.getByText('Trail complete', { exact: true })).toBeVisible();
  const revealed = await page
    .locator('#network-canvas')
    .evaluate((el) => (el as GraphElement)._cyreg.cy.edges('.story-revealed').map((e) => e.id()));
  expect(revealed.sort()).toEqual(result.steps.map((s) => s.tx_id).sort());
  await page.clock.runFor(5000);
  await expect(page.getByRole('slider', { name: 'Timeline event', exact: true })).toHaveValue(
    String(events.length),
  );
});

test('mobile replay and empty results remain usable with reduced motion', async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  const { events } = await trace(page);
  await seek(page, events.find((e) => e.type === 'split')!.step, false);
  await expect(page.getByLabel('Story event', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: '../../docs/screenshots/ui-refresh-mobile-story.png',
    fullPage: true,
  });
  const cases = (await (await request.get(`${api}/complaints`)).json()).items as Complaint[];
  await page.getByRole('button', { name: 'Case controls', exact: true }).click();
  await page
    .getByLabel('SELECT COMPLAINT')
    .selectOption(cases.find((c) => Number(c.amount_lost) < 100000)!.complaint_id);
  await page.getByLabel('Minimum amount', { exact: true }).press('End');
  await page.getByRole('button', { name: 'Trace Funds', exact: true }).click();
  await expect(page.getByText(/No transfers meet the selected minimum/)).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Replay Trail', exact: true, includeHidden: true }),
  ).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Play timeline', exact: true })).toBeDisabled();
});
