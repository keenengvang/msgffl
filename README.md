# M$G Fantasy Football League — Site

Live league hub for the **M$G Fantasy Football League** (est. 2012). Standings, weekly matchups, draft boards + grades, NFL player stats, team pages, power rankings, playoff brackets, the all-time record book, the league constitution, and a suggestion box — all pulled **live from the Sleeper public API** on every visit.

No backend. No database. No build step. It's a static site.

## Run it

Serve the folder with any static server and open `index.html`:

```bash
npx serve .          # or: python3 -m http.server
```

All data loads client-side from `https://api.sleeper.app` in the visitor's browser.

## Deploy to production (GitHub Pages — free)

```bash
git init
git add .
git commit -m "M$G league site"
git branch -M main
git remote add origin https://github.com/<you>/msg-league-site.git
git push -u origin main
```

Then on GitHub: **Settings → Pages → Source: `main` branch, `/ (root)`** → live at `https://<you>.github.io/msg-league-site/` in about a minute. (Netlify / Vercel / Cloudflare Pages also work with zero config.)

## What's in here

| Path | What it is |
|---|---|
| `index.html` | **The production build.** One self-contained file — UI, data layer, logo, fonts all inlined. This alone is the whole site. |
| `src/MSG League Site.dc.html` | Design source: all screens/components (React-based single-file format). Reference for maintenance; not directly runnable outside the design tool. |
| `src/sleeper.js` | The data layer — plain portable ES module (API calls, standings math, caching). Drop into any stack unchanged. |
| `assets/` | Brand assets: original badge + dark-background circular crop. |
| `design/DESIGN-SYSTEM.md` | Colors, typography, spacing, motion, and per-component specs. |
| `CLAUDE.md` | Maintenance guide for Claude Code. |

## About the design files (fidelity)

These are **high-fidelity** designs built in HTML/React — usable in production as-is (that is exactly what `index.html` is). If your engineers later prefer a conventional stack (Vite + React, Next.js), recreate the screens from `design/DESIGN-SYSTEM.md` with `src/` as the pixel reference, and reuse `src/sleeper.js` verbatim.

## Configuration

- **League ID**: `LEAGUE_ID = '1180618034447187968'` in the component class (same code in `index.html` and `src/`). The site walks `previous_league_id` to load 2022–2025 and **auto-discovers the next season's league** once it exists on Sleeper — normally you never touch this.
- **Tweaks**: `motion` (true/false) and `snark` (`savage` | `polite`) props control animation and copy tone.
- **Caching** (localStorage): trimmed player DB (`msg1_players_v2`, 7-day TTL), completed seasons (`msg1_season_*`, `msg1_wk_*`, permanent), suggestions (`msg_suggestions_v1`).

## Sleeper endpoints used

`/league/{id}` (+`/users` `/rosters` `/matchups/{week}` `/drafts` `/winners_bracket` `/losers_bracket`), `/draft/{id}/picks`, `/user/{id}/leagues/nfl/{year}`, `/state/nfl`, `/players/nfl` (trimmed then cached), `/stats/nfl/regular/{year}`. All read-only, no auth.

## Known limitations / easy upgrades

- **Suggestion Box saves per-device** (there's no backend). Cheap upgrades: point the submit button at GitHub Issues on this repo, or a free Formspree/Google Form endpoint.
- **Constitution articles VI (dues) & VII (punishment history)** are placeholders — edit the copy with your real numbers and lore.
- Player stats are Sleeper's regular-season totals for the selected year.
