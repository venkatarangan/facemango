# Development

Requires Node 22+. `npm run dev` / `npm run build` first fetch the WebLLM model libraries into
`public/models/` (gitignored), so the app serves them itself.

## Code map

| Path            | What                                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------------------- |
| `src/ai/`       | AI tiers: Prompt API → WebLLM (Web Worker) → unsupported. Priority queue, Zod-validated JSON. Photo captioner |
| `src/engine/`   | The simulation: personas, engagement planner, scheduler, living feed, first-run setup                         |
| `src/db/`       | Dexie schema and data actions (everything lives in IndexedDB)                                                 |
| `src/features/` | Screens, one folder each                                                                                      |
| `src/lib/`      | Helpers: backup, usage tracking, analytics, time ago, …                                                       |
| `scripts/`      | Asset scripts (model libraries, sounds, photo pack)                                                           |

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

## Deploy

Pushing to `main` runs `.github/workflows/deploy.yml`: lint, test, build, then deploy to GitHub
Pages at https://face.mangoidiots.com (custom domain set in the repo's Pages settings; Cloudflare
DNS `CNAME face → venkatarangan.github.io`). Set the optional Actions variable `GA_ID` (`G-…`) to
enable analytics.
