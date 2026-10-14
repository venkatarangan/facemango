# Future features

Ideas we have considered and parked for now. Open bugs and checks are in [`STATUS.md`](STATUS.md).

## Realistic faces (M8)

Photo-like faces for friends and public profiles, generated on the device. Today's avatars are
DiceBear "Personas" illustrations.

**Candidate:** SD-Turbo (Stability AI), with onnxruntime-web on WebGPU. A browser build is about
2.5 GB.

**Why not now (reviewed 2026-10-14):**

- **Licence.** SD-Turbo uses the Stability AI Community License. It is free for non-commercial use
  and for use under US$1M revenue a year, but it is not open source:
  - It can be revoked, and Stability's acceptable-use policy (which Stability can change) is part of
    it.
  - It requires the licence text, a Notice file and "Powered by Stability AI" in the app.
  - Any money from the site (ads, sponsorship) counts as commercial use, which means registering
    with Stability.
  - It breaks the project rule of AGPL-compatible licences only.
- **Quality.** It is a one-step, 512×512 model built on Stable Diffusion 2.1, which Stability calls a
  research artifact. Faces often have odd eyes, teeth or ears, and the model leans toward certain
  looks.
- **Safety.** The browser build has no safety filter and ignores negative prompts. Every face would
  need an NSFW classifier check, with DiceBear as the fallback.
- **Weight.** The download is about 2.5 GB, and it needs about 3–4 GB of GPU memory, which it would
  compete for with the chat model. Making ~75 faces takes about a minute on a strong GPU and much
  longer on integrated graphics.

**If we build it:**

- It would be an opt-in "Realistic faces (beta)" item in Advanced settings.
- It would show only on desktop Chrome or Edge with WebGPU support for 16-bit maths (`shader-f16`),
  a large GPU buffer limit and 8 GB of RAM or more.
- It would turn on only after a one-time "Test this computer" run makes one face in under about 10
  seconds.
- The weights would be converted from the official model and hosted on Hugging Face with the
  licence and Notice files.
- Faces would be made in the background, then the model unloaded. They would be stored in a new
  Dexie version and included in backups.

**Revisit when** a small text-to-image model with an open licence (Apache-2.0 or MIT) and a
browser build of about 3 GB or less appears. FLUX.2 Klein 4B is Apache-2.0, but about 13.7 GB in
the browser.

## Messenger-lite

Private one-to-one chats with a friend persona. It was a v1 non-goal. Building it would need clear
"simulated" labelling and Wellbeing tracking, so chat time counts like feed time.

## Encrypted backups

A password-protected backup zip. Skipped for v1. To weigh: a forgotten password makes a backup
useless, and the Markdown files would no longer be readable without the app.

## More languages

Posts, comments and Mango AI in Tamil and other languages. English only for v1 (SPEC). To check
first: how well the small on-device models write each language.

## Photos in Safari private tabs

In private tabs, Safari's storage refuses images, so photo posts fail there. The fix is to store
media as raw bytes plus a file type, which needs a new Dexie version and a migration.
