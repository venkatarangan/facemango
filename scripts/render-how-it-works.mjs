// Prints the illustrated architecture guide (docs/how-it-works/how-it-works.html) to
// public/FaceMango-How-It-Works.pdf with Playwright's Chromium. Run: npm run docs:pdf
// Each <section class="page"> in the HTML is one A4 page; pages whose content overflows are
// reported, so a long edit doesn't get silently cut off.
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source = path.join(root, 'docs/how-it-works/how-it-works.html');
const output = path.join(root, 'public/FaceMango-How-It-Works.pdf');

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(source).href, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.emulateMedia({ media: 'print' });

  // Content taller than its page (minus the footer area) would be clipped.
  const overflows = await page.$$eval('section.page', (pages) =>
    pages.flatMap((section, i) => {
      const foot = section.querySelector('.foot');
      const limit = foot
        ? foot.getBoundingClientRect().top - 4
        : section.getBoundingClientRect().bottom;
      const bottom = Math.max(
        ...[...section.children]
          .filter((el) => el !== foot)
          .map((el) => el.getBoundingClientRect().bottom),
      );
      return bottom > limit ? [`page ${i + 1}: ${Math.ceil(bottom - limit)}px too tall`] : [];
    }),
  );

  const sections = await page.locator('section.page').count();

  // The margins are part of each page's layout (padding on section.page), so the PDF has none.
  const pdf = await page.pdf({
    path: output,
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
    outline: true,
    tagged: true,
  });
  const pages = pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)?.length ?? 0;
  console.log(
    `Wrote ${path.relative(root, output)}: ${pages} pages, ${Math.round(pdf.length / 1024)} KB`,
  );
  if (pages !== sections) {
    console.error(`Expected ${sections} pages (one per section.page), got ${pages}.`);
    process.exitCode = 1;
  }
  if (overflows.length) {
    console.error(`Content overflows:\n  ${overflows.join('\n  ')}`);
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
