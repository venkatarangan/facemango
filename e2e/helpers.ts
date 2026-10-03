import { expect, type Page } from '@playwright/test';

export async function signUp(page: Page, name = 'Kavya Iyer') {
  await page.goto('/welcome');
  await page.getByRole('button', { name: 'Get started' }).click();
  await page.getByRole('textbox', { name: 'Name' }).fill(name);
  await page.getByRole('spinbutton', { name: 'Age' }).fill('27');
  await page.getByRole('textbox', { name: 'City' }).fill('Chennai');
  await page.getByRole('checkbox', { name: /I understand/ }).check();
  await page.getByRole('button', { name: 'Find my friends' }).click();
  await expect(page).toHaveURL(/\/$/);
}

export async function signUpAndWaitForSetup(page: Page, name?: string) {
  await signUp(page, name);
  await expect(page.getByRole('region', { name: 'Setting up FaceMango' })).toBeHidden({
    timeout: 60_000,
  });
}

export async function post(page: Page, text: string) {
  await page.getByRole('button', { name: /What's on your mind/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Create post' });
  await dialog.getByRole('textbox', { name: 'Post text' }).fill(text);
  await dialog.getByRole('button', { name: 'Post', exact: true }).click();
  await expect(dialog).toBeHidden();
}
