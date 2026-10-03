# CLAUDE.md — FaceMango

Project context and working rules for Claude Code. **Read `SPEC.md` first.** It is the approved v1.0 specification and the source of truth for features, architecture and the library stack. This file records the decisions behind it, the working agreements, and where we are.

## What this is
**FaceMango**: a private, single-player, Facebook-style "dopamine site" (see Wikipedia "Dopamine sites", foodnevercomes.com). Every friend, like and comment is simulated by **local, on-device AI**. All data stays in the browser (IndexedDB). There is no backend.
- Production URL: **https://face.mangoidiots.com** (GitHub Pages; DNS on Cloudflare)
- Licence: **AGPL-3.0**, open source
- Owner: Venkatarangan (venkatarangan@gmail.com)
- Original brief: `input.txt`

## Current status (as of 2026-10-03)
- ✅ **M0 Spec approved**: `SPEC.md` v1.0.
- 🟡 **M1 Skeleton built, awaiting the user's review** on branch `m1-skeleton` (committed; `main` not created yet). Lint, typecheck, Prettier, 34 Vitest tests and 6 Playwright tests (desktop Chrome + Android) pass; the production build works.
  - Done: local git repo, Vite 8 + React 19 + TS 6 (strict) + MUI v9, theme/tokens, new logo (`public/logo.svg`, mango + speech-bubble tail) + generated PWA icons, responsive shell (3-col / 2-col / bottom nav), Dexie schema v1 (all SPEC §6.3 tables), landing page with iOS notice + Add to Home Screen guide, signup (Name, Age 13+, City, Languages, optional photo, required data-notice checkbox), Settings (persistent-storage status, delete all data), About/privacy, placeholder pages for M2–M5 sections, PWA with update prompt, build-only CSP `<meta>`, `404.html` SPA fallback, `CNAME`, GitHub Actions workflow, README, LICENSE.
  - Not yet verified locally: the Playwright iPhone (WebKit) project, which needs `sudo npx playwright install-deps webkit`. CI installs these deps itself.
- ⏭️ **Next: M2 AI layer** (once the user okays M1). Then the GitHub repo + push, but only after the user approves.
- Milestones M1–M8 are in `SPEC.md` §10.

## Working agreements (from the user)
- **Git:** the **local** repo `facemango` exists (`main` not created yet; M1 is committed on `m1-skeleton`). **Do NOT create the GitHub repo or push until the user has checked and okayed the local build.** The user will give GitHub access at that point. The GitHub repo name is also `facemango`.
- Commit only when the user asks. Branch off the default branch for work.
- Use the **best open-source frameworks, libraries and tools** available to make the UI/UX as attractive and engaging as possible. Licences must be AGPL-3.0-compatible (MIT/Apache/BSD/ISC/CC0/CC BY are fine).
- The user prefers concise answers that lead with a recommendation. They like being asked clarifying questions for real decisions.

