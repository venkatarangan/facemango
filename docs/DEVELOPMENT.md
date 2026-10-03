# Development

Requires Node 22+. `npm run dev` / `npm run build` first fetch the WebLLM model libraries into
`public/models/` (gitignored), so the app serves them itself.

## Code map

| Path            | What                                                                                         |
| --------------- | -------------------------------------------------------------------------------------------- |
| `src/ai/`       | AI tiers: Prompt API → WebLLM (Web Worker) → unsupported. Priority queue, Zod-validated JSON |
| `src/engine/`   | The simulation: personas, engagement planner, scheduler, living feed, first-run setup        |
| `src/db/`       | Dexie schema and data actions (everything lives in IndexedDB)                                |
| `src/features/` | Screens, one folder each                                                                     |
| `src/lib/`      | Helpers: backup, usage tracking, analytics, time ago, …                                      |
| `scripts/`      | Asset scripts (model libraries, sounds, photo pack)                                          |

## Rules

- **No data leaves the device.** Allowed hosts: same origin, Hugging Face (model weights), Google
  Analytics (page views, route patterns only). Copy CDN assets into `public/` instead of fetching
  them.
- **Hard caps:** 1,000,000 likes and 100 comments per post (`src/engine/limits.ts`).
- **All AI calls** go through `src/ai` and validate their output with Zod.
- **Database changes:** add a new Dexie version; never edit a shipped one.
- **Mock model:** exists only in the e2e build (`npm run build:e2e`, `VITE_MOCK_AI=1`). The app has
  no non-AI mode.

## Testing

- `npm test`: Vitest in Node with `fake-indexeddb`. Clear the DB in `beforeEach`.
- `npm run test:e2e`: Playwright against the mock-model build.
- The mock can't judge real output quality, so try prompt changes in a real browser.

## Deploy

Pushing to `main` runs `.github/workflows/deploy.yml`: lint, test, build, then deploy to GitHub
Pages at https://face.mangoidiots.com (custom domain set in the repo's Pages settings; Cloudflare
DNS `CNAME face → venkatarangan.github.io`). Set the optional Actions variable `GA_ID` (`G-…`) to
enable analytics.
