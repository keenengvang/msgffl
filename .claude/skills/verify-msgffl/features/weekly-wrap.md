# Weekly Wrap

The robot's weekly recap: the newest week leads, the archive switches to any earlier week, and a new recap shows up on the next visit because recaps are never persisted.

## Sub-features

- `wrap-newest` with no choice made, the newest season and week in `content/weekly-summaries/index.json` shows.
- `wrap-archive` a `WK n` button in `navigation "Recap archive"` shows that week's file.
- `wrap-no-template` the week-0 template never appears.
- `wrap-fresh` a reload fetches again and shows the newest (the query is kept out of the persister).

## How to get to it (user POV)

- Header `WEEKLY WRAP` (`/weekly-summary`), or Home's Weekly Wrap card.

## Driving it with verify-msgffl

Preconditions: recaps are served from this checkout's `content/weekly-summaries/`, so the expected headlines are read from those files.

- **Newest.** Open `/weekly-summary`. The article's H2 equals the newest file's `headline` (case-insensitive: the page upper-cases it).
- **Archive.** Click `WK <oldest>`. The H2 equals that file's headline and the article reads `WEEK <n> · <season>`.
- **No template.** No `WK 0` button.
- **Reload.** The newest headline is back.
- Run: `node $V drive wrap`.

## Gotchas

- The archive order comes from `sortWeeklySummaryEntries`, not the manifest's order; the manifest is hand-kept. Reversing the sort fails the journey at the first headline.
- The article's date line has no spaces in `innerText` (`WEEK 1·2026·`); match with `\s*`.
