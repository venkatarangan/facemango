#!/usr/bin/env node
// Convert the curated selection to WebP and write public/photos/manifest.json + CREDITS.md.
// SPDX-License-Identifier: AGPL-3.0-only
//
// Usage:
//   PHOTO_WORK=/some/folder node scripts/photos/build.mjs [--clean]
//
// Reads scripts/photos/selection.json (hand-curated after visual review) and the licence/author
// data recorded by fetch.mjs in $PHOTO_WORK/candidates.json. --clean removes .webp files in
// public/photos that are no longer in the selection.
import { existsSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import {
  SCRIPT_DIR,
  RAW_DIR,
  PHOTOS_DIR,
  CANDIDATES_FILE,
  REGIONS,
  THEMES,
  SEASONS,
  LICENSES,
  ensureDir,
  readJson,
  writeJson,
} from './lib.mjs';

const MAX_EDGE = 1200;
const TARGET_MAX_BYTES = 150 * 1024;
const TARGET_MIN_BYTES = 60 * 1024;
// [long edge, quality] steps tried in order while a photo is still over TARGET_MAX_BYTES.
const FALLBACKS = [
  [1200, 72],
  [1200, 68],
  [1200, 64],
  [1080, 66],
  [960, 66],
  [960, 60],
];

function licenseFor(c) {
  if (c.licenseKind === 'cc0') return LICENSES.cc0;
  if (c.licenseKind === 'pdm') return LICENSES.pdm;
  if (c.licenseKind === 'pd') return { license: 'Public domain', licenseUrl: c.source };
  throw new Error(`Unacceptable licence for ${c.id}: ${c.licenseKind}`);
}

function validate(entry, ids) {
  const errs = [];
  if (!/^[a-z]+-[a-z-]+-\d{3}$/.test(entry.id)) errs.push('id format');
  if (ids.has(entry.id)) errs.push('duplicate id');
  if (!REGIONS.includes(entry.region)) errs.push(`region ${entry.region}`);
  if (!entry.themes?.length || entry.themes.some((t) => !THEMES.includes(t))) errs.push('themes');
  if (!SEASONS.includes(entry.season ?? null)) errs.push(`season ${entry.season}`);
  if (!entry.alt || entry.alt.length < 20) errs.push('alt too short');
  if (!entry.tags?.length) errs.push('tags');
  if (errs.length) throw new Error(`${entry.id}: ${errs.join(', ')}`);
}

/**
 * Resize to MAX_EDGE and encode as WebP, aiming for TARGET_MIN_BYTES..TARGET_MAX_BYTES.
 * Busy photos (foliage, crowds) step quality down, then shrink the long edge; very simple
 * photos (night skies, plain backgrounds) get a higher quality instead.
 * Optional `crop` in a selection entry trims fractions of each edge, e.g. { "bottom": 0.02 }.
 * sharp strips EXIF/XMP/ICC metadata because we never call keepMetadata().
 */
async function encode(input, crop) {
  let src = sharp(input).rotate();
  if (crop) {
    const { width, height } = await sharp(input).rotate().metadata();
    const left = Math.round(width * (crop.left ?? 0));
    const top = Math.round(height * (crop.top ?? 0));
    src = src.extract({
      left,
      top,
      width: width - left - Math.round(width * (crop.right ?? 0)),
      height: height - top - Math.round(height * (crop.bottom ?? 0)),
    });
  }
  const pre = await src.toBuffer();
  const run = (edge, quality) =>
    sharp(pre)
      .resize(edge, edge, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality, effort: 6, smartSubsample: true })
      .toBuffer({ resolveWithObject: true });

  let out = await run(MAX_EDGE, 76);
  if (out.data.length < TARGET_MIN_BYTES) {
    const better = await run(MAX_EDGE, 82);
    if (better.data.length <= TARGET_MAX_BYTES) out = better;
    return out;
  }
  for (const [edge, quality] of FALLBACKS) {
    if (out.data.length <= TARGET_MAX_BYTES) break;
    out = await run(edge, quality);
  }
  return out;
}

/** "https://commons.wikimedia.org/wiki/File:Foo_bar.jpg" -> "Foo bar.jpg" */
const sourceLabel = (url) =>
  decodeURIComponent(url.split('/wiki/')[1] ?? url)
    .replace(/^File:/, '')
    .replace(/_/g, ' ');

const mdEscape = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');

async function main() {
  const clean = process.argv.includes('--clean');
  const selection = readJson(join(SCRIPT_DIR, 'selection.json'));
  const candidates = readJson(CANDIDATES_FILE, {});
  ensureDir(PHOTOS_DIR);

  const ids = new Set();
  const photos = [];
  for (const entry of selection.photos) {
    validate(entry, ids);
    ids.add(entry.id);
    const c = candidates[entry.candidate];
    if (!c) throw new Error(`${entry.id}: candidate ${entry.candidate} not in candidates.json`);
    const raw = join(RAW_DIR, `${entry.candidate}.jpg`);
    const file = `${entry.id}.webp`;
    const dest = join(PHOTOS_DIR, file);
    const { data, info } = await encode(raw, entry.crop);
    writeFileSync(dest, data);
    const { license, licenseUrl } = licenseFor(c);
    photos.push({
      id: entry.id,
      file,
      width: info.width,
      height: info.height,
      region: entry.region,
      country: entry.country ?? null,
      themes: entry.themes,
      tags: entry.tags,
      season: entry.season ?? null,
      alt: entry.alt,
      source: c.source,
      author: entry.author ?? c.author,
      license,
      licenseUrl,
    });
    console.log(`${file}  ${info.width}x${info.height}  ${(data.length / 1024).toFixed(0)} KB`);
  }

  if (clean) {
    for (const f of readdirSync(PHOTOS_DIR)) {
      if (f.endsWith('.webp') && !ids.has(f.replace(/\.webp$/, ''))) {
        rmSync(join(PHOTOS_DIR, f));
        console.log(`removed stale ${f}`);
      }
    }
  }

  writeJson(join(PHOTOS_DIR, 'manifest.json'), { version: 1, photos });

  const lines = [
    '# FaceMango photo pack: credits',
    '',
    'Every photo in this folder is either dedicated to the public domain under',
    '[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) or is in the public domain,',
    'as stated on its source page. Attribution is not required, but we credit every author anyway.',
    'Photos were resized and re-encoded as WebP (one had a thin border trimmed); nothing else was changed.',
    '',
    `Total: ${photos.length} photos. Machine-readable data: [manifest.json](manifest.json).`,
    '',
    '| ID | Author | Source | Licence |',
    '|---|---|---|---|',
    ...photos.map(
      (p) =>
        `| ${p.id} | ${mdEscape(p.author)} | [${mdEscape(sourceLabel(p.source))}](${p.source}) | [${p.license}](${p.licenseUrl}) |`,
    ),
    '',
  ];
  writeFileSync(join(PHOTOS_DIR, 'CREDITS.md'), lines.join('\n'));

  const total = photos.reduce((s, p) => s + statSync(join(PHOTOS_DIR, p.file)).size, 0);
  const count = (key) =>
    photos.reduce((m, p) => {
      for (const v of [].concat(p[key])) m[v] = (m[v] ?? 0) + 1;
      return m;
    }, {});
  console.log(`\n${photos.length} photos, ${(total / 1024 / 1024).toFixed(2)} MB`);
  console.log('regions', count('region'));
  console.log('themes', count('themes'));
  if (!existsSync(join(PHOTOS_DIR, 'manifest.json'))) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
