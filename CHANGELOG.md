# Changelog

All notable changes to FaceMango. Milestones follow [`SPEC.md`](SPEC.md) §10.
Nothing has been released or deployed yet; every milestone below lives on local branches.

## M7: Engagement features and polish (2026-10-03)

Commit `f9b4dd6` on `m5-m7`.

### Added

- **Micro-celebrations:** confetti, a chime, a toast and a milestone notification when a post
  reaches 10, 25, 50, 100, … reactions, and on the very first reaction.
- **UI sounds:** original synthesised `pop`, `ping` and `chime` (`scripts/generate-sounds.mjs`),
  played with Howler. Can be turned off in Settings.
- **Pushback:** when a critic comments on your post, a fan friend may defend you.
- **Personal callbacks:** comments sometimes refer back to your earlier posts.
- **Friend requests** from public profiles, with Confirm/Delete on the Friends page.
- **Daily post idea** from Mango AI as a feed card, with "Write about this".
- **Posting streak** chip (🔥) and a "best post this week" card.
- **Local system notifications** (opt-in) while FaceMango is in the background. No push server.
- **iOS banner** in a non-installed Safari tab, at most every 7 days.
- **Weekly backup reminders**, on by default on iOS.
- **Install button** (Android/desktop), and a skip-to-content link.
- **Google Analytics hook:** page views only, route patterns without ids, EU/UK consent banner.
  Loads only when `VITE_GA_ID` is set.
- Deployment steps in the README.

### Changed

- Backup and restore code is lazy-loaded (main bundle 698 kB / 222 kB gzip).

## M6: Config and backup (2026-10-03)

Commit `5dfcc4f` on `m5-m7`.

### Added

- **Advanced settings** (`/settings/advanced`):
  - circle size, public-profile multiplier, gender/city/language/stance mixes
  - comments per post, likes per comment, minimum likes, comment variety, most critical comments
    per post, speed presets
  - mix sliders always add up to 100; super-critical comments are locked for under-18s
- **Full backup** zip: `me.md`, `friends.md`, `feed.md`, `wellbeing.md` (one YAML front-matter
  block per record, plus readable text), `images/` and `avatars/`.
- **Restore** from Settings or the welcome screen: "Restore everything" or "Restore my content +
  new friends".
- **Friends reset:** the current circle becomes read-only former friends (their likes and comments
  stay), their planned events are cancelled, and a new circle is generated.

## M5: Sections (2026-10-03)

Commit `5968595` on `m5-m7`.

### Added

- **Profile pages:** the AI writes each friend's profile on the first visit, then it is cached.
  Includes a cover photo from the pack. You can edit your own profile.
- **Mango AI chat:** streamed replies, quick actions (write a post, make my last post funnier,
  summarise reactions, what's trending, post idea), "Use as post". History is kept on the device
  (Dexie schema v2).
- **Memories:** on this day (1 week, 1 month, 1–5 years), friendversaries, your first post,
  milestones, your best post.
- **Activity:** notifications plus a filterable log of your own posts, comments and reactions.
- **Photos:** masonry grid with a swipe and pinch-zoom lightbox.
- **Wellbeing:**
  - on-device usage tracking, today and this week, a 30-day trend
  - weekday × hour heatmap with late-night use highlighted, activity stats
  - mood check-ins and a chart
  - optional daily goal ring with one gentle reminder a day
  - Monday summary card in the feed

## M2–M4: AI layer, feed core and engine (2026-10-03)

Commit `975fd2a` on `m2-m4`.

### Added

- **AI tiers:** Prompt API (Chrome Gemini Nano / Edge Phi-4-mini), then WebLLM on WebGPU in a
  Web Worker, otherwise the Unsupported screen.
  - Models: Qwen3-1.7B on desktop, Gemma-3-1B on phones, with q4f32 fallbacks.
  - Model libraries are served from our own origin.
- **AI plumbing:** a priority queue (interactive before background); all JSON is validated with
  Zod, with retries and a prompt-only fallback.
- **Feed:**
  - composer with one WebP photo, feeling, @mentions and Mango AI rewrite
  - virtualised feed with stable ordering
  - seven reactions with animated Noto emoji
  - comments with one level of replies, edit/delete, live "time ago"
- **Engine:**
  - personas built from the config mixes, with AI-written details and DiceBear avatars
  - engagement planner within the hard caps
  - scheduler: just-in-time comments, typing indicators, replies, "While you were away"
  - notifications and badges, a living feed, resumable first-run setup
- **Photo pack v1:** 87 CC0/public-domain photos, plus a Credits page.
- **Byline:** "The most personal social network ever built. And the most private."

## M1: Skeleton (2026-10-03)

Commit `5e1c4c4` on `m1-skeleton`.

### Added

- **Stack:** Vite 8, React 19, TypeScript 6 (strict), MUI v9.
- **Brand:** new logo (a mango that doubles as a speech bubble), theme and tokens with WCAG AA
  contrast rules.
- **Shell:** 3 columns on desktop, 2 on tablet, bottom navigation on phones.
- **Onboarding:**
  - landing page with the iOS 7-day data-loss notice and an Add to Home Screen guide
  - signup: Name, Age 13+, City, Languages, optional photo, required data notice
- **Data:** Dexie schema with every table from SPEC §6.3.
- **PWA and hosting:** PWA with update prompt, build-only CSP `<meta>`, `404.html` fallback,
  `CNAME`.
- **Tooling:** Vitest, Playwright, ESLint, Prettier, GitHub Actions workflow.
