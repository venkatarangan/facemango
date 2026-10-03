#!/usr/bin/env node
// Fetch licence-verified CC0 / public-domain candidate photos from Wikimedia Commons.
// SPDX-License-Identifier: AGPL-3.0-only
//
// Usage:
//   PHOTO_WORK=/some/folder node scripts/photos/fetch.mjs [--only key1,key2] [--n 3] [--queries file.json]
//
// For every query in queries.json it runs a Commons full-text search restricted (via structured
// data) to CC0 (P275=Q6938433) or public-domain copyright status (P6216=Q19652), then re-checks
// the licence in each file's extmetadata. Accepted files are downloaded as 1280 px thumbnails to
// $PHOTO_WORK/raw/<candidate-id>.jpg and recorded in $PHOTO_WORK/candidates.json.
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  SCRIPT_DIR,
  RAW_DIR,
  CANDIDATES_FILE,
  USER_AGENT,
  ensureDir,
  readJson,
  writeJson,
  sleep,
  stripHtml,
  classifyCommonsLicense,
} from './lib.mjs';

const API = 'https://commons.wikimedia.org/w/api.php';
const THUMB_WIDTH = 1280; // a standard Commons thumbnail step
const SEARCH_LIMIT = 20;

const args = process.argv.slice(2);
const argVal = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const only = argVal('--only')?.split(',');
const nOverride = argVal('--n') ? Number(argVal('--n')) : undefined;
const queriesFile = argVal('--queries') ?? join(SCRIPT_DIR, 'queries.json');

// Titles that are almost never "social-media-postable" photos.
const TITLE_REJECT =
  /\b(map|diagram|chart|logo|poster|stamp|coin|banknote|drawing|engraving|lithograph|illustration|screenshot|svg|scan|archive|museum|specimen|herbarium|x-ray|protest|rally|funeral|hospital|church interior|wedding|bikini|beer|wine|whisky|vodka|cocktail|gun|rifle|army|military|police|aster|modis|viirs|landsat|satellite|sentinel|floor plan|state department|secretary|president|minister|senator|ambassador)\b/i;

async function api(params) {
  const url = `${API}?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (res.ok) return res.json();
    if (res.status === 429 || res.status >= 500) {
      await sleep(2000 * (attempt + 1));
      continue;
    }
    throw new Error(`Commons API ${res.status}`);
  }
  throw new Error('Commons API: too many retries');
}

async function download(url, file) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (res.ok) {
      writeFileSync(file, Buffer.from(await res.arrayBuffer()));
      return;
    }
    if (res.status === 429 || res.status >= 500) {
      await sleep(3000 * (attempt + 1));
      continue;
    }
    throw new Error(`download ${res.status} ${url}`);
  }
  throw new Error(`download: too many retries ${url}`);
}

function yearOf(meta) {
  const raw = stripHtml(meta?.DateTimeOriginal?.value ?? meta?.DateTime?.value);
  const m = raw.match(/(1[89]\d\d|20\d\d)/);
  return m ? Number(m[1]) : null;
}

async function main() {
  ensureDir(RAW_DIR);
  const { defaults, queries } = readJson(queriesFile);
  const candidates = readJson(CANDIDATES_FILE, {});
  const seenTitles = new Set(Object.values(candidates).map((c) => c.title));

  for (const q of queries) {
    if (only && !only.includes(q.key)) continue;
    const want = nOverride ?? q.n ?? defaults.n;
    const have = Object.values(candidates).filter((c) => c.query === q.key).length;
    if (have >= want) continue;

    const search = `${q.q} filetype:bitmap haswbstatement:P275=Q6938433|P6216=Q19652`;
    const data = await api({
      action: 'query',
      generator: 'search',
      gsrnamespace: '6',
      gsrlimit: String(SEARCH_LIMIT),
      gsrsearch: search,
      prop: 'imageinfo',
      iiprop: 'url|size|mime|extmetadata',
      iiurlwidth: String(THUMB_WIDTH),
      iiextmetadatafilter:
        'LicenseShortName|License|LicenseUrl|Artist|Credit|ImageDescription|DateTimeOriginal|DateTime|Restrictions|Categories',
    });
    const pages = (data.query?.pages ?? []).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    let got = have;
    let n = have;
    for (const p of pages) {
      if (got >= want) break;
      const ii = p.imageinfo?.[0];
      if (!ii || seenTitles.has(p.title)) continue;
      if (!/^image\/(jpeg|png|webp)$/.test(ii.mime)) continue;
      if (TITLE_REJECT.test(p.title)) continue;
      const long = Math.max(ii.width, ii.height);
      const short = Math.min(ii.width, ii.height);
      if (long < 1200 || short < 700 || long / short > 2.1) continue;
      const meta = ii.extmetadata ?? {};
      const lic = classifyCommonsLicense(meta);
      if (!lic) continue;
      const year = yearOf(meta);
      if (lic.kind !== 'cc0' && year && year < 1995) continue; // skip archival PD scans
      const restrictions = stripHtml(meta.Restrictions?.value);
      if (/trademark/i.test(restrictions)) continue;

      n += 1;
      const id = `${q.key}-${n}`;
      const file = join(RAW_DIR, `${id}.jpg`);
      try {
        if (!existsSync(file)) await download(ii.thumburl ?? ii.url, file);
      } catch (e) {
        console.warn(`  ! ${p.title}: ${e.message}`);
        n -= 1;
        continue;
      }
      candidates[id] = {
        id,
        query: q.key,
        regionHint: q.region,
        themesHint: q.themes,
        title: p.title,
        source: ii.descriptionurl,
        author: stripHtml(meta.Artist?.value) || 'Unknown',
        credit: stripHtml(meta.Credit?.value),
        licenseKind: lic.kind,
        licenseShortName: stripHtml(meta.LicenseShortName?.value),
        licenseUrlSource: stripHtml(meta.LicenseUrl?.value),
        restrictions,
        year,
        description: stripHtml(meta.ImageDescription?.value).slice(0, 400),
        origWidth: ii.width,
        origHeight: ii.height,
      };
      seenTitles.add(p.title);
      got += 1;
      console.log(`  + ${id}  ${p.title}  [${lic.kind}]`);
      await sleep(400);
    }
    console.log(`${q.key}: ${got}/${want}`);
    writeJson(CANDIDATES_FILE, candidates);
    await sleep(500);
  }
  writeJson(CANDIDATES_FILE, candidates);
  console.log(`Total candidates: ${Object.keys(candidates).length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
