# Development

Requires Node 22+. `npm run dev` / `npm run build` first fetch the WebLLM model libraries into
`public/models/` (gitignored), so the app serves them itself.

## Code map

| Path                    | What                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------- |
| `src/ai/`               | AI tiers: Prompt API → WebLLM (Web Worker) → unsupported. Priority queue, Zod-validated JSON. Photo captioner |
| `src/engine/`           | The simulation: personas, engagement planner, scheduler, living feed, first-run setup                         |
| `src/engine/stories.ts` | Friends' life stories: beat logic; the curated arcs are in `storyTemplates.ts`                                |
| `src/db/`               | Dexie schema and data actions (everything lives in IndexedDB)                                                 |
| `src/features/`         | Screens, one folder each                                                                                      |
| `src/lib/`              | Helpers: backup, usage tracking, analytics, time ago, …                                                       |
| `scripts/`              | Asset scripts (model libraries, sounds, photo pack)                                                           |

## Rules

- **No data leaves the device.** Allowed hosts: same origin, Hugging Face (model weights), Google
  Analytics (page views, route patterns only). Copy CDN assets into `public/` instead of fetching
  them.
- **Hard caps:** 1,000,000 likes and 100 comments per post (`src/engine/limits.ts`).
- **All AI calls** go through `src/ai` and validate their output with Zod.
- **Database changes:** add a new Dexie version; never edit a shipped one.
- **Mock model:** exists only in the e2e build (`npm run build:e2e`, `VITE_MOCK_AI=1`). The app has
  no non-AI mode.

## Photo captioner

`src/ai/captioner*.ts`: Florence-2-base-ft via `@huggingface/transformers` in a Web Worker, for
photo-aware comments when the AI can't see images. It loads lazily on the first photo post; the
GPU step runs through the shared AI queue, and the worker is shut down after use.

- **Self-hosted runtime:** Transformers.js points ONNX Runtime at jsDelivr by default. The worker
  imports `onnxruntime-web/ort-wasm-simd-threaded.asyncify.wasm?url` (Vite emits it as a hashed
  asset) and sets `wasmPaths` to it. This relies on npm deduping `onnxruntime-web` to the version
  Transformers.js pins; check it after upgrading the library.
- **Service worker:** the captioner worker and the `.wasm` are runtime-cached, not precached. The
  weights live in the `facemango-photo-model` cache.

## How-it-works guide (PDF)

`public/FaceMango-How-It-Works.pdf` is the illustrated architecture guide. Vite copies it to
`dist/`, so it is live at https://face.mangoidiots.com/FaceMango-How-It-Works.pdf (the service
worker skips `.pdf` navigations). It is the only copy, and the README links to it. When a publish
includes a major change to the architecture, framework or libraries (not ordinary changes), update
the PDF before pushing. It was printed from HTML with Chromium and the source is not tracked, so
recreate it to match the current layout and replace the file.

## Testing

- `npm test`: Vitest in Node with `fake-indexeddb`. Clear the DB in `beforeEach`.
- `npm run test:e2e`: Playwright against the mock-model build.
- The mock can't judge real output quality, so try prompt changes in a real browser.

## Real-model test page (developers)

Settings → Advanced settings → Developer → **Real-model test** (`/settings/developer`,
`src/features/developer/`). It runs fixed prompts through whatever model is loaded, using the real
engine functions (personas, friend posts, comment batches with the tone mix, Mango AI chat,
composer rewrite, photo description), and writes nothing to the database. The background engine
pauses while it runs.

1. `npm run dev` in WSL, open http://localhost:5173 in Chrome or Edge on Windows, sign up and wait
   for the model to load.
2. Open the page, press **Run all** (about 20 requests, a minute or two of GPU).
3. Each test shows pass/fail, Zod validity per attempt, retries, time, tokens/s (WebLLM reports
   it; `≈` means estimated), repetition across outputs, and the raw output. The comment test
   compares requested and detected tones (a keyword heuristic) with the 60/25/10/5 target.
4. **Mango AI chat: streaming** calls the provider without the app's fallback, so a streaming
   failure shows its full error and stack. **Copy results** puts a Markdown report on the
   clipboard.

Tracing uses `setAITrace()` in `src/ai/service.ts`; providers report attempts and token usage
through `GenerateOptions.trace`.

## Automatic backup to a folder

`src/lib/backup/autoBackup.ts` and `folder.ts`: opt-in under Advanced settings, Chrome/Edge on
computers only (`showDirectoryPicker`). The folder handle lives in `settings.autoBackup` (no new
Dexie version); it and `meta.autoBackupStatus` are device-only, so they are left out of backups and
kept on restore. Weekly, never prompts in the background; when the browser wants permission again,
the feed's backup card asks for a click. Keeps the newest 5 `facemango-auto-backup-*.zip` files
and never touches other files. Headless Chromium crashes when it reads a stored folder handle, so
this flow is covered by unit tests with a fake folder, not e2e.

## Deploy

Pushing to `main` runs `.github/workflows/deploy.yml`: lint, test, build, then deploy to GitHub
Pages at https://face.mangoidiots.com (custom domain set in the repo's Pages settings; Cloudflare
DNS `CNAME face → venkatarangan.github.io`). Set the optional Actions variable `GA_ID` (`G-…`) to
enable analytics.
