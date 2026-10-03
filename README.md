<p align="center">
  <img src="public/logo.svg" alt="" width="96" height="96" />
</p>

<h1 align="center">FaceMango</h1>

<p align="center"><strong>The most personal social network ever built. And the most private.</strong><br />
Your posts, photos and friends live only on your device. Every friend, like and comment is simulated by AI running in your browser.</p>

<p align="center"><a href="https://face.mangoidiots.com">face.mangoidiots.com</a></p>

---

FaceMango is a private, single-player, Facebook-style feed in the spirit of
[dopamine sites](https://en.wikipedia.org/wiki/Dopamine_sites). There is no backend: all data
lives in IndexedDB, and the AI runs on the device (Chrome/Edge Prompt API, or WebLLM on WebGPU).

See [`SPEC.md`](SPEC.md) for the full specification and milestones.

## Documentation

- [`SPEC.md`](SPEC.md): product specification and milestones
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): how the app, AI layer, engine and data fit together
- [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md): setup, scripts, testing and gotchas
- [`docs/STATUS.md`](docs/STATUS.md): milestone status, open items and decisions
- [`CHANGELOG.md`](CHANGELOG.md): what changed in each milestone

## Status

**M1–M7 built** (not yet deployed): on-device AI (Prompt API / WebLLM), feed with posts, reactions and comments, the simulation engine, profiles, Mango AI chat, Memories, Photos, Wellbeing, backup/restore and all engagement features. See [`docs/STATUS.md`](docs/STATUS.md) and [`CHANGELOG.md`](CHANGELOG.md).

## Privacy

Your posts, photos, friends, comments and wellbeing stats are stored only in this browser on this
device. FaceMango has no servers and no accounts, and never uploads your content. To run AI on your
device, FaceMango downloads an AI model, either through your browser (Chrome/Edge) or from Hugging
Face. Google Analytics counts page views only. It never sees your posts, profile or usage stats.

## Development

Requires Node.js 22+.

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # type-check + production build into dist/
npm run preview      # serve dist/ locally
```

| Command             | What it does                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------- |
| `npm test`          | Unit and component tests (Vitest + Testing Library)                                         |
| `npm run test:e2e`  | End-to-end tests (Playwright: desktop, Android, iPhone)                                     |
| `npm run lint`      | ESLint                                                                                      |
| `npm run format`    | Prettier                                                                                    |
| `npm run typecheck` | TypeScript (strict)                                                                         |
| `npm run icons`     | Regenerate PWA icons from `public/logo.svg`                                                 |
| `npm run models`    | Fetch WebLLM model libraries and copy runtime assets into `public/` (runs before dev/build) |
| `npm run build:e2e` | Test build with a mock model into `dist-e2e/` (used by Playwright; never deployed)          |

First-time Playwright setup: `npx playwright install --with-deps chromium webkit`.

### Stack

Vite · React 19 · TypeScript · MUI · Motion · React Router · Zustand · Dexie (IndexedDB) ·
React Hook Form + Zod · vite-plugin-pwa · Vitest · Playwright.

### Layout

```
src/
  app/        routes, responsive shell, theme, tokens
  features/   onboarding, feed, settings, about, … (one folder per section)
  engine/     simulation config and hard limits
  ai/         AIProvider interface (implementations in M2)
  db/         Dexie schema, types and helpers
  lib/        platform detection, storage, imaging, copy
e2e/          Playwright tests
```

## Deployment

GitHub Actions (`.github/workflows/deploy.yml`) lints, type-checks, tests (unit + Playwright), builds and deploys `main` to GitHub Pages.

One-time setup once the GitHub repo exists:

1. **Pages:** Settings → Pages → Source: **GitHub Actions**. Custom domain: `face.mangoidiots.com` (also in `public/CNAME`). Tick **Enforce HTTPS** once the certificate is issued.
2. **Cloudflare DNS:** add `CNAME face → <account>.github.io`, **DNS only** (grey cloud) while GitHub issues the certificate. You can turn the proxy on afterwards if you want.
3. **Google Analytics (optional):** Settings → Secrets and variables → Actions → Variables → `GA_ID` = your `G-…` id. Without it, no analytics code loads. EU/UK visitors are asked for consent first. Only page views with route patterns (`/post/:id`) are sent.

Notes:

- The CSP ships as a `<meta>` tag (GitHub Pages can't set headers). Allowed outside hosts: Hugging Face (model weights) and Google Analytics/Tag Manager.
- `404.html` is a copy of `index.html`, so deep links work.
- `npm run build` first runs `npm run models`, which downloads the WebLLM model libraries into `public/models/` and copies the Lottie player, so they're served from our own origin.

## Licence

[GNU AGPL-3.0](LICENSE). Friends on FaceMango are simulated, not real people. You must be 13 or
older to use it.
