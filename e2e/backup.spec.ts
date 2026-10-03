import { expect, test } from '@playwright/test';
import { post, signUpAndWaitForSetup } from './helpers';

test('advanced settings, backup, restore and friends reset (mock model)', async ({
  page,
}, info) => {
  test.setTimeout(180_000);
  await signUpAndWaitForSetup(page, 'Backup Tester');
  await post(page, 'Please survive the restore');

  // Advanced settings save.
  await page.goto('/settings/advanced');
  await page.getByRole('slider', { name: 'Minimum likes' }).focus();
  await page.keyboard.press('ArrowRight');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText(/Saved\. New posts/)).toBeVisible();

  // Download a backup.
  await page.goto('/settings');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download backup' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^facemango-backup-\d{4}-\d{2}-\d{2}\.zip$/);
  const file = info.outputPath('backup.zip');
  await download.saveAs(file);

  // Wipe, then restore from the welcome screen.
  await page.getByRole('button', { name: 'Delete all FaceMango data' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  await expect(page).toHaveURL(/\/welcome$/);
  await page.getByRole('button', { name: 'Have a backup? Restore it' }).click();
  await page.getByLabel('Backup file').setInputFiles(file);
  await expect(page.getByText(/Backup of Backup Tester/)).toBeVisible();
  await page.getByRole('button', { name: 'Restore', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText('Please survive the restore')).toBeVisible({ timeout: 20_000 });

  // Friends reset: old friends become former friends and a new circle is generated.
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Reset friends' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Reset friends' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('region', { name: 'Setting up FaceMango' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Setting up FaceMango' })).toBeHidden({
    timeout: 60_000,
  });
});
