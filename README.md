<p align="center">
  <img src="public/logo.svg" alt="" width="96" height="96" />
</p>

<h1 align="center">FaceMango</h1>

<p align="center"><strong>A social network that is entirely yours.</strong><br />
Your posts, photos and friends live only on your device. Every friend, like and comment is simulated by AI running in your browser.</p>

<p align="center"><a href="https://face.mangoidiots.com">face.mangoidiots.com</a></p>

---

FaceMango is a private, single-player, Facebook-style feed in the spirit of
[dopamine sites](https://en.wikipedia.org/wiki/Dopamine_sites). There is no backend: all data
lives in IndexedDB, and the AI runs on the device (Chrome/Edge Prompt API, or WebLLM on WebGPU).

See [`SPEC.md`](SPEC.md) for the full specification and milestones.

## Status

**M1 Skeleton**: app shell, theme, logo, landing page, signup, local database, PWA, tests and CI.
AI, the feed and the simulation engine arrive in M2–M7.

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

| Command             | What it does                                            |
| ------------------- | ------------------------------------------------------- |
| `npm test`          | Unit and component tests (Vitest + Testing Library)     |
| `npm run test:e2e`  | End-to-end tests (Playwright: desktop, Android, iPhone) |
| `npm run lint`      | ESLint                                                  |
| `npm run format`    | Prettier                                                |
| `npm run typecheck` | TypeScript (strict)                                     |
| `npm run icons`     | Regenerate PWA icons from `public/logo.svg`             |

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

GitHub Actions builds, tests and deploys `main` to GitHub Pages. The custom domain comes from
`public/CNAME`; Cloudflare DNS points `face` at `<account>.github.io`. The CSP ships as a `<meta>`
tag (GitHub Pages can't set headers), and `404.html` is a copy of `index.html` so deep links work.

## Licence

[GNU AGPL-3.0](LICENSE). Friends on FaceMango are simulated, not real people. You must be 13 or
older to use it.
