// Shared helpers for the FaceMango photo-pack scripts.
// SPDX-License-Identifier: AGPL-3.0-only
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(SCRIPT_DIR, '..', '..');
export const PHOTOS_DIR = join(REPO_ROOT, 'public', 'photos');

/** Work folder for raw downloads, candidate metadata and contact sheets (never committed). */
export const WORK_DIR = process.env.PHOTO_WORK ?? join(tmpdir(), 'facemango-photo-work');
export const RAW_DIR = join(WORK_DIR, 'raw');
export const CANDIDATES_FILE = join(WORK_DIR, 'candidates.json');

export const USER_AGENT =
  'FaceMangoPhotoPack/1.0 (https://face.mangoidiots.com; open-source project)';

export const REGIONS = [
  'south-asia',
  'east-asia',
  'southeast-asia',
  'middle-east',
  'africa',
  'europe',
  'americas',
  'oceania',
  'global',
];
export const THEMES = [
  'food',
  'travel',
  'nature',
  'festivals',
  'pets',
  'family',
  'hobbies',
  'sports',
  'city',
  'work',
  'weather',
];
export const SEASONS = ['spring', 'summer', 'autumn', 'winter', 'monsoon', null];

export const LICENSES = {
  cc0: { license: 'CC0 1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/' },
  pdm: {
    license: 'Public Domain Mark 1.0',
    licenseUrl: 'https://creativecommons.org/publicdomain/mark/1.0/',
  },
};

export function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export function readJson(file, fallback) {
  if (!existsSync(file)) return fallback;
  return JSON.parse(readFileSync(file, 'utf8'));
}

export function writeJson(file, data) {
  ensureDir(dirname(file));
  writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Strip HTML tags/entities from Commons extmetadata values. */
export function stripHtml(s) {
  return String(s ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Classify a Commons licence. Returns { kind: 'cc0' | 'pd' | 'pdm' } or null if not acceptable.
 * Only CC0, "Public domain" and the Public Domain Mark are accepted; anything mentioning
 * CC BY / SA / GFDL / etc. is rejected.
 */
export function classifyCommonsLicense(meta) {
  const short = stripHtml(meta?.LicenseShortName?.value).toLowerCase();
  const lic = stripHtml(meta?.License?.value).toLowerCase();
  if (/\bby\b|-sa|gfdl|attribution|share ?alike|fal|art libre|copyright/.test(short)) return null;
  if (short === 'cc0' || short === 'cc0 1.0' || lic === 'cc0') return { kind: 'cc0' };
  if (/^public domain mark/.test(short) || lic === 'pdm') return { kind: 'pdm' };
  if (short === 'public domain' || lic === 'pd' || lic.startsWith('pd-')) return { kind: 'pd' };
  return null;
}
