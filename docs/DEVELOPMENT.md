# Development guide

## Setup

FaceMango needs Node.js 22 or later. On this machine, work from WSL; the Windows host has no
Node.js.

```bash
npm install
npm run dev          # http://localhost:5173 (also reachable from Windows browsers)
```

`npm run dev` and `npm run build` first run `npm run models`, which:

- downloads the WebLLM model libraries (~22 MB of `.wasm`) into `public/models/`
- copies the dotLottie player into `public/emoji/`

Both locations are gitignored.

## Trying the real AI

- **Chrome or Edge on desktop:** uses the built-in model (Prompt API) if the browser offers one;
  otherwise it downloads Qwen3-1.7B (about 1 GB) once.
- **Phones:** use WebGPU with Gemma-3-1B (iOS 26+ Safari, Android Chrome).
- **Firefox or older browsers** without WebGPU show the Unsupported screen.

First-run setup on a real model takes a few minutes: 25 friends, 50 public profiles and 15–25
starter posts. Progress shows on the Home screen.

**Reset for a fresh start:** Settings → Delete all FaceMango data. To delete the downloaded model
(WebGPU tier), use Settings → On-device AI.

## Scripts

| Command                                                 | What it does                                                        |
| ------------------------------------------------------- | ------------------------------------------------------------------- |
| `npm run dev`                                           | Dev server                                                          |
| `npm run build`                                         | Type-check and production build into `dist/`                        |
| `npm run build:e2e`                                     | Test build with the mock model into `dist-e2e/` (never deployed)    |
| `npm run preview`                                       | Serve `dist/`                                                       |
| `npm test`                                              | Unit and component tests (Vitest)                                   |
| `npm run test:e2e`                                      | Playwright on desktop Chrome, Android (Pixel 7) and iPhone (WebKit) |
| `npm run lint` / `npm run format` / `npm run typecheck` | ESLint, Prettier, TypeScript                                        |
| `npm run icons`                                         | Regenerate the PWA icons from `public/logo.svg`                     |
| `node scripts/generate-sounds.mjs`                      | Regenerate the UI sounds in `public/sounds/`                        |
| `scripts/photos/*`                                      | Photo-pack curation (see `scripts/photos/README.md`)                |

## Testing

### Unit tests (Vitest)

- Tests run in Node by default with `fake-indexeddb`.
- Component tests opt into `happy-dom` with a `// @vitest-environment happy-dom` docblock.
- Workers are reused (`isolate: false`, 3 threads): on `/mnt/c`, starting many workers otherwise
  hits Vitest's hard-coded 60 s start timeout.
- Consequence: tests share module state, so **clear the database in `beforeEach`**.
- `src/engine/engine.test.ts` runs the whole pipeline with the mock model.

### End-to-end tests (Playwright)

- They use the mock-model build (`.env.e2e` sets `VITE_MOCK_AI=1`, and engagement runs 60×
  faster).
- Local runs use 3 workers.
- WebKit needs system libraries in WSL: `sudo npx playwright install-deps webkit`. CI installs them
  with `--with-deps`.

### What the mock can't tell you

Real-model quality, speed, memory use and browser quirks. Always try changes to prompts or AI
code in a real browser.

## Gotchas

- **Formatting:** keep `SPEC.md`, `CLAUDE.md` and `input.txt` out of Prettier (they are in
  `.prettierignore`).
- **No CDN fetches:** never let a library fetch from a CDN at runtime. Copy the asset into
  `public/` via `scripts/copy-assets.mjs`, because the CSP blocks it otherwise.
- **Database schema:** never edit a shipped Dexie version; add `this.version(n + 1)`.
- **Lint rules:** React Compiler lint rules apply. Don't call `Date.now()` or read refs during
  render; use `useNow()` (`src/lib/useNow.ts`) for time-based UI.
- **Fast refresh:** component files should only export components; put helpers in `src/lib/` or
  next to the engine code.
- **Speed:** `/mnt/c` is slow for `node_modules`. Moving the repo into the WSL filesystem makes
  installs and tests much faster.

## Branches and commits

- `main` doesn't exist yet. Milestones are stacked branches: `m1-skeleton` → `m2-m4` → `m5-m7`.
- Commit only when the owner asks.
- Don't create the GitHub repo or push until the owner approves the local build.
