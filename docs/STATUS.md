# Status

_Updated 2026-10-03_

Live at **https://face.mangoidiots.com** (GitHub Pages, deployed by Actions on every push to `main`).
Milestones M1–M7 from `SPEC.md` are built. M8 (realistic on-device faces) is not started.

## Open items

- **Mango AI on real models:** the first owner test on Qwen3 (WebGPU) worked for friends, posts,
  likes and comments, but Mango AI failed. It now falls back from streaming to a single reply and
  shows the error (also in Settings → On-device AI). Re-test needed.
- **Analytics:** add the Actions variable `GA_ID` (`G-…`) to turn it on.
- **Photo pack:** 87 photos so far, against ~250 planned (`scripts/photos/`).
- **Parked:** a richer "setup experience" for the first-run wait.
