// Downloads the WebLLM model libraries (WebGPU .wasm) into public/models/ so the app serves
// them from its own origin. The CSP then only needs Hugging Face for the weights (SPEC §7).
// Runs before `dev` and `build`; files that are already present are skipped.
import { existsSync } from 'node:fs';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(root, 'public', 'models');
const manifest = JSON.parse(
  await import('node:fs/promises').then((fs) =>
    fs.readFile(path.join(root, 'src', 'ai', 'model-libs.json'), 'utf8'),
  ),
);

await mkdir(outDir, { recursive: true });
for (const file of manifest.files) {
  const target = path.join(outDir, file);
  if (existsSync(target)) continue;
  const url = `${manifest.baseUrl}/${file}`;
  process.stdout.write(`Fetching ${file}… `);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download ${url}: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(`${target}.part`, bytes);
  await rename(`${target}.part`, target);
  console.log(`${(bytes.length / 1048576).toFixed(1)} MB`);
}
