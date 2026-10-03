<p align="center"><img src="public/logo.svg" alt="" width="88" height="88" /></p>

<h1 align="center">FaceMango</h1>

<p align="center"><strong>The most personal social network ever built. And the most private.</strong></p>

<p align="center"><a href="https://face.mangoidiots.com">face.mangoidiots.com</a></p>

FaceMango is a cosy, Facebook-style feed where friends like, comment and cheer you on. Every
friend is imagined by AI.

**What makes it different:** other feel-good apps run on someone else's servers. FaceMango runs
entirely on your device: your posts, your friends, even the AI behind them. Nothing ever leaves
unless you export it.

## Using it

1. Open [face.mangoidiots.com](https://face.mangoidiots.com) in Chrome or Edge on a computer, Safari
   on iPhone/iPad (iOS 26+) or Mac, or Chrome on Android.
2. Tap **Get started** and fill in a quick profile. Your browser sets up a small AI model; the first
   time takes a few minutes.
3. Post something and watch your friends react.

**Good to know**

- No account, no cloud. Clearing your browser data erases FaceMango, so use **Settings → Backup &
  restore** now and then.
- On iPhone, add FaceMango to your Home Screen; Safari may otherwise erase site data after 7 days
  without a visit.
- The friends are simulated, not real people. For ages 13+.
- Google Analytics counts page views only. It never sees your posts, profile or stats.

## For developers

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests
npm run test:e2e   # Playwright (uses a mock model)
```

React + TypeScript + MUI, Dexie (IndexedDB), the Prompt API or WebLLM (WebGPU) for the AI.
Start with [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md); the product spec is [`SPEC.md`](SPEC.md).
Changes are in [`CHANGELOG.md`](CHANGELOG.md), open items in [`docs/STATUS.md`](docs/STATUS.md).

## Licence

[AGPL-3.0](LICENSE). Photo, avatar and emoji credits are on the in-app Credits page.
