# Changelog

## Unreleased

- **Friends' life stories:** friends now have storylines that unfold over days and weeks (a new
  job, race training, a trip, a new pet and more), told one post at a time. Posts show which
  update they are; profiles list each friend's stories. Stored in a new `stories` table (Dexie
  v3) and included in backups.

- Mango AI (chat and composer) falls back to a single reply if streaming fails, and shows the reason.
  Settings → On-device AI shows the last AI error.
- Shorter, friendlier README, About page and welcome screen.

## 0.1.0 (2026-10-03): first public build

- **M1:** app shell, logo, theme, landing page, signup, PWA, CI.
- **M2:** on-device AI: Prompt API (Chrome/Edge) or WebLLM on WebGPU, with download progress.
- **M3:** feed: posts with a photo, feelings, @mentions, reactions, comments and replies, Mango AI
  rewrite.
- **M4:** simulation engine: AI friends, planned engagement within hard caps, living feed,
  notifications, photo pack.
- **M5:** profiles, Mango AI chat, Memories, Activity, Photos, Wellbeing tracker.
- **M6:** advanced settings, backup and restore (Markdown + images), friends reset.
- **M7:** celebrations, friend requests, daily ideas, streaks, pushback from fans, local
  notifications, analytics hook (page views only).
