// Copies runtime assets that packages would otherwise fetch from a CDN into public/, so the app
// makes no third-party requests beyond Hugging Face and Google Analytics (SPEC §7).
import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const assets = [
  [
    'node_modules/@lottiefiles/dotlottie-web/dist/dotlottie-player.wasm',
    'public/emoji/dotlottie-player.wasm',
  ],
];
for (const [from, to] of assets) {
  await mkdir(path.dirname(path.join(root, to)), { recursive: true });
  await copyFile(path.join(root, from), path.join(root, to));
}
