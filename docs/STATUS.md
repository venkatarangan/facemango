# Project status

_Last updated: 2026-10-03_

## Milestones

| #   | Milestone              | State                                           | Commit (branch)                 |
| --- | ---------------------- | ----------------------------------------------- | ------------------------------- |
| M0  | Spec approval          | ✅ Done                                         | `SPEC.md` v1.0 (+ v1.0.2 notes) |
| M1  | Skeleton               | ✅ Committed                                    | `5e1c4c4` (`m1-skeleton`)       |
| M2  | AI layer               | ✅ Committed, **not yet tried on a real model** | `975fd2a` (`m2-m4`)             |
| M3  | Feed core              | ✅ Committed                                    | `975fd2a` (`m2-m4`)             |
| M4  | Engine + photo pack v1 | ✅ Committed (87 of ~250 photos)                | `975fd2a` (`m2-m4`)             |
| M5  | Sections               | ✅ Committed                                    | `5968595` (`m5-m7`)             |
| M6  | Config & backup        | ✅ Committed                                    | `5dfcc4f` (`m5-m7`)             |
| M7  | Engagement & polish    | ✅ Committed (deploy pending access)            | `f9b4dd6` (`m5-m7`)             |
| M8  | Realistic faces (v1.1) | ⏳ Not started                                  | —                               |

## Quality gates (latest run)

- Unit tests: **89 passed**. End-to-end tests: **20 passed** (desktop Chrome and Android
  emulation, with the mock model).
- ESLint, TypeScript (strict), Prettier and the production build are all clean.
- Main bundle: 698 kB (222 kB gzip). WebLLM (6 MB) loads only on the WebGPU tier.
- No requests to outside hosts in the test build (checked with Playwright request logging).

## Waiting on the owner

1. **Test with a real model** in Chrome or Edge on Windows (`npm run dev` in WSL, then open
   http://localhost:5173). The Prompt API and WebLLM paths have never run in this environment,
   because it has no GPU.
2. **Google Analytics id** (`G-…`): set it as the Actions variable `GA_ID` once the repo exists.
3. **Approve the local build and give GitHub access.** Then: create `main`, create the
   `facemango` repo, push, enable Pages, and add the Cloudflare CNAME `face → <account>.github.io`
   (see the README).

## Known gaps and follow-ups

- **Setup experience:** the richer post-signup wait (friends arriving live, "tell us more",
  rotating tips) is designed and parked; only the basic progress card exists.
- **Photo pack:** 87 photos; the spec targets ~250 by launch (scripts in `scripts/photos/`).
- **iPhone/Safari tests:** not run locally (WebKit system libraries need `sudo`).
- **Photo-pack judgement calls** to confirm:
  - dishes photographed abroad are tagged by the cuisine's home region
  - a few borderline photos were left out to be safe
- **Languages:** posts and comments are in English only (v1). Tamil and others depend on model
  support.
- **M8:** opt-in realistic on-device faces.

## Decisions made during the build

| Decision                                                                    | Why                                                                   |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| MUI v9 instead of v7                                                        | v7 was two majors behind; owner agreed                                |
| TypeScript 6.0 (not 7)                                                      | typescript-eslint supports < 6.1                                      |
| `#8A6A00` for small yellow text                                             | `#B28900` is only 3.3:1 on white (AA for large text only)             |
| Byline "The most personal social network ever built. And the most private." | Owner's choice                                                        |
| Qwen3-1.7B (desktop), Gemma-3-1B (phones), q4f32 fallbacks                  | Spec's model families; f16 needs `shader-f16`                         |
| Self-host WebLLM libraries and the Lottie wasm                              | Keep outside hosts to Hugging Face + GA                               |
| Test-only mock model build (`dist-e2e`)                                     | Lets CI run the whole app without a GPU, without adding a non-AI mode |
| Original synthesised UI sounds                                              | No licence or attribution needed                                      |
| Feed ranked once per set of posts                                           | Cards jumped while reactions arrived                                  |
