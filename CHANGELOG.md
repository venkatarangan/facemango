# Changelog

## Unreleased

- Friends now comment on what's in your photos on every browser, not just Chrome/Edge with a
  built-in AI that can see images. Elsewhere, a small on-device photo model (Florence-2 via
  Transformers.js, about 245 MB) downloads with your first photo post. Toggle it in Settings →
  On-device AI. Photos never leave the device. The How-It-Works PDF needs updating for this new
  library before the next publish.
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
