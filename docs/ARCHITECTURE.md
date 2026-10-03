# Architecture

FaceMango is a static single-page app. There is no backend: the UI, the AI model and all data run
inside the browser. This document explains how the pieces fit together. For _what_ the product
does, see [`SPEC.md`](../SPEC.md).

## Big picture

```
┌──────────────────────────── Browser ────────────────────────────┐
│  React UI (src/features, src/app)                               │
│     │ live queries (dexie-react-hooks)      ▲ zustand stores     │
│     ▼                                       │ (AI status, typing,│
│  IndexedDB via Dexie (src/db)  ◀──────────  │  celebrations)     │
│     ▲                                       │                    │
│     │ reads/writes                          │                    │
│  Engine (src/engine): setup · planner · scheduler · living feed  │
│     │ prompts + Zod schemas                                      │
│     ▼                                                            │
│  AI service (src/ai): priority queue → provider                  │
│     ├─ Prompt API (built-in model, Chrome/Edge)                  │
│     └─ WebLLM in a Web Worker (WebGPU)                           │
└──────────────────────────────────────────────────────────────────┘
Network: same origin · Hugging Face (model weights) · Google Analytics (page views, optional)
```

## Modules

| Folder          | Responsibility                                                                                                                                                               |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/`      | Routes, root layout, guards, responsive shell (top bar, nav, right rail, bottom nav), theme and brand tokens                                                                 |
| `src/features/` | One folder per screen or section: onboarding, feed, compose, profile, friends, assistant, memories, activity, photos, wellbeing, settings, backup, credits, ai, celebrations |
| `src/engine/`   | The simulation: personas, planner, scheduler, friend posts, onboarding setup, reset, memories, celebrations, prompts, config and limits                                      |
| `src/ai/`       | The `AIProvider` interface, tier detection, providers, priority queue, JSON validation, test-only mock                                                                       |
| `src/db/`       | Dexie schema and migrations, record types, data actions (profile, posts, comments, reactions)                                                                                |
| `src/lib/`      | Pure helpers and browser glue: time ago, imaging, platform, storage, usage tracking, wellbeing stats, backup, analytics, sounds, notifications, install prompt               |
| `public/`       | Logo and PWA icons, the photo pack (`photos/`), emoji animations (`emoji/`), sounds                                                                                          |
| `scripts/`      | Asset scripts: model libraries, CDN asset copy, sounds, photo-pack curation                                                                                                  |

## Data model (IndexedDB, `src/db/db.ts`)

| Table                    | Contents                                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `profile`                | The single user record (`id: 'me'`)                                                                                       |
| `personas`               | Friends, public profiles and former friends (`kind`), with avatar traits, cached profile details and friend-request state |
| `posts`                  | All posts, with aggregate `reactionCounts`, `commentCount` and the planned totals                                         |
| `comments`               | Comments and one level of replies (`parentId`)                                                                            |
| `reactions`              | Named reactions (user and personas); anonymous "others" live only in the aggregates                                       |
| `events`                 | The pre-planned engagement timeline (`planned` / `applied` / `cancelled`, indexed by `[status+dueAt]`)                    |
| `notifications`          | Activity items (`read` is 0/1, because IndexedDB can't index booleans)                                                    |
| `media`                  | User photos as Blobs (WebP)                                                                                               |
| `usageSessions`, `moods` | Wellbeing data                                                                                                            |
| `settings`, `meta`       | Key/value config and engine state (setup progress, last backup, dismissed cards …)                                        |
| `chat`                   | Mango AI chat history (added in schema v2)                                                                                |

**Migrations:** never edit a shipped `this.version(n)`; add a new version.

## AI layer (`src/ai/`)

1. **Detection** (`detect.ts`):
   - Desktop browsers try the Prompt API first (`LanguageModel.availability()`).
   - Otherwise WebGPU: `navigator.gpu.requestAdapter()`, then a model choice based on device class
     and `shader-f16` support.
   - Otherwise the browser is unsupported.
2. **Providers** implement `AIProvider` (`generate`, `generateJSON`, `stream`, `describeImage?`):
   - `promptApi.ts` creates a short-lived session per call. A download needs a user gesture.
   - `webllm.ts` runs `@mlc-ai/web-llm` inside `webllm.worker.ts`.
     - Qwen3's "thinking" is disabled.
     - Gemma gets its system prompt merged into the user turn.
3. **Queue** (`queue.ts`): one generation at a time. `interactive` work (Mango AI, composer,
   profile pages) jumps ahead of `background` work (comments, friends, living feed).
4. **JSON** (`json.ts`):
   - Zod schema → JSON Schema → `responseConstraint` (Prompt API) or
     `response_format.schema` (WebLLM).
   - Output is parsed, validated and retried up to 3 times, with the validation error fed back.
   - If a backend rejects the schema, it falls back to prompt-only JSON.
5. **Service** (`service.ts`): a zustand store (`status`, `tier`, `progress`) drives the UI.
   `startAI()` is idempotent; `whenAIReady()` lets the engine wait for a model.

**Self-hosting:**

- `scripts/fetch-model-libs.mjs` downloads the WebLLM `.wasm` model libraries into
  `public/models/`.
- `scripts/copy-assets.mjs` copies the dotLottie player.

This keeps the only outside hosts at Hugging Face (weights) and Google Analytics.

## Engine (`src/engine/`)

### First-run setup (`onboarding.ts`)

Steps: friends → public profiles → 15–25 back-dated seed posts.

- It is resumable: each step tops up what is already stored.
- Progress goes to `useEngineStore().setup` for the setup card.

### Personas (`personas.ts`)

- The config mixes decide gender, place (same city / same country / abroad), shared language and
  stance (fan / neutral / critic).
- The AI fills in names, occupations, interests, writing style, birthday and appearance, in batches
  of 4 (friends) or 8 (public profiles).
- Appearance maps to DiceBear "Personas" options (`avatar.ts`).
- Adults only get adult friends.

### Engagement planner (`planner.ts`, pure, heavily tested)

When a post is created:

1. **Comments:** C comes from the band (log-normal, skewed low), capped at 100.
2. **Likes:** L = max(minLikes, C × m) with m ∈ [min, max], capped at 1,000,000.
3. **Who comments:** mentioned friends always comment, early. The rest are sampled, weighted by
   closeness and activity.
4. **Comment type:** from the comment mix, nudged by stance. Critical comments are limited to
   `maxCriticalPerPost`. Super-critical is never used for under-18s.
5. **Likes:** named likes come from friends and public profiles. Anonymous "others" are grouped
   into at most 24 events, each carrying a count.
6. **Timing:** front-loaded and truncated-exponential, with bursts around hotspots, compressed by
   `speed`.

### Scheduler (`scheduler.ts`)

A loop that:

- applies due reactions in transactions
- shows typing indicators about 20 s before a planned comment
- writes due comments just in time, in batches of up to 4 per post (user posts first; friends'
  posts only after setup)
- notifies on user posts, and checks milestones (`celebrations.ts`)
- plans pushback from fans, posts the living feed (`friendPosts.ts`) and sends occasional friend
  requests

On start it summarises past-due events as "While you were away".

### Other engine modules

- **`reset.ts`:** turns the circle into former friends, cancels their planned events and re-runs
  setup.
- **`memories.ts`, `assistant.ts`, `dailyIdea.ts`, `profiles.ts`:** prompt builders and pure logic
  for the M5/M7 sections.

## Privacy rules (enforced in code)

- **User content and wellbeing data never leave the device.**
  - The only network calls are to the same origin, Hugging Face (weights) and, optionally, Google
    Analytics.
  - GA gets only route patterns (`/post/:id`), never ids or text.
- **The CSP** is a `<meta>` tag added at build time (`vite.config.ts`).
- **Backups** are generated and downloaded locally; restores are read locally.
- **The mock AI provider** (`src/ai/mockProvider.ts`) exists only in the `dist-e2e` test build
  (`VITE_MOCK_AI=1`). The app has no non-AI mode.

## UI conventions

- **Library:** MUI v9 with the theme in `src/app/theme.ts` and tokens in `src/app/tokens.ts`.
- **Yellow text on white:**
  - `#8A6A00` for body-size text
  - `#B28900` only for large text and icons
  - `src/app/theme.test.ts` enforces both
- **Motion** honours `prefers-reduced-motion` (`MotionConfig reducedMotion="user"` plus a CSS
  override).
- **Feed order** is ranked once per set of posts, so cards don't jump while reactions arrive.
- **Code splitting:** heavy code loads lazily: route pages, WebLLM (~6 MB), the Lottie player,
  backup (JSZip + yaml), image compression.
