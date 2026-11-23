# msgffl verification map

The maintained source for verifying what a visitor does on the M$G site. Read this index before driving the app, then use the matching feature file as the recipe. Every file has a journey of the same name in `../scripts/journeys.mjs`.

## Baseline preconditions

- `npm ci` has run; `node .claude/skills/verify-msgffl/scripts/verify.mjs launch` reports `✓ ready` and `doctor` exits 0.
- The instance is one this run launched (doctor's pid check), built from the commit being proved.
- Data is the league as Sleeper serves it, through the disk cache. The journeys use **2024**, a complete season, so its numbers never change; current-season checks read whatever the cache holds.
- Each journey opens a fresh browser context: empty localStorage, savage copy, no persisted query cache.

## Driving conventions

- Roles and accessible names first; hashed CSS-module classes (`[class*="_row_"]`) only where the UI has no role.
- Strip the JSON quotes the router puts on `?season=` / `?week=` before comparing.
- A mutation (a bet, a suggestion) is read back through a second view: a reload, the function's own GET, or the GitHub outbox.

## Proof and skip reporting

- Quote the `PASS`/`FAIL` line, the run's sha, and the `steps.log` lines that show the end state.
- Name any row whose surface a local run stubs (see SKILL.md's table) as not proved locally: the chatbot always is.
- An entry point not driven is reported as not verified, never as verified through another path.

## Features

| File | Journey | Guards |
|---|---|---|
| [season.md](./season.md) | `season` | the chosen season follows the visitor across pages and reloads |
| [matchups.md](./matchups.md) | `matchups` | picking a week shows that week's games, and a game opens its own detail |
| [players.md](./players.md) | `players` | search and position filter narrow the Player Lab, and live in the URL |
| [champion.md](./champion.md) | `champion` | the champion is the title game's winner on every page that names one |
| [bets.md](./bets.md) | `bets` | a booked bet persists, takes a ruling and a payout, and a delete is a tombstone |
| [suggest.md](./suggest.md) | `suggest` | a failed submit keeps the text; a good one files exactly one labelled issue |
| [weekly-wrap.md](./weekly-wrap.md) | `wrap` | the newest recap leads, the archive switches weeks, week 0 never shows |

Not yet mapped: teams grid and team detail (`/teams`, `/teams/$ownerId`), draft board and grades (`/draft`), analytics tabs (`/analytics?tab=race|skill|roster`), rule book (`/rules`), home, the league wire ticker, the chatbot (not drivable locally). The repo's `e2e/smoke.spec.ts` renders every route; it proves wiring, not behaviour.