## Key decisions (Q&A log)
| Topic | Decision |
|---|---|
| Name / domain | FaceMango · face.mangoidiots.com |
| Logo | **Design a new one**: elegant, modern, mango-related, same colour scheme (white bg, mango-yellow accent, black text). Not based on the existing Mangoidiots mark. M1 draft: mango body that doubles as a chat bubble, black leaf. |
| Colours | White `#FFFFFF` bg, surfaces `#FAFAFA`, accent `#FFC400`, text `#111111`. Yellow on white: `#B28900` (3.3:1) only for large text, icons and UI parts; `#8A6A00` (5:1) for body-size text. See `src/app/tokens.ts`. |
| UI | Material UI (**MUI v9**: spec said v7, but v9 was current at M1). Must work well on PC, Mac, iPhone and Android. PWA. |
| AI tiers | 1) Prompt API (Chrome Gemini Nano / Edge Phi-4-mini), 2) WebGPU via WebLLM with a small Qwen3/Gemma-3 model, 3) Unsupported screen. **No non-AI "Lite mode". The app works only with local AI.** Phones always use WebGPU (fine). |
| iOS data loss | Safari may wipe data after 7 days unused. **Warn clearly on the landing/home page AND during signup** (required "I understand"), plus the Add to Home Screen guide and backup reminders. |
| Third parties | **Google Analytics (page views only; the user supplies the tag later) and Hugging Face model downloads are acceptable.** Privacy text, docs and CSP must say so honestly. User content is never sent over the network. |
| Friends | 20–30 friends (configurable). Mixes are configurable: gender, same/other city, shared/unknown languages, fan/neutral/critic stance. |
| Public profiles | Default **2× the friend count**, configurable. They supply reach: likes, some comments, friend requests. |
| Likes | **Likes = comments × random 3×–5×** per post (configurable), with a minimum-likes floor. Hard cap **1,000,000** likes per post. |
| Comments | Default band 0–9 (single digits), configurable. Hard cap **100**. Mix: Good 60 / Appreciative 25 / Nonsense 10 / Critical 5 / Super-critical 0 (%), configurable. At most 1–2 critical by default. Never abusive. |
| Engagement engine | Pre-planned event timeline per post in IndexedDB. Catch-up on reopen ("While you were away…"). |
| Engagement ideas | **All 14 in SPEC §8 are approved for v1** (variable rewards, typing indicators, reply-backs, photo-aware comments, confetti, streaks, etc.). |
| Backup | **Full backup**: me.md, friends.md, feed.md, wellbeing.md + images/ + avatars/ in a zip, with YAML front-matter. Restore: "everything" or "my content + new friends". |
| Friends reset | Available any time and on import. **Old friends' existing likes/comments are kept as-is under the old names.** Old personas become read-only "former friends", and their future planned events are cancelled. |
| Faces | **Approved:** v1 = AI-directed illustrated avatars (DiceBear, local SVG); v1.1 = opt-in realistic on-device faces (SD-Turbo-class via ONNX Runtime Web, desktop only). |
| Friend post photos | **Approved:** a bundled pack of CC0/public-domain photos (~250, WebP), mixed across regions worldwide and many themes, **family-friendly**, no close-up identifiable faces, no identifiable children. Lazy-loaded, with a manifest (tags, region, alt text, source, licence) and an in-app Credits page. |
| Assistant | **"Mango AI"** (Meta-AI-like) |
| Wellbeing | Instead of a "30-minute" nag: a **usage tracker in the style of a mental-health tracker** (time spent, heatmap, activity, optional mood check-in, daily goal ring, weekly summary). Local only, never sent to analytics. |
| Languages | v1 English only for posts/comments. Tamil and others later, depending on model support. |
| Age | 13+ gate. Under-18s: Super-critical comments disabled. |
| Hosting | GitHub Pages (via GitHub Actions) + Cloudflare DNS CNAME `face` → `<account>.github.io`. CSP via `<meta>`. SPA `404.html` fallback. |

## Engineering rules
- Hard invariants (enforce in code and tests): likes ≤ 1,000,000, comments ≤ 100 per post (`src/engine/limits.ts`). User content and wellbeing data are never sent over the network.
- All AI calls go through the `AIProvider` interface (`src/ai/provider.ts`) and run in a Web Worker priority queue. The UI never blocks on the model.
- Validate all AI JSON output with Zod and retry if malformed.
- Store images as Blobs in IndexedDB. Compress user photos to WebP on the device.
- Respect `prefers-reduced-motion`. Meet WCAG AA contrast (see the Colours row; `src/app/theme.test.ts` enforces it).
- Follow the module layout in SPEC §6.2.
- Never edit a shipped Dexie version; add a new `this.version(n)` instead.
- CSP lives in `vite.config.ts` (build only). M2 must add any extra hosts WebLLM needs (e.g. its model-library wasm host) or self-host those files.
- `SPEC.md`, `CLAUDE.md` and `input.txt` are excluded from Prettier; keep their hand formatting.

## Environment notes
- The repo lives at `C:\DevTemp\facemango` (`/mnt/c/devtemp/facemango` in WSL). The Windows host has no Node.js; use WSL (Node 22).
- `/mnt/c` is slow for `node_modules` (npm install took ~4 min, Vitest ~75 s). Expect that, or move the repo into the WSL filesystem.
- Playwright WebKit needs `sudo npx playwright install-deps webkit` in WSL.
