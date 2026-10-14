# Status

_Updated 2026-10-14_

Live at **https://face.mangoidiots.com** (GitHub Pages over HTTPS, deployed by Actions on every push to
`main`).
Milestones M1–M7 from `SPEC.md` are built, plus friends' life stories, automatic folder backup,
photo-aware comments on every AI tier, a richer first-run wait and a developer real-model test
page.

## Open items

- **Mango AI on real models:** the first owner test on Qwen3 (WebGPU) worked for friends, posts,
  likes and comments, but Mango AI failed. Run Advanced settings → Developer → Real-model test and
  copy the results; the Mango AI tests show the full error.
- **Real-browser checks:** life stories, folder backup, the photo captioner (Florence-2) and the
  setup experience have only run against the mock model or headless Chromium.
- **Photos in Safari private tabs:** WebKit's IndexedDB refuses Blobs in private (ephemeral)
  sessions, so photo posts, avatars and restores with images fail there with "Error preparing
  Blob/File data…" (the composer now shows this). Normal Safari tabs are fine. Fix: store media as
  `ArrayBuffer` + MIME type (new Dexie version with a migration). The WebKit e2e photo test is
  skipped until then.
- **Setup experience:** try the first-run wait on a real download (time left, slow-network note,
  "Waking it up" stage) in Chrome/Edge and on a phone.

## Parked

- **M8 realistic faces:** blocked on licence. SD-Turbo is under the Stability AI Community License
  (revenue cap, acceptable-use policy, revocable), which is not open source. No small Apache/MIT
  image model with a browser build exists yet (FLUX.2 Klein 4B is Apache-2.0 but ~13.7 GB in the
  browser). Recheck periodically.
- **Encrypted backups:** skipped for now.
- **Messenger-lite** (private chats with a friend persona): parked; a v1 non-goal, and needs clear
  "simulated" labelling and Wellbeing tracking if built.

## Done

- **Photo pack:** 251 photos, the ~250 target (`scripts/photos/`). Work and family themes are
  thin (few usable CC0 photos on Commons). Fetching needs `NODE_USE_ENV_PROXY=1` in the sandbox and
  `thumb.wikimedia.org` allowed alongside `commons` and `upload.wikimedia.org`.
