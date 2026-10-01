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

### One section is mandatory: the full-roster roll call

Whatever else the week earns, **every recap must include a section that walks all
14 teams one at a time, ranked by that week's score**, with a praise-or-roast
paragraph for each. Everyone in the league should find themselves in the recap by
name every single week — that's the point of it, so nobody gets to feel left out
because their week was boring.

The 2026 week 3 recap has the reference version, headed
`THE FULL FOURTEEN: EVERYBODY GETS A TURN 🎤`. The shape that works:

- One paragraph per team, `<rank>. <manager> — <score>, won/LOST by <margin>.`
  then the jokes. Rank strictly by points scored that week, not by record.
- Give each team a *specific* reason: a real player's real number, a bench blunder,
  a waiver hit, a kicker outscoring a first-rounder. Never a generic jab — if the
  line would read the same for any other team, it isn't finished.
- Winners still get roasted for bad calls and losers still get credit for good
  ones. A 150-point win with a 39-point quarterback benched is both at once.
- Keep each entry to two or three sentences. Fourteen teams is already the longest
  section in the file; it should stay skimmable.

The other sections stay free-form — as many as the week earns, no fixed set.

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

## Types are checked at runtime

`src/entities/weekly-summary/api/` type-guards both files on fetch and throws
`weekly summary file is malformed` / `weekly summary index is malformed` if
anything is off, which surfaces as an error panel on the page. So:

- `season` is a **string** (`"2026"`), `week` is a **number** (`3`, not `"3"`,
  and not zero-padded — the padding is only in the filename).
- `generatedAt` is a string; the page renders it via `new Date(...)`, so use
  ISO 8601.
- `headline` is a string, `sections` an array of `{heading, body}` — both
  strings, no other keys read.
- Index rows carry the same four fields plus `file`, the bare filename.
- Bodies render as plain text; markdown and HTML are not parsed and will show as
  literal characters.

## Break the bodies into paragraphs

The page renders each recap as a single-column article on a ~70-character
measure, so a section body written as one unbroken block becomes one very tall
paragraph — readable, but a wall.

**Separate paragraphs inside a `body` with a blank line** (`\n\n` in the JSON
string). Each one renders as its own `<p>` with proper spacing:

```json
{ "heading": "THE ZERO CLUB", "body": "Three teams put up a clean 0.00.\n\nBefore anyone starts the group chat, none of them rostered a Thursday player." }
```

Two or three paragraphs per section is the right texture for a 100–200 word
section; a single short section can stay one paragraph. Break where the thought
turns — a new team, a new joke, the twist — not at a fixed length. A single
newline does *not* start a new paragraph; only a blank line does.

This is presentation only. Bodies with no blank line still render correctly as
one paragraph, which is what every recap filed before week 2 of 2026 does.

## Publishing

Branch `weekly-summary/<season>-w<week>`, commit the new week file plus the
updated `index.json`, open a PR against `main` titled `Week <week> recap`.

The only checks on this repo are Netlify deploy checks that settle in well
under a minute, so **auto-merge usually cannot be armed**: GitHub refuses it as
`unstable` while the checks are pending, then refuses it again as `clean` once
they pass, because auto-merge only applies while something is still pending. On
a `clean` PR, squash-merge it directly — that is the state auto-merge was meant
to wait for. Only leave the PR open and comment if a check actually fails or
there is a merge conflict.

## The site reads this from `main` at runtime

The pages fetch these files from `raw.githubusercontent.com/.../main/...`, not
from the build, so a merge publishes the recap without a redeploy. Neither
query is persisted to localStorage and both go stale after 5 minutes, so a new
recap reaches open tabs on its own. If a recap looks missing right after a
merge, check `raw.githubusercontent.com` before suspecting the file.
