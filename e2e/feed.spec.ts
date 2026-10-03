import { expect, test, type Page } from '@playwright/test';

async function signUp(page: Page, name = 'Kavya Iyer') {
  await page.goto('/welcome');
  await page.getByRole('button', { name: 'Get started' }).click();
  await page.getByRole('textbox', { name: 'Name' }).fill(name);
  await page.getByRole('spinbutton', { name: 'Age' }).fill('27');
  await page.getByRole('textbox', { name: 'City' }).fill('Chennai');
  await page.getByRole('checkbox', { name: /I understand/ }).check();
  await page.getByRole('button', { name: 'Find my friends' }).click();
  await expect(page).toHaveURL(/\/$/);
}

test('first run builds friends and a seed feed (mock model)', async ({ page }) => {
  await signUp(page);
  await expect(page.getByRole('region', { name: 'Setting up FaceMango' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Setting up FaceMango' })).toBeHidden({
    timeout: 60_000,
  });
  await expect(page.getByRole('article').first()).toBeVisible();
  expect(await page.getByRole('article').count()).toBeGreaterThan(2);
  await expect(page.getByRole('button', { name: 'Write your first post' })).toBeVisible();
});

test('posting, reactions, comments and notifications', async ({ page }) => {
  test.setTimeout(150_000);
  await signUp(page, 'Ravi Kumar');
  await expect(page.getByRole('region', { name: 'Setting up FaceMango' })).toBeHidden({
    timeout: 60_000,
  });

  await page.getByRole('button', { name: "What's on your mind, Ravi?" }).click();
  const dialog = page.getByRole('dialog', { name: 'Create post' });
  await dialog
    .getByRole('textbox', { name: 'Post text' })
    .fill('Hello from my first FaceMango post!');
  await dialog.getByRole('button', { name: 'Post', exact: true }).click();
  await expect(dialog).toBeHidden();

  const myPost = page.getByRole('article', { name: 'Post by Ravi Kumar' });
  await expect(myPost).toContainText('Hello from my first FaceMango post!');

  // The engine runs 60× faster in the e2e build: reactions and a comment arrive within seconds.
  await expect(myPost.getByLabel(/reactions:/)).toBeVisible({ timeout: 60_000 });
  await expect(myPost.getByText(/\d+ comments?/)).toBeVisible({ timeout: 90_000 });

  // React to my own post, then open Activity.
  await myPost.getByRole('button', { name: 'Like' }).click();
  await expect(myPost.getByRole('button', { name: /Like \(tap to remove\)/ })).toBeVisible();

  await page.goto('/notifications');
  await expect(page.getByRole('heading', { name: 'Activity' })).toBeVisible();
  await expect(page.getByText(/reacted to your post|commented on your post/).first()).toBeVisible();
});
