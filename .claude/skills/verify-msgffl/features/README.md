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

## Shown red once

Each journey's guarded behaviour, broken in a scratch copy (never committed), and the line the journey failed on. A new journey adds its row here before its pass counts.

| Journey | Break | Failing line |
|---|---|---|
| `season` | `retainSearchParams(['season'])` removed from `__root.tsx` | `getByRole('heading', { name: 'Matchups 2024', level: 1 })`: element(s) not found |
| `matchups` | the week pill navigates without `week` | `getByText('REGULAR SEASON · WEEK 3')`: element(s) not found |
| `matchups` | `MatchupDetailPage` pinned to `matchupId = 1` | after "detail shows both of that game's teams…": `getByText('Bunny Ranchers', { exact: true })`: element(s) not found |
| `players` | `filterPlayers` ignores `pos` | the all-rows-are-QB poll: Expected `true`, Received `false` |
| `champion` | `titleGame` takes the loser | Expected `"lisan al gaib"`, Received `"hmoob meka hiluss"` |
| `bets` | the board stops hiding tombstoned bets | the deleted card's count: Expected `0`, Received `1` |
| `bets` | `betsHandler` never sets `paidAt` (found by the PR #40 verifier) | after "mark it paid": `getByRole('button', { name: 'UNDO PAID' })`: element(s) not found |
| `bets` | `netlify/functions/bets.ts` answers 500 | launch: `server did not become ready` (the readiness probe calls the real entry) |
| `suggest` | the box clears `onSettled` instead of `onSuccess` (also found by the PR #40 verifier) | after "the text survives in the box": Expected the text, Received `""` |
| `wrap` | `sortWeeklySummaryEntries` reversed | Expected the week 10 headline, Received the week 1 headline |

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
