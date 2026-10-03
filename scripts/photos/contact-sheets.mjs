#!/usr/bin/env node
// Build contact sheets (grids of labelled thumbnails) for visual review of candidates.
// SPDX-License-Identifier: AGPL-3.0-only
//
// Usage:
//   PHOTO_WORK=/some/folder node scripts/photos/contact-sheets.mjs [--prefix sa-] [--ids a-1,b-2] [--cols 5] [--rows 4]
//   PHOTO_WORK=/some/folder node scripts/photos/contact-sheets.mjs --final   # review public/photos
//
// Writes $PHOTO_WORK/sheets/sheet-NN.jpg. Open each sheet and reject anything that breaks the
// content rules in scripts/photos/README.md.
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { WORK_DIR, RAW_DIR, PHOTOS_DIR, CANDIDATES_FILE, ensureDir, readJson } from './lib.mjs';

const args = process.argv.slice(2);
const argVal = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const final = args.includes('--final');
const prefix = argVal('--prefix') ?? '';
const onlyIds = argVal('--ids')?.split(',');
const COLS = Number(argVal('--cols') ?? 5);
const ROWS = Number(argVal('--rows') ?? 4);
const TW = 300;
const TH = 225;
const LABEL = 26;

const escapeXml = (s) =>
  s.replace(
    /[<>&"']/g,
    (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c],
  );

async function main() {
  let items;
  if (final) {
    items = readdirSync(PHOTOS_DIR)
      .filter((f) => f.endsWith('.webp'))
      .sort()
      .map((f) => ({ id: f.replace(/\.webp$/, ''), file: join(PHOTOS_DIR, f) }));
  } else {
    const candidates = readJson(CANDIDATES_FILE, {});
    items = Object.keys(candidates)
      .filter((id) => id.startsWith(prefix) && (!onlyIds || onlyIds.includes(id)))
      .map((id) => ({ id, file: join(RAW_DIR, `${id}.jpg`) }))
      .filter((it) => existsSync(it.file));
  }
  const outDir = join(WORK_DIR, final ? 'sheets-final' : 'sheets');
  if (existsSync(outDir)) rmSync(outDir, { recursive: true });
  ensureDir(outDir);

  const perSheet = COLS * ROWS;
  for (let s = 0; s * perSheet < items.length; s++) {
    const batch = items.slice(s * perSheet, (s + 1) * perSheet);
    const rows = Math.ceil(batch.length / COLS);
    const composites = [];
    for (let i = 0; i < batch.length; i++) {
      const x = (i % COLS) * TW;
      const y = Math.floor(i / COLS) * (TH + LABEL);
      const thumb = await sharp(batch[i].file)
        .resize(TW - 6, TH - 6, { fit: 'contain', background: '#222' })
        .extend({ top: 3, bottom: 3, left: 3, right: 3, background: '#222' })
        .toBuffer();
      composites.push({ input: thumb, left: x, top: y });
      const svg = `<svg width="${TW}" height="${LABEL}"><rect width="100%" height="100%" fill="#fff"/><text x="6" y="18" font-family="sans-serif" font-size="15" fill="#000">${escapeXml(batch[i].id)}</text></svg>`;
      composites.push({ input: Buffer.from(svg), left: x, top: y + TH });
    }
    const out = join(outDir, `sheet-${String(s + 1).padStart(2, '0')}.jpg`);
    await sharp({
      create: { width: COLS * TW, height: rows * (TH + LABEL), channels: 3, background: '#fff' },
    })
      .composite(composites)
      .jpeg({ quality: 82 })
      .toFile(out);
    console.log(out);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
