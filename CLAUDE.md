# CLAUDE.md — FaceMango

Handover notes for Claude Code sessions. `SPEC.md` is the product spec; `docs/DEVELOPMENT.md` has the code map and rules; `docs/STATUS.md` has open items.

## What this is
**FaceMango**: a private, single-player, Facebook-style "dopamine site". Every friend, like and comment is simulated by **AI running on the user's device**. All data stays in the browser (IndexedDB). No backend.
- **Uniqueness (use this message):** unlike other feel-good apps, the data and the AI models are entirely local; nothing leaves unless the user exports it (`UNIQUENESS` in `src/lib/copy.ts`).
- **Byline:** "The most personal social network ever built. And the most private." (`BYLINE`)
- **Live site:** https://face.mangoidiots.com · **Repo:** https://github.com/venkatarangan/facemango (public, AGPL-3.0)
- **Owner:** Venkatarangan (GitHub `venkatarangan`). Original brief: `input.txt`.

## Status (2026-10-03)
- **Built:** M1–M7 from SPEC §10. M8 (realistic on-device faces) not started.
- **Published and live over HTTPS:** pushing to `main` runs CI (lint, unit, e2e on Chrome/Android/iPhone) and deploys to GitHub Pages. See "Deployment" below.
- **Real-model test (owner, Qwen3 on WebGPU):** friends, posts with photos, likes, comments and Activity worked. Mango AI (chat + composer) failed. It now falls back from streaming to a single reply and shows the error. **Re-test pending**; ask the owner for the error from Settings → On-device AI if it still fails.
- **Open items:**
  - GA id (Actions variable `GA_ID`)
  - photo pack 87/~250
  - parked "setup experience" for the first-run wait (in memory: `setup-experience-idea`)
  - optional: remove the owner's Gmail address from git history (it was in older versions of this file)

## Working agreements
- **Commits:** only when the owner asks. Work on `main` (or a short branch). The old milestone branches (`m1-skeleton`, `m2-m4`, `m5-m7`) are local-only history.
- **Pushing:** pushing to `main` deploys the live site; make sure tests pass first.
- **Answers:** concise, leading with a recommendation. Ask only about real product decisions; after a go-ahead, proceed without process questions.
- **Docs and UI copy:** short. End users get friendly explanations; developer docs stay brief, since developers use AI agents to read the code.
- **Libraries:** the best open-source ones, AGPL-3.0-compatible licences only.

## Deployment
- **Pages:** build type "GitHub Actions"; custom domain `face.mangoidiots.com` is set through the Pages API/settings. The `public/CNAME` file is for reference only; Actions-based Pages ignores it.
- **DNS (Cloudflare, managed by the owner):** `CNAME face → venkatarangan.github.io`, DNS only (grey cloud). CAA allows Let's Encrypt.
- **HTTPS:** a Let's Encrypt certificate issued by GitHub, renewed automatically (current one expires 2027-01-01). "Enforce HTTPS" is on.
  - If a certificate ever gets stuck, remove and re-add the custom domain (`gh api -X PUT repos/venkatarangan/facemango/pages -f cname=…`).
- **Deep links** (e.g. `/about`) are served from `404.html`, so they return HTTP 404 but render normally. This is expected on GitHub Pages.
- **Checking a deploy:** `gh run list -R venkatarangan/facemango`, then `gh run watch <id>`.

## Key decisions
| Topic | Decision |
|---|---|
| Stack | Vite 8, React 19, TypeScript 6 (strict), MUI v9, Dexie, Zustand, Motion, Vitest, Playwright |
| AI tiers | Prompt API (Chrome/Edge) → WebLLM on WebGPU (Qwen3-1.7B desktop, Gemma-3-1B phones, q4f32 fallbacks) → Unsupported screen. **No non-AI mode.** |
| Third parties | Only Hugging Face (model weights) and Google Analytics (page views, route patterns, EU/UK consent). CDN assets are self-hosted via `npm run models`. |
| Engagement | Comments 0–9 by default (cap 100); likes = comments × 3–5 (cap 1,000,000); mix Good 60 / Appreciative 25 / Nonsense 10 / Critical 5 / Super-critical 0; ≤2 critical per post; Super-critical off for under-18s |
| Friends | 25 by default + 2× public profiles; reset keeps old likes and comments under "former friends" |
| Backup | Zip of me.md, friends.md, feed.md, wellbeing.md (YAML front-matter) + images/ + avatars/; restore "everything" or "my content + new friends" |
| iOS | Data-loss warning on the landing page and at signup; banner every 7 days in a non-installed tab; weekly backup reminders on by default |
| Colours | White, `#FFC400` accent, `#111111` text; yellow text `#8A6A00` (body) / `#B28900` (large only) |
| Avatars / photos | DiceBear "Personas" (CC BY 4.0); CC0/PD photo pack, family-friendly, no identifiable faces or children |

## Engineering rules
- Hard caps: likes ≤ 1,000,000 and comments ≤ 100 per post (`src/engine/limits.ts`, tested).
- User content and wellbeing data never go over the network.
- All AI calls go through `src/ai` (priority queue; Zod-validated JSON with retries).
- Never edit a shipped Dexie version; add a new one (currently v2).
- The mock model exists only in the e2e build (`VITE_MOCK_AI=1`, `dist-e2e/`).
- Keep `SPEC.md`, `CLAUDE.md` and `input.txt` out of Prettier.
- Lint follows React Compiler rules: no `Date.now()` or ref reads during render (use `useNow()`).

## Environment
- Repo: `C:\DevTemp\facemango` = `/mnt/c/devtemp/facemango`. Use WSL (Node 22); the Windows host has no Node.
- `/mnt/c` is slow: `npm install` takes ~4 min, Vitest ~90 s. Vitest uses 3 reused threads; clear the DB in `beforeEach`.
- Test the real AI in Chrome/Edge on Windows at http://localhost:5173 (`npm run dev` in WSL). This environment has no GPU.
- Playwright WebKit (iPhone project) passes in CI; running it locally needs `sudo npx playwright install-deps webkit`.
- `gh` CLI is logged in as `venkatarangan` (repo + workflow scopes).
