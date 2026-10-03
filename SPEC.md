# FaceMango — Top-Level Specification (v1.0, ready for approval)

> **Name:** FaceMango · **Production URL:** https://face.mangoidiots.com
> **Licence:** AGPL-3.0 (open source) · **Hosting:** GitHub Pages, DNS on Cloudflare
> Status: **v1.0**, all clarification rounds folded in · Date: 2026-10-03 · Owner: Venkatarangan
> Changes per round are listed in §12.

---

## 1. Summary

FaceMango is a private, single-player social feed in the spirit of [dopamine sites](https://en.wikipedia.org/wiki/Dopamine_sites) and foodnevercomes.com. It looks and feels like the Facebook centre feed, but every friend, like and comment is simulated by an AI that runs **on the user's own device**. There is no account, no server and no cloud storage. The user can export everything to Markdown and images, and restore it on a new install.

**Selling point:** *"A social network that is entirely yours. Your posts, photos and friends live only on your device."*

### Goals (v1)
- A Facebook-like feed, post composer (text + one photo), reactions, comments and "time ago" labels.
- 20–30 AI-generated **friends** plus **public profiles** (2× the friend count by default).
- Engagement (likes, comments, replies) that feels real, can be configured, and stays within hard limits.
- Tiered local AI: Prompt API, then WebGPU with a small Gemma/Qwen model. If neither works, show the Unsupported screen. **There is no non-AI mode.**
- **Mango AI** assistant, Memories, Activity, Photos, and a **Wellbeing** usage tracker.
- Full backup and restore with Markdown and images. The friends list can be reset at any time.
- Responsive, polished, animated Material UI on PC, Mac, iPhone and Android. Installable as a PWA.

### Non-goals (v1)
- Backend, sync, real friends, scheduled posts, video, Stories, Reels, Groups, Messenger.
- Languages other than English for posts and comments. Tamil and others come later.
- Realistic AI faces (planned for v1.1, §5.3).

---

## 2. Platforms & AI tiers

| Platform | AI tier | Notes |
|---|---|---|
| Chrome desktop (Win/Mac/Linux) | **Prompt API** (Gemini Nano) | Chrome downloads the model once. Needs about 22 GB free disk and a capable GPU or 16 GB RAM. |
| Edge desktop | **Prompt API** (Phi-4-mini) | Feature-detected. |
| Safari macOS / iOS 26+ | **WebGPU** | |
| Android (Chrome/Samsung) | **WebGPU** | |
| Firefox / older devices | WebGPU if enabled, otherwise **Unsupported screen** | |

### iOS data-loss warning (required UI)
Safari on iPhone and iPad can **delete site data after 7 days without use** unless the app is added to the Home Screen.
- **Landing/home page:** an info card for iOS visitors with a step-by-step "Add to Home Screen" guide.
  *"On iPhone/iPad, Safari may erase FaceMango's data if you don't open it for 7 days. Add FaceMango to your Home Screen and export a backup regularly."*
- **Signup:** the same notice, with a required "I understand" checkbox.
- **Afterwards:** a banner every 7 days in a Safari tab that isn't installed. A backup reminder when the last export is more than 7 days old (on by default on iOS, optional elsewhere).
- `navigator.storage.persist()` is requested on every platform, and its status is shown in Settings.

---

## 3. Features

### 3.1 First run
1. **Landing page:** branding, privacy statement (§7), iOS notice, "Get started".
2. **Capability check + model download** starts on the tap (a user gesture is required), with a progress bar. If no tier works, the Unsupported screen appears and the app stops.
3. **Quick signup** (runs during the download): **Name, Age (13+), City, Languages known**, optional profile photo, and the iOS acknowledgement.
4. **"Finding your friends…"**: friends and public profiles are generated (§4.1).
5. **Seed feed:** 15–25 back-dated friend posts with existing engagement.
6. **First-post nudge** with a warm early burst of engagement.

### 3.2 Home feed
- Composer card ("What's on your mind, {Name}?") with a ✨ Mango AI rewrite button.
- A virtualised infinite feed of friend, user and occasional public-profile posts, ordered by recency with a light engagement boost.
- Post card: avatar, name, time ago, text, photo, reaction summary ("👍❤️😆 Priya and 23 others"), comment count, Like / Comment / Share buttons, and 1–2 top comments.
- Reactions: Like, Love, Care, Haha, Wow, Sad, Angry, with **animated emoji** (long-press on mobile, hover on desktop).
- Comment threads with one level of replies. Friends reply to the user and to each other.
- **Time ago** in Facebook style: *Just now · 5m · 3h · Yesterday at 4:12 PM · 2 October · 2 October 2025*. Labels update live.

### 3.3 Create post
- Text plus **one photo**, compressed on the device (WebP, max about 1600 px).
- Feeling/activity chip, and @mentions. A mentioned friend always responds.
- Edit and delete own posts and comments.

### 3.4 Friends, public profiles & profile pages
- **Friends** (20–30): full personas. **Public profiles** (default 2× friends): lighter personas that mostly like, sometimes comment, and send friend requests.
- Profile page **generated lazily on first visit**, then cached: avatar, cover (from the photo pack), about, work/education (fictional), city, languages, likes, dislikes, personality summary and recent posts.
- **Former friends** (after a reset, §3.10) keep read-only profiles with a subtle "Former friend" badge on the profile page only.

### 3.5 Mango AI
- A chat panel/sheet: write or rewrite a post, make it funnier, summarise friends' reactions, "what's trending among my friends", daily post ideas, general chat. Responses stream in.

### 3.6 Memories
- "On this day" (1 week, 1 month, 1 year ago), friendversaries, "Your first post on FaceMango", and milestone recaps.

### 3.7 Activity
- Notifications with a bell badge: reactions, comments, replies, mentions, birthdays, friend requests, milestones.
- Activity log of the user's own actions, filterable.

### 3.8 Photos
- A masonry grid of the user's photos plus friends' photos, with a lightbox (pinch-zoom, swipe) that links to the post.

### 3.9 Wellbeing (usage tracker)
A private, on-device dashboard in the style of a mental-health or digital-wellbeing tracker. Nothing about it is ever sent anywhere, including analytics.
- **Time spent:** today, this week, and a 30-day trend chart. Session count and average session length.
- **When you use it:** a time-of-day × weekday heatmap, and late-night usage highlighted.
- **What you do:** posts made, comments written, reactions received versus given, and feed scroll depth.
- **Mood check-in (optional):** at the end of a session, a one-tap emoji mood ("How do you feel? 😊 😐 😟"). A chart shows mood against time spent.
- **Daily goal (optional):** set a target such as 30 min/day. A ring fills up during the day, with a gentle, non-blocking nudge when it's exceeded.
- **Weekly summary card** in the feed every Monday ("You spent 2h 10m on FaceMango last week, 15% less than the week before").
- Included in the full backup.

### 3.10 Friends reset
- Settings → **"Reset friends"** works at any time, and is also offered on import.
- It regenerates friends and public profiles from the current config. The user's posts, photos and comments stay.
- **Existing likes and comments from old friends are kept as they are, under the old names.** Old personas become read-only "former friends": they appear in no new engagement, and their **future planned events are cancelled**.

### 3.11 Export / backup & restore
```
facemango-backup-2026-10-03.zip
  me.md            ← your profile, posts, comments (readable)
  friends.md       ← friends, public profiles, former friends
  feed.md          ← friends' posts, all comments, reaction summaries
  wellbeing.md     ← usage stats and mood check-ins
  images/          ← your photos
  avatars/         ← generated avatars (SVG)
```
- Each record has a YAML front-matter header (id, author, timestamp, type, image ref): readable by people and reliable to parse. Photo-pack images are referenced by id, not copied.
- **Restore** happens on the first-run screen or in Settings: **Restore everything**, or **Restore my content + new friends**.

---

## 4. Simulation engine

### 4.1 Friend & public-profile generation
- Inputs: the user's city, age, languages, and the config mixes.
- Persona: name (culturally fitting), gender, age, city/country, languages, occupation, interests, likes/dislikes, writing style, agreeableness, stance (fan / neutral / critic), activity level, and appearance attributes for the avatar.
- Generated as structured JSON (Prompt API `responseConstraint` / WebLLM JSON-schema mode), validated with Zod, and retried if malformed.

### 4.2 Engagement model
When a post is created, its whole engagement timeline is **pre-planned** as future events in IndexedDB:
1. **Comments:** `C` comes from the configured band (log-normal), capped at **100**.
2. **Likes:** `L = max(minLikes, C × m)`, where `m` is a random multiplier (default **3×–5×**, configurable), capped at **1,000,000**.
3. **Who:** friends are weighted by closeness, interest match and activity. Public profiles fill the remaining likes. Beyond the named pool, the summary shows "and 1,234 others".
4. **Type:** from the comment mix, nudged by the commenter's stance. By default there are at most 1–2 critical comments per post.
5. **Timing:** front-loaded decay with random bursts and lulls. The speed setting compresses time.
6. **Text:** generated just in time, in batches, from the post text, photo (multimodal where supported) and persona.
7. **Catch-up:** past-due events are applied with their original timestamps → "While you were away: 14 reactions, 3 comments".

### 4.3 Living feed
- Friends post life updates, opinions, questions and **photos from the bundled photo pack** (§4.5), with captions written by the AI.
- Friends interact with each other, remember earlier posts, and have birthdays. Public profiles send friend requests.

### 4.4 Comment categories
| Type | Default | Example tone |
|---|---|---|
| Good | 60 % | "Looks amazing! Where is this?" |
| Appreciative | 25 % | "So proud of you, this is wonderful 🙌" |
| Nonsense | 10 % | "lol my cat sat on my keyboard 🐱 ok bye" |
| Critical | 5 % | "Nice shot, but the lighting is a bit off honestly." |
| Super-critical | 0 % | Blunt, but **never abusive, hateful or about protected traits**. Disabled for under-18s. |

### 4.5 Photo pack (friends' posts & covers)
- **Size:** about 250 curated photos at launch, resized to WebP (1200 px, ~80–150 KB each, ~25–35 MB total).
- **Delivery:** served from the same origin and **loaded lazily** when needed (not part of the app bundle). Viewed photos are cached by the service worker for offline use.
- **Mix:** balanced across **regions** (South Asia, East/Southeast Asia, Middle East, Africa, Europe, the Americas, Oceania) and **themes**: food, travel & landmarks, nature & landscapes, festivals & celebrations, pets & animals, family moments, hobbies (cooking, gardening, music, art), sports & fitness, city life, work & study, weather and seasons.
- **Family-friendly rules:** no nudity or suggestive content, violence, alcohol-centred or drug imagery, weapons, political or religious controversy, or brands or logos as the subject. **No close-up identifiable faces, and no identifiable children.** People appear at a distance, from behind, or as hands and silhouettes. This also keeps photos from being mistaken for a persona's own face.
- **Licensing:** CC0 / public domain only (e.g. Wikimedia Commons CC0/PD, Openverse filtered to CC0/PDM). This is safe for redistribution in an AGPL repo.
- **Manifest** (`photos/manifest.json`): id, file, region, country, themes/tags, season, alt text (accessibility), source URL, author and licence. The AI chooses photos by matching tags to the persona's city/region, interests and the post topic, and avoids repeats.
- **Credits page** in the app listing every source, even though CC0 doesn't require it.

---

## 5. Local AI

### 5.1 Tiering
```
detect() ─▶ Tier 1: Prompt API (window.LanguageModel)
              • downloadable → download on a user gesture, progress via monitor()
          ─▶ Tier 2: WebGPU (navigator.gpu + adapter limits)
              • WebLLM (MLC) in a Web Worker; weights from Hugging Face → Cache Storage
              • Mobile / low VRAM: Qwen3-0.6B or Gemma-3-1B (q4)
              • Desktop:           Qwen3-1.7B or Gemma-3-1B (q4)
          ─▶ Tier 3: Unsupported screen
```
- One `AIProvider` interface (`generate`, `generateJSON`, `stream`, `describeImage?`).
- A priority queue in a Web Worker: the assistant and composer go before background generation.
- Settings show the tier, model, storage used and a "Delete model" button.

### 5.2 Text quality
- Persona style prompts, de-duplication against recent comments, and sample-and-filter.

### 5.3 Faces & avatars (approved)
| Level | Release | How |
|---|---|---|
| **A. AI-directed illustrated avatars** | v1 | The LLM picks traits (age, gender, skin tone, hair, glasses, style) → bundled DiceBear styles, rendered locally as SVG. |
| **B. On-device realistic faces** | v1.1, opt-in | Desktop WebGPU with ≥ 6 GB VRAM. An SD-Turbo-class model via ONNX Runtime Web (~1.5–2.5 GB extra), generated lazily per profile. |

---

## 6. Architecture

### 6.1 Stack: open source and best in class (licences compatible with AGPL-3.0)
| Concern | Choice |
|---|---|
| Language / build | **TypeScript** (strict) + **Vite** |
| Framework | **React 19** |
| UI kit | **MUI v7** (Material), custom FaceMango theme, CSS variables, Material Symbols icons |
| Fonts | **Inter** (UI) + a rounded display face for the wordmark (e.g. Nunito), self-hosted |
| Animation | **Motion** (Framer Motion) for transitions, shared-layout card → detail, spring like-button, list enter/exit |
| Reaction emoji | **Noto Animated Emoji** (Lottie, CC BY 4.0) via **dotLottie** player |
| Celebrations | **canvas-confetti** |
| Sound | **Howler.js** with short, subtle UI sounds (toggle) |
| Feed virtualisation | **react-virtuoso** (variable-height infinite lists) |
| Gestures | **@use-gesture/react** (swipe, long-press, pinch in the lightbox) |
| Charts (Wellbeing) | **MUI X Charts** (community, MIT) |
| Routing | **React Router** (with the GitHub Pages SPA fallback) |
| State | **Zustand** (UI) + **Dexie** `useLiveQuery` (data) |
| Storage | **IndexedDB via Dexie**; images as Blobs |
| Forms / validation | **React Hook Form** + **Zod** (also validates AI JSON) |
| Dates | **date-fns** (time ago, Memories) |
| Images | **browser-image-compression** (WebP) |
| AI | **Prompt API** · **@mlc-ai/web-llm** (WebGPU) in a Web Worker via **Comlink** |
| Avatars | **DiceBear** (bundled) |
| Export | **JSZip** + **yaml** (front-matter) |
| PWA | **vite-plugin-pwa** (Workbox) |
| Quality | **Vitest**, **Testing Library**, **Playwright** (desktop + mobile emulation), ESLint, Prettier |
| CI/CD | **GitHub Actions** → build → test → deploy to **GitHub Pages** |

### 6.2 Module layout
```
src/
  app/            routes, responsive shell (3-col desktop / bottom-nav mobile), theme
  features/       onboarding, feed, compose, friends, assistant, memories,
                  activity, photos, wellbeing, settings, backup
  engine/         personas, planner, scheduler, content prompts, photoPicker,
                  celebrations, notifications
  ai/             provider, promptApi, webllm.worker, queue
  db/             Dexie schema + migrations
  lib/            timeAgo, imaging, markdown export/import, analytics, usage tracking
public/
  photos/         CC0 photo pack + manifest.json
```

### 6.3 Data model (IndexedDB)
`profile` · `personas` (kind: friend | public | former) · `posts` · `comments` · `reactions` (rows or aggregates) · `events` · `notifications` · `media` · `usageSessions` · `moods` · `settings` · `meta`.

### 6.4 Design
- White background `#FFFFFF`, surfaces `#FAFAFA`. **Mango-yellow accent** `#FFC400`, with `#B28900` for yellow text on white (WCAG AA). Near-black text `#111111`.
- Desktop: 3 columns (nav · feed · contacts/birthdays). Tablet: 2. Phone: 1, with bottom nav (Home · Friends · ✨ Mango AI · Memories · 🔔).
- Skeleton loaders, optimistic UI, a "pull to refresh" gesture on mobile, smooth 60 fps animations, and respect for `prefers-reduced-motion`.
- A mango logo/wordmark in the Mangoidiots family.

### 6.5 Hosting & deployment
- A GitHub repo (AGPL-3.0) with Actions deploying to **GitHub Pages**. Custom domain `face.mangoidiots.com` via a `CNAME` file, plus a **Cloudflare DNS CNAME `face` → `<account>.github.io`** (DNS-only/grey cloud while the GitHub certificate is issued). Enforce HTTPS.
- GitHub Pages can't set HTTP headers, so the CSP ships as a `<meta http-equiv>` tag. Cloudflare Transform Rules can add stricter headers later if needed.
- SPA deep links use the `404.html` fallback.

---

## 7. Privacy statement & rules

**Public wording:**
> *Your posts, photos, friends, comments and wellbeing stats are stored only in this browser on this device. FaceMango has no servers and no accounts, and never uploads your content. To run AI on your device, FaceMango downloads an AI model, either through your browser (Chrome/Edge) or from Hugging Face. We use Google Analytics to count page views only. It never sees your posts, profile or usage stats.*

**Engineering rules:**
- User content and wellbeing data are **never** sent over the network.
- Allowed outbound requests (CSP `connect-src`): same origin, Hugging Face model hosts, and Google Analytics/Tag Manager.
- Analytics: page/screen views only. Consent banner for EU/UK visitors.

---

## 8. Engagement features (all in v1)
1. Variable reward timing: likes arrive in unpredictable bursts.
2. "While you were away" catch-up summary.
3. Typing indicators: "Priya is writing a comment…".
4. Friends who reply back. Critics push back, fans defend.
5. Comments that refer to what's in the photo (multimodal where supported).
6. Micro-celebrations: confetti and sound at milestones, "Your best post this week".
7. Personal callbacks to earlier posts.
8. Social-proof copy ("Arun and 23 others").
9. Notification badge plus local notifications (installed PWA).
10. Friend requests trickle in from public profiles.
11. Daily post idea from Mango AI.
12. Posting streaks 🔥 (low-key).
13. Haptics on Android, and a mango-yellow spring Like animation.
14. @mentions guarantee a response.

**Balance:** a "Simulated friends" note in About, the 13+ age gate, Super-critical comments off for under-18s, and the **Wellbeing tracker** (§3.9).

---

## 9. Key risks
| Risk | Mitigation |
|---|---|
| Large model download on phones | Smallest model on mobile, progress UI, signup runs during the download |
| Small models produce repetitive text | Persona style prompts, de-duplication, sample-and-filter |
| Safety filters soften critique | Constructive framing |
| iOS storage eviction | Home-page and signup warnings, install guide, backup reminders |
| Prompt API still evolving | Isolated behind `AIProvider` |
| Photo pack curation effort and licence mistakes | CC0/PD only, a manifest with sources, a manual family-friendly review checklist |
| Repo/page weight from the photo pack | Lazy loading and WebP; Git LFS isn't needed at about 35 MB |

---

## 10. Milestones
| # | Milestone | Outcome |
|---|---|---|
| M0 | Spec approval | ✅ This document |
| M1 | Skeleton | Repo, Vite/React/MUI, theme, responsive shell, Dexie, landing + iOS notice, signup, PWA, CI |
| M2 | AI layer | Tier detection, Prompt API + WebLLM worker, progress, Unsupported screen |
| M3 | Feed core | Composer + photo, post cards, animated reactions, comments, time ago |
| M4 | Engine | Personas, planner/scheduler, catch-up, notifications, living feed, photo pack v1 |
| M5 | Sections | Profiles + avatars, Mango AI, Memories, Activity, Photos, Wellbeing |
| M6 | Config & backup | Advanced settings, export/restore, friends reset |
| M7 | Engagement & polish | §8 features, performance, GA hook, cross-browser QA, deploy to face.mangoidiots.com |
| M8 (v1.1) | Realistic faces | On-device diffusion, opt-in |

---

## 11. Resolved final questions
1. **Logo:** design a **new** SVG logo: elegant, modern, mango-related, in the FaceMango colour scheme (not based on the existing Mangoidiots mark).
2. **GitHub:** the repo name is **`facemango`**. Create the **local** repo now. Create the GitHub repo and push **only after the user okays the local build**.

---

## 12. Change log
- **v0.1:** first draft.
- **v0.2:** name FaceMango; iOS warnings; privacy wording now permits Hugging Face + GA; no Lite mode; likes = 3–5× comments; public profiles = 2× friends; full backup; friends reset.
- **v1.0:** faces plan approved; CC0 worldwide family-friendly photo pack; reset keeps old engagement under old names (former friends); "Mango AI" confirmed; Wellbeing usage tracker; GitHub Pages + Cloudflare DNS; AGPL-3.0 and a best-in-class library stack.
- **v1.0.1:** new FaceMango logo to be designed; repo `facemango` (local first, GitHub after the user okays the local build).
