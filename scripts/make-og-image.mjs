// Makes the social-preview image (public/og-image.jpg, 1200×630) from real screenshots of the app.
// It runs against the e2e build, which uses the mock AI and a made-up profile, so the pictures
// hold no real data. Run: npm run build:e2e && npm run og-image
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const shotsDir = path.join(root, 'docs/screenshots');
const PORT = 4180;
const BASE = `http://localhost:${PORT}`;

const server = spawn(
  'npx',
  ['vite', 'preview', '--outDir', 'dist-e2e', '--port', String(PORT), '--strictPort'],
  { cwd: root, stdio: 'ignore' },
);

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(BASE)).ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('preview server did not start (run npm run build:e2e first)');
}

async function signUp(page) {
  await page.goto('/welcome');
  await page.getByRole('button', { name: 'Get started' }).click();
  await page.getByRole('textbox', { name: 'Name' }).fill('Asha Rao');
  await page.getByRole('spinbutton', { name: 'Age' }).fill('27');
  await page.getByRole('textbox', { name: 'City' }).fill('Chennai');
  await page.getByRole('checkbox', { name: /I understand/ }).check();
  await page.getByRole('button', { name: 'Find my friends' }).click();
  const setup = page.getByRole('region', { name: 'Setting up FaceMango' });
  await setup.waitFor({ state: 'visible' });
  await setup.waitFor({ state: 'hidden', timeout: 90_000 });
}

// Let the welcome confetti and toast finish, and drop emoji (this machine has no emoji font, so
// they would show as empty boxes). Only affects the screenshot.
async function settle(page) {
  await page.waitForTimeout(8000);
  await page.evaluate(() => {
    document
      .querySelectorAll('[role="status"], [role="alert"], .MuiSnackbar-root')
      .forEach((e) => e.remove());
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      n.nodeValue = n.nodeValue.replace(/\p{Extended_Pictographic}\uFE0F?/gu, '');
    }
  });
  await page.waitForTimeout(300);
}

const uri = (buf, type) => `data:${type};base64,${buf.toString('base64')}`;

try {
  await waitForServer();
  await mkdir(shotsDir, { recursive: true });
  const browser = await chromium.launch();

  const desktop = await browser.newContext({
    baseURL: BASE,
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
  });
  const dPage = await desktop.newPage();
  await dPage.goto('/welcome');
  await dPage.waitForSelector('text=Get started');
  await dPage.screenshot({ path: path.join(shotsDir, 'landing.png') });
  await signUp(dPage);
  await settle(dPage);
  await dPage.screenshot({ path: path.join(shotsDir, 'feed.png') });

  const phone = await browser.newContext({
    baseURL: BASE,
    viewport: { width: 390, height: 780 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const pPage = await phone.newPage();
  await signUp(pPage);
  await settle(pPage);
  await pPage.screenshot({ path: path.join(shotsDir, 'feed-phone.png') });

  const feed = await readFile(path.join(shotsDir, 'feed.png'));
  const feedPhone = await readFile(path.join(shotsDir, 'feed-phone.png'));
  const logo = await readFile(path.join(root, 'public/logo.svg'));

  const card = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await card.setContent(`<!doctype html><html><head><style>
    *{box-sizing:border-box;margin:0}
    body{width:1200px;height:630px;overflow:hidden;position:relative;background:#fff;
      font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#111}
    .bar{position:absolute;left:0;top:0;width:14px;height:630px;background:#FFC400}
    .text{position:absolute;left:64px;top:84px;width:450px}
    .logo{width:76px;height:76px;margin-bottom:24px}
    h1{font-size:68px;line-height:1;letter-spacing:-2px;font-weight:800}
    p{font-size:29px;line-height:1.3;margin-top:22px;font-weight:600}
    .sub{font-size:21px;font-weight:500;color:#555;margin-top:18px;line-height:1.35}
    .tag{position:absolute;left:64px;bottom:44px;font-size:22px;font-weight:700;color:#8A6A00}
    .win{position:absolute;left:735px;top:64px;width:690px;height:431px;border-radius:14px;
      overflow:hidden;box-shadow:0 14px 44px rgba(0,0,0,.28);border:1px solid #ddd;background:#fff}
    .win img{width:690px;height:431px;object-fit:cover;object-position:top left;display:block}
    .ph{position:absolute;left:560px;top:150px;width:200px;height:406px;border-radius:30px;
      overflow:hidden;border:7px solid #111;box-shadow:0 14px 44px rgba(0,0,0,.35);background:#fff}
    .ph img{width:186px;height:392px;object-fit:cover;object-position:top;display:block}
  </style></head><body>
    <div class="bar"></div>
    <div class="text">
      <img class="logo" src="${uri(logo, 'image/svg+xml')}" alt="">
      <h1>FaceMango</h1>
      <p>The most personal social network ever built. And the most private.</p>
      <div class="sub">Every friend is AI. It all runs on your device.</div>
    </div>
    <div class="win"><img src="${uri(feed, 'image/png')}" alt=""></div>
    <div class="ph"><img src="${uri(feedPhone, 'image/png')}" alt=""></div>
    <div class="tag">face.mangoidiots.com</div>
  </body></html>`);
  await card.waitForTimeout(300);
  const jpg = await card.screenshot({ type: 'jpeg', quality: 86 });
  await writeFile(path.join(root, 'public/og-image.jpg'), jpg);
  console.log(
    `Wrote public/og-image.jpg (${Math.round(jpg.length / 1024)} KB) and docs/screenshots/`,
  );
  await browser.close();
} finally {
  server.kill();
}
