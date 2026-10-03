import { expect, test } from '@playwright/test';

test('landing → signup → home feed, and the profile survives a reload', async ({ page }, info) => {
  const isIPhone = info.project.name === 'mobile-iphone';
  await page.goto('/');
  await expect(page).toHaveURL(/\/welcome$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('entirely yours');

  // The iOS 7-day data-loss notice appears on the landing page for iOS visitors only.
  await expect(page.getByTestId('ios-data-notice')).toHaveCount(isIPhone ? 1 : 0);

  await page.getByRole('button', { name: 'Get started' }).click();
  await expect(page).toHaveURL(/\/signup$/);
  await expect(page.getByTestId(isIPhone ? 'ios-data-notice' : 'local-data-notice')).toBeVisible();

  await page.getByRole('textbox', { name: 'Name' }).fill('Kavya Iyer');
  await page.getByRole('spinbutton', { name: 'Age' }).fill('12');
  await page.getByRole('textbox', { name: 'City' }).fill('Chennai');
  await page.getByRole('button', { name: 'Find my friends' }).click();
  await expect(page.getByText('You need to be 13 or older to use FaceMango')).toBeVisible();
  await expect(page.getByText('Please confirm you understand')).toBeVisible();

  await page.getByRole('spinbutton', { name: 'Age' }).fill('27');
  await page.getByRole('checkbox', { name: /I understand/ }).check();
  await page.getByRole('button', { name: 'Find my friends' }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("What's on your mind, Kavya?")).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: "What's on your mind, Kavya?" })).toBeVisible();
  // Signed-up users skip the landing page.
  await page.goto('/welcome');
  await expect(page).toHaveURL(/\/$/);
});

test('responsive shell: bottom nav on phones, side nav on desktop', async ({ page }, info) => {
  await page.goto('/signup');
  await page.getByRole('textbox', { name: 'Name' }).fill('Ravi');
  await page.getByRole('spinbutton', { name: 'Age' }).fill('35');
  await page.getByRole('textbox', { name: 'City' }).fill('Pune');
  await page.getByRole('checkbox', { name: /I understand/ }).check();
  await page.getByRole('button', { name: 'Find my friends' }).click();
  await expect(page.getByText("What's on your mind, Ravi?")).toBeVisible();

  const mobile = info.project.name.startsWith('mobile');
  const nav = page.getByRole('navigation', { name: 'Main' });
  await expect(nav).toHaveCount(1);
  const mangoAi = nav.getByRole('link', { name: 'Mango AI' });
  await mangoAi.click();
  await expect(page).toHaveURL(/\/assistant$/);
  await expect(page.getByRole('heading', { name: 'Mango AI' })).toBeVisible();
  if (mobile) {
    const box = await nav.boundingBox();
    const viewport = page.viewportSize()!;
    expect(box!.y + box!.height).toBeGreaterThan(viewport.height - 2);
  }
});

test('unknown deep links render the app (SPA fallback)', async ({ page }) => {
  await page.goto('/does/not/exist');
  await expect(page.getByRole('heading', { name: 'This page fell off the tree' })).toBeVisible();
});
