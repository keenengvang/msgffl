# Weekly summary content contract

Written by the weekly-summary managed agent via its GitHub MCP toolset
(`create_or_update_file`, `push_files`). Two things get written every run:

## 1. A new per-week file

`content/weekly-summaries/<season>-w<week>.json`, week zero-padded to 2 digits
(e.g. `2026-w01.json`, `2026-w14.json`).

```json
{
  "season": "2026",
  "week": 1,
  "generatedAt": "2026-09-19T13:00:00Z",
  "headline": "SHORT, ALL-CAPS, SCREAMS FROM THE FRONT PAGE",
  "sections": [
    { "heading": "TOP PERFORMERS", "body": "…" },
    { "heading": "WAIVER WATCH", "body": "…" }
  ]
}
```

- `season` / `week`: match the Sleeper season/week this recap covers.
- `generatedAt`: ISO 8601 timestamp of the run.
- `headline`: one line, shows on the Home page card and atop the full page.
- `sections`: as many as you want — each renders as its own card on `/weekly-summary`.

## 2. A prepended entry in the manifest

`content/weekly-summaries/index.json` — one row per week ever filed, across every
season. The site reads this to build the archive (season → week picker) and to
know which file is "latest" for the Home page card:

```json
{
  "weeks": [
    { "season": "2026", "week": 1, "generatedAt": "2026-09-19T13:00:00Z", "headline": "…", "file": "2026-w01.json" },
    { "season": "2026", "week": 0, "generatedAt": "2026-09-12T00:00:00Z", "headline": "…", "file": "2026-w00.json" }
  ]
}
```

**Prepend, don't overwrite** — read the current file, add the new entry to the
front of `weeks`, write the whole thing back. The site re-sorts defensively
(season desc, then week desc) so entry order isn't load-bearing, but prepending
keeps the file readable for humans skimming it on GitHub.

Never delete or edit past entries/files — this is the archive.
