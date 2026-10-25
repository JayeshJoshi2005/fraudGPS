import { expect, test } from '@playwright/test';
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Core } from 'cytoscape';

test('an independent dataset works through the real UI and report pipeline', async ({
  page,
  request,
}, info) => {
  const directory = info.outputPath('replacement-data');
  const python = resolve('../backend/.venv/Scripts/python.exe');
  execFileSync(python, ['tests/replacement_data.py', '--output', directory], {
    cwd: '../backend',
    windowsHide: true,
  });
  const probe = createServer();
  await new Promise<void>((done) => probe.listen(0, '127.0.0.1', done));
  const port = (probe.address() as { port: number }).port;
  await new Promise<void>((done) => probe.close(() => done()));
  const child = spawn(
    python,
    ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', String(port)],
    {
      cwd: '../backend',
      windowsHide: true,
      env: { ...process.env, FRAUD_GPS_DATA_DIR: directory },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  let log = '';
  child.stdout.on('data', (data) => {
    log += String(data);
  });
  child.stderr.on('data', (data) => {
    log += String(data);
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await expect
      .poll(
        async () => {
          if (child.exitCode !== null) throw new Error(log);
          return (
            await request.get(`http://127.0.0.1:${port}/health`).catch(() => undefined)
          )?.status();
        },
        { timeout: 15000 },
      )
      .toBe(200);
    await page.route('http://127.0.0.1:8000/api/**', async (route) => {
      const response = await route.fetch({
        url: route.request().url().replace(':8000/', `:${port}/`),
      });
      await route.fulfill({ response });
    });
    await page.goto('/#/trace');
    await expect(page.getByLabel('SELECT COMPLAINT')).toHaveValue('BH-2026-9901');
    await expect(page.locator('.case-start-amount .number-display')).toHaveText('₹1,00,001.35');
    const response = page.waitForResponse((r) => r.url().endsWith('/api/trace'));
    await page.getByRole('button', { name: 'Trace Funds', exact: true }).click();
    const trace = await (await response).json();
    expect(trace.steps.map((s: { tx_id: string }) => s.tx_id)).toEqual([
      'replacement-a-seed',
      'replacement-a-forward',
    ]);
    const canvas = page.locator('#network-canvas');
    await expect(canvas.locator('canvas').first()).toBeVisible();
    await canvas.evaluate((el) => {
      (el as HTMLElement & { _cyreg: { cy: Core } })._cyreg.cy
        .getElementById('ACC-900002')
        .emit('tap');
    });
    await expect(page.getByLabel('Risk assessment')).toBeVisible();
    await page.getByRole('button', { name: 'Find Linked Cases', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Shared identifiers' })).toBeVisible();
    await expect(page.locator('.entity-match').first()).toContainText(/phone/i);
    await page.getByRole('tab', { name: 'Case Summary', exact: true }).click();
    await expect(page.getByLabel('Investigation narrative')).toHaveText(trace.summary);
    const received = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Generate Report', exact: true }).click();
    const download = await received;
    expect(download.suggestedFilename()).toContain('BH-2026-9901');
    await mkdir('../../docs/reports', { recursive: true });
    await download.saveAs(`../../docs/reports/modular-replacement-${download.suggestedFilename()}`);
    await page.screenshot({ path: '../../docs/screenshots/modular-replacement.png' });
    expect(errors).toEqual([]);
  } finally {
    if (child.exitCode === null) {
      const stopped = new Promise<void>((done) => child.once('exit', () => done()));
      child.kill();
      await stopped;
    }
  }
});
