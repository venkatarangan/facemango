# Photo pack scripts

These scripts build the bundled photo pack in `public/photos/` that simulated friends post from
(SPEC §4.5). Every photo is **CC0 or public domain**, family-friendly and visually reviewed by a
person before it ships.

## Files

| File                 | Purpose                                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `queries.json`       | Search queries with region/theme hints. Add entries here to grow the pack.                                         |
| `fetch.mjs`          | Searches Wikimedia Commons, verifies each file's licence and downloads 1280 px candidates.                         |
| `contact-sheets.mjs` | Builds labelled thumbnail grids so you can review candidates quickly.                                              |
| `selection.json`     | **Hand-curated** list of approved photos: final id, candidate, region, country, themes, tags, season and alt text. |
| `build.mjs`          | Converts the selection to WebP and writes `manifest.json` and `CREDITS.md`.                                        |
| `lib.mjs`            | Shared constants (regions, themes, licences) and helpers.                                                          |

Raw downloads, `candidates.json` and contact sheets live in a work folder outside the repo
(`$PHOTO_WORK`, default `$TMPDIR/facemango-photo-work`). They are never committed. Keep the work
folder while you curate: `build.mjs` needs `candidates.json` and the raw files.

## Running

Requires Node 22+ and `sharp` (already in `node_modules`). Run from the repo root:

```bash
export PHOTO_WORK=~/facemango-photo-work

# 1. Download candidates (2 per query by default; resumable, skips queries that already have enough)
node scripts/photos/fetch.mjs
node scripts/photos/fetch.mjs --only gl-cat,oc-koala --n 4   # more candidates for some queries

# 2. Build contact sheets and look at every one
node scripts/photos/contact-sheets.mjs              # all candidates -> $PHOTO_WORK/sheets/
node scripts/photos/contact-sheets.mjs --prefix sa- # just one group

# 3. Add approved photos to selection.json (see the format below), then build
node scripts/photos/build.mjs --clean
npx prettier --write public/photos scripts/photos

# 4. Review the final pack once more
node scripts/photos/contact-sheets.mjs --final      # -> $PHOTO_WORK/sheets-final/
```

Pace requests. `fetch.mjs` sends a descriptive User-Agent and waits between calls, as Wikimedia
asks. If you use Openverse (`https://api.openverse.org/v1/images/?q=...&license=cc0,pdm`) to fill
gaps, keep to its low anonymous rate limit and still verify the licence on the original source page.

### `selection.json` entry

```json
{
  "id": "food-south-asia-001",
  "candidate": "sa-dosa-1",
  "region": "south-asia",
  "country": "India",
  "themes": ["food"],
  "tags": ["dosa", "breakfast", "south indian"],
  "season": null,
  "alt": "A crisp dosa with coconut chutney and sambar on a steel plate"
}
```

- `id` is `<main theme>-<region>-<NNN>`. Never reuse or renumber an id that has shipped: personas'
  existing posts point at it.
- `region`: `south-asia`, `east-asia`, `southeast-asia`, `middle-east`, `africa`, `europe`,
  `americas`, `oceania`, or `global` (for region-neutral shots such as a cat close-up).
- `themes`: one or more of `food`, `travel`, `nature`, `festivals`, `pets`, `family`, `hobbies`,
  `sports`, `city`, `work`, `weather`.
- `season`: `spring`, `summer`, `autumn`, `winter`, `monsoon` or `null`.
- `country`: `null` when unknown or for `global`.
- `alt`: one specific sentence describing what is actually in the photo.
- Optional `author` overrides the author text taken from Commons (use it to tidy messy credits,
  never to change who the author is).
- Optional `crop` trims a fraction of each edge, e.g. `{ "bottom": 0.02 }`, to remove a thin
  border. Never crop away a watermark or credit; reject that photo instead.

`build.mjs` takes `source`, `author`, `license` and `licenseUrl` from the verified Commons
metadata; you never type licence data by hand.

## Licence rules

- Accept only **CC0 1.0**, **Public Domain Mark 1.0**, or **Public domain** as stated on the
  Commons file page (`extmetadata.LicenseShortName` / `License`). `fetch.mjs` rejects anything
  else, including every CC BY / CC BY-SA variant, GFDL and "copyrighted free use".
- Public-domain files dated before 1995 are skipped (they are almost always archival scans).
- Files tagged with trademark restrictions are skipped.
- If you cannot verify a licence, skip the photo.

## Review checklist (every photo, by eye)

Reject a photo if any answer is "no":

- [ ] **Family-friendly**: no nudity or suggestive content, violence, weapons, gore, alcohol- or
      drug-centred imagery, hospitals or funerals.
- [ ] **Not controversial**: no protests, political symbols or sectarian imagery. A festival
      celebration or a famous temple/landmark as architecture is fine.
- [ ] **No identifiable faces**: people only at a distance, from behind, in silhouette or as
      hands. Crowds are fine when no single face is identifiable.
- [ ] **No identifiable children** at all.
- [ ] **No brands or logos as the subject** (an incidental, unreadable sign in a street scene is OK).
- [ ] **Postable**: well exposed, sharp, pleasant; looks like something a friend would share.
- [ ] **No overlays**: no watermarks, captions, borders or date stamps.
- [ ] **A real photo**: not a black-and-white archival scan, map, diagram, plan, drawing or screenshot.
- [ ] **Metadata matches**: region, country, themes, season and alt text describe this photo.
- [ ] **Size**: 1200 px long edge, roughly 60–150 KB, metadata stripped (`build.mjs` handles
      this; very busy photos drop to 960 px and may still land a little over 150 KB).

## Growing to ~250

Add queries for under-represented regions and themes (check the counts `build.mjs` prints), fetch,
review, append to `selection.json` with the next free number for that theme and region, and rebuild.
Aim for an even spread across regions and the theme weights in the v1 brief: food, travel, nature
and city first, then pets, festivals, hobbies, weather, sports, work and family.
