import { expect, test } from '@playwright/test';
import type { Core } from 'cytoscape';
type GraphElement = HTMLElement & { _cyreg: { cy: Core } };

test('the trail is readable, panels release space, and selection opens evidence', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Trace Funds', exact: true }).click();
  const canvas = page.locator('#network-canvas');
  await expect(canvas.locator('canvas').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Show inspector' })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  const geometry = await canvas.evaluate((el) => {
    const cy = (el as GraphElement)._cyreg.cy;
    return {
      width: cy.width(),
      height: cy.height(),
      bounds: cy.nodes().renderedBoundingBox(),
      nodes: cy.nodes().map((n) => ({
        p: n.renderedPosition(),
        size: n.renderedWidth(),
        font: parseFloat(n.style('font-size')) * cy.zoom(),
      })),
    };
  });
  expect(geometry.width).toBeGreaterThan(1500);
  expect(geometry.height).toBeGreaterThan(650);
  expect(geometry.bounds.w / geometry.width).toBeGreaterThan(0.65);
  expect(
    geometry.nodes.every(
      (n) =>
        n.font >= 12.5 &&
        n.size >= 30 &&
        n.p.x > 0 &&
        n.p.x < geometry.width &&
        n.p.y > 0 &&
        n.p.y < geometry.height,
    ),
  ).toBe(true);
  expect(await page.locator('.node-role-label').count()).toBe(0);
  await page.getByRole('button', { name: 'Expand graph', exact: true }).click();
  await expect
    .poll(() => canvas.evaluate((el) => (el as GraphElement)._cyreg.cy.width()))
    .toBeGreaterThan(geometry.width + 250);
  await expect(page.getByRole('button', { name: 'Restore panels' })).toBeVisible();
  const point = await canvas.evaluate((el) =>
    (el as GraphElement)._cyreg.cy.nodes('[role = "Victim"]').first().renderedPosition(),
  );
  await canvas.click({ position: point });
  await expect(
    page.getByRole('complementary', { name: 'Inspector' }).getByText('KYC', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Hide inspector panel' }).click();
  await expect(page.getByRole('complementary', { name: 'Inspector' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Restore panels' }).click();
  await expect(page.getByLabel('SELECT COMPLAINT')).toBeVisible();
  await page.screenshot({ path: '../../docs/screenshots/ui-refresh-trail.png' });
});

test('compact screens preserve readable nodes and allow the full graph to be fitted', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Trace Funds', exact: true }).click();
  const canvas = page.locator('#network-canvas');
  await expect(canvas.locator('canvas').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Case controls' })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  const zoom = await canvas.evaluate((el) => (el as GraphElement)._cyreg.cy.zoom());
  expect(zoom).toBeGreaterThanOrEqual(0.65);
  await page.getByRole('button', { name: 'Fit graph', exact: true }).click();
  const fits = await canvas.evaluate((el) => {
    const cy = (el as GraphElement)._cyreg.cy;
    return cy
      .nodes()
      .map((n) => {
        const p = n.renderedPosition();
        return p.x > 0 && p.x < cy.width() && p.y > 0 && p.y < cy.height();
      })
      .every(Boolean);
  });
  expect(fits).toBe(true);
  await page.getByRole('button', { name: 'Case controls', exact: true }).click();
  await expect(page.getByLabel('SELECT COMPLAINT')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('short laptop screens separate labels and resize without losing the trail', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Trace Funds', exact: true }).click();
  const canvas = page.locator('#network-canvas');
  await expect(canvas.locator('canvas').first()).toBeVisible();
  const geometry = await canvas.evaluate((el) => {
    const cy = (el as GraphElement)._cyreg.cy;
    const nodes = cy.nodes().map((n) => ({ size: n.renderedWidth(), b: n.renderedBoundingBox() }));
    return {
      width: cy.width(),
      bounds: cy.nodes().renderedBoundingBox(),
      minSize: Math.min(...nodes.map((n) => n.size)),
      collisions: nodes.flatMap((a, i) =>
        nodes
          .slice(i + 1)
          .filter((b) => a.b.x1 < b.b.x2 && a.b.x2 > b.b.x1 && a.b.y1 < b.b.y2 && a.b.y2 > b.b.y1),
      ).length,
    };
  });
  expect(geometry.minSize).toBeGreaterThanOrEqual(23);
  expect(geometry.bounds.w / geometry.width).toBeGreaterThan(0.8);
  expect(geometry.collisions).toBe(0);
  await page.screenshot({ path: '../../docs/screenshots/ui-refresh-laptop.png' });
  await page.setViewportSize({ width: 1024, height: 768 });
  const point = await canvas.evaluate((el) =>
    (el as GraphElement)._cyreg.cy.nodes('[role = "Victim"]').first().renderedPosition(),
  );
  await canvas.click({ position: point });
  await expect(
    page.getByRole('complementary', { name: 'Inspector' }).getByText('KYC', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Case controls', exact: true })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  await page.getByRole('button', { name: 'Case controls', exact: true }).click();
  await expect(page.getByLabel('SELECT COMPLAINT')).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Inspector' })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
