import { expect, test } from '@playwright/test';
import { post, signUpAndWaitForSetup } from './helpers';

test.describe('M5 sections (mock model)', () => {
  test('friend profile is generated on first visit; own profile can be edited', async ({
    page,
  }) => {
    await signUpAndWaitForSetup(page);
    await page.goto('/friends');
    await page.getByRole('main').getByRole('link').first().click();
    await expect(page).toHaveURL(/\/profile\//);
    await expect(page.getByRole('region', { name: 'About' }).getByText(/Lives in/)).toBeVisible();
    await expect(page.getByLabel('Writing profile')).toBeHidden({ timeout: 20_000 });

    await page.goto('/profile/me');
    await page.getByRole('button', { name: 'Edit profile' }).click();
    await page.getByRole('textbox', { name: 'Bio' }).fill('Filter coffee enthusiast.');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Filter coffee enthusiast.')).toBeVisible();
  });

  test('Mango AI chat answers and drafts a post', async ({ page }) => {
    await signUpAndWaitForSetup(page);
    await page.goto('/assistant');
    await page.getByRole('button', { name: /Write a post for me/ }).click();
    const log = page.getByRole('log', { name: 'Conversation' });
    await expect(log.getByText('Write a post for me.')).toBeVisible();
    await page.getByRole('button', { name: 'Use as post' }).click({ timeout: 20_000 });
    await expect(page.getByRole('dialog', { name: 'Create post' })).toBeVisible();
  });

  test('photos grid opens the lightbox; activity log and wellbeing render', async ({ page }) => {
    await signUpAndWaitForSetup(page);
    await post(page, 'Hello world from the tests');
    await page.goto('/photos');
    await page.getByRole('tab', { name: "Friends' photos" }).click();
    const photos = page.getByRole('button', { name: /Open photo/ });
    if (await photos.count()) {
      await photos.first().click();
      await expect(page.getByRole('dialog', { name: 'Photo viewer' })).toBeVisible();
      await page.keyboard.press('Escape');
    }

    await page.goto('/notifications');
    await page.getByRole('tab', { name: 'Your activity' }).click();
    await expect(page.getByText(/You posted: “Hello world from the tests”/)).toBeVisible();

    await page.goto('/wellbeing');
    await expect(page.getByRole('heading', { name: 'Wellbeing' })).toBeVisible();
    await page.getByRole('button', { name: 'Feeling good' }).first().click();
    await expect(page.getByRole('region', { name: 'Mood' }).locator('svg').first()).toBeVisible();

    await page.goto('/memories');
    await expect(page.getByRole('heading', { name: 'Memories' })).toBeVisible();
    await expect(page.getByText('Your first post on FaceMango')).toBeVisible();
  });
});

test('daily idea from Mango AI prefills the composer (mock model)', async ({ page }) => {
  await signUpAndWaitForSetup(page);
  const card = page.getByRole('region', { name: "Today's idea" });
  await expect(card).toBeVisible({ timeout: 20_000 });
  await card.getByRole('button', { name: 'Write about this' }).click();
  const text = page
    .getByRole('dialog', { name: 'Create post' })
    .getByRole('textbox', { name: 'Post text' });
  await expect(text).not.toHaveValue('');
});
