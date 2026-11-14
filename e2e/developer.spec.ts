import { expect, test } from '@playwright/test';
import { signUpAndWaitForSetup } from './helpers';

test('developer real-model test page runs with the mock model', async ({ page }) => {
  test.setTimeout(120_000);
  await signUpAndWaitForSetup(page, 'Dev Tester');

  await page.goto('/settings/advanced');
  await expect(page.getByRole('region', { name: 'Automatic backup to a folder' })).toBeVisible();
  await page.getByRole('link', { name: 'Real-model test (for developers)' }).click();
  await expect(page.getByRole('heading', { name: 'Real-model test' })).toBeVisible();

  await page.getByRole('button', { name: 'Run all' }).click();
  await expect(page.getByText(/\d+ passed · \d+ failed · 1 skipped/)).toBeVisible({
    timeout: 60_000,
  });
  const stream = page.getByRole('region', { name: 'Mango AI chat: streaming' });
  await expect(stream.getByText('PASS', { exact: true })).toBeVisible();
  await stream.getByRole('button', { name: 'Show raw output' }).click();
  await expect(page.getByRole('button', { name: 'Copy results' })).toBeEnabled();
});
