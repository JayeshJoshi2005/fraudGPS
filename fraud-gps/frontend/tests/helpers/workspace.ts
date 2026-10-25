import { expect, type Page } from '@playwright/test';

export async function openSettings(page: Page) {
  if (!(await page.getByRole('dialog', { name: 'Case settings', exact: true }).isVisible()))
    await page.getByRole('button', { name: 'Case controls', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Case settings', exact: true })).toBeVisible();
}
export async function closeSettings(page: Page) {
  if (await page.getByRole('dialog', { name: 'Case settings', exact: true }).isVisible())
    await page.getByRole('button', { name: 'Close case settings', exact: true }).click();
}
