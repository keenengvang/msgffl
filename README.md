# M$G Fantasy Football League — Site

Live league hub for the **M$G Fantasy Football League** (est. 2012, 14 teams). Standings,
weekly matchups, draft boards + grades, NFL player stats, team dossiers, power rankings,
playoff brackets, the all-time record book, the league constitution, and a suggestion box —
all pulled **live from the Sleeper public API** in the visitor's browser. No backend, no
database.

Built with **React + Vite + TypeScript**, **TanStack Router** (file-based, state in the
URL), **TanStack Query** (all fetching/caching, persisted to localStorage), and
**CSS Modules** over a design-token layer. Architecture follows **Feature-Sliced Design**
— see [CLAUDE.md](CLAUDE.md) for the full engineering guide and
[design/DESIGN-SYSTEM.md](design/DESIGN-SYSTEM.md) for the visual spec.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

Other scripts: `build`, `preview`, `typecheck`, `lint`, `test`.

## Deploy (Netlify)

`netlify.toml` is checked in: build `npm run build`, publish `dist/`, SPA redirect
included. Connect the repo in the Netlify UI (or `netlify deploy --prod`) and it ships.

Planned follow-up: the Suggestion Box submits tickets to a Notion database via a Netlify
Function (`NOTION_TOKEN` lives in Netlify env vars, never in the repo). Until then the
docket is per-device with a COPY ALL export.

## What's in here

```
src/            the app (FSD layers: app/routes/pages/widgets/features/entities/shared)
design/         DESIGN-SYSTEM.md — colors, type, spacing, motion (source of truth)
legacy/         the original single-file site — pixel/logic reference only
netlify.toml    build + SPA redirect
```

## League config

- League chain is discovered at runtime from `LEAGUE_ID`
  (`src/shared/config/constants.ts`) by walking `previous_league_id`, plus
  auto-discovery of newer seasons via members' league lists — normally you never touch it.
- Scoring key (PPR / half / standard) is detected from the live league settings.
- Completed seasons are treated as immutable and cached permanently
  (localStorage key `msgffl-query-cache`).
- Motion and copy tone (`savage` | `polite`) are user toggles persisted per device.

## Sleeper endpoints used

`/league/{id}` (+`/users` `/rosters` `/matchups/{week}` `/drafts` `/winners_bracket`
`/losers_bracket`), `/draft/{id}/picks`, `/user/{id}/leagues/nfl/{year}`, `/state/nfl`,
`/players/nfl` (trimmed in the queryFn before caching), `/stats/nfl/regular/{year}`.
All read-only, no auth.

## Known limitations

- **Suggestion Box saves per-device** until the Notion endpoint ships.
- **Constitution articles VI (dues) & VII (punishment history)** are placeholders —
  edit with the real numbers and lore.
- Player stats are Sleeper's regular-season totals for the selected year.
