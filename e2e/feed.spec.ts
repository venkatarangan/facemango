import { expect, test } from '@playwright/test';
import { signUp, signUpAndWaitForSetup } from './helpers';

test('first run builds friends and a seed feed (mock model)', async ({ page }) => {
  await signUp(page);
  await expect(page.getByRole('region', { name: 'Setting up FaceMango' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Setting up FaceMango' })).toBeHidden({
    timeout: 60_000,
  });
  await expect(page.getByRole('article').first()).toBeVisible();
  // The feed is virtualised: two tall photo posts can fill the screen, so scroll a little first.
  // (window.scrollBy, not mouse.wheel: mobile WebKit has no wheel.)
  await page.evaluate('window.scrollBy(0, 1200)');
  await expect.poll(() => page.getByRole('article').count()).toBeGreaterThan(2);
  await page.evaluate('window.scrollTo(0, 0)');
  await expect(page.getByRole('button', { name: 'Write your first post' })).toBeVisible();
});

test('a post written during setup waits for the friends, then gets reactions', async ({ page }) => {
  test.setTimeout(120_000);
  await signUp(page, 'Mira Das');
  const setup = page.getByRole('region', { name: 'Setting up FaceMango' });
  await expect(setup).toBeVisible();
  await expect(setup.getByTestId('setup-tip')).not.toBeEmpty();

  await setup.getByRole('button', { name: 'Write a post' }).click();
  const dialog = page.getByRole('dialog', { name: 'Create post' });
  await dialog.getByRole('textbox', { name: 'Post text' }).fill('Posted while my AI woke up');
  await dialog.getByRole('button', { name: 'Post', exact: true }).click();
  await expect(page.getByText(/as soon as they arrive/)).toBeVisible();
  await expect(dialog).toBeHidden();
  await expect(setup).toBeVisible(); // the page is no longer aria-hidden behind the dialog

  await expect(setup).toBeHidden({ timeout: 60_000 });
  await expect(page.getByText('Your friends are here! 🥭')).toBeVisible();
  const myPost = page.getByRole('article', { name: 'Post by Mira Das' });
  await expect(myPost.getByLabel(/reactions:/)).toBeVisible({ timeout: 60_000 });
});

test('a photo post gets described for photo-aware comments (mock model)', async ({ page }) => {
  test.setTimeout(120_000);
  await signUpAndWaitForSetup(page, 'Nila Das');

  await page.getByRole('button', { name: "What's on your mind, Nila?" }).click();
  const dialog = page.getByRole('dialog', { name: 'Create post' });
  await dialog.getByRole('textbox', { name: 'Post text' }).fill('My dog says hi');
  await dialog.getByLabel('Post photo').setInputFiles('public/photos/pets-global-002.webp');
  await expect(dialog.getByRole('button', { name: 'Remove photo' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Post', exact: true }).click();
  await expect(dialog).toBeHidden();

  // The mock captioner's description becomes the photo's alt text and feeds the comment prompts.
  const myPost = page.getByRole('article', { name: 'Post by Nila Das' });
  await expect(myPost.getByRole('img', { name: /cup of filter coffee/ })).toBeVisible({
    timeout: 30_000,
  });

  await page.goto('/settings');
  await expect(
    page.getByRole('switch', { name: 'Describe my photos so friends can comment on them' }),
  ).toBeChecked();
  await expect(page.getByText(/downloads a small photo model \(about \d+ MB\)/)).toBeVisible();
});

test('posting, reactions, comments and notifications', async ({ page }) => {
  test.setTimeout(150_000);
  await signUpAndWaitForSetup(page, 'Ravi Kumar');

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
