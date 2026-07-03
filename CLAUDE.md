# Maintaining the M$G League Site (guide for Claude Code)

## What ships
`index.html` is the entire production site — one self-contained file (UI + data layer + logo + fonts inlined). `src/` holds the readable source it was built from: `MSG League Site.dc.html` (all screens/components) and `sleeper.js` (data layer). For quick fixes, edit `index.html` directly (same code, inlined). For larger work, treat `src/` + `design/DESIGN-SYSTEM.md` as the spec and keep `index.html` the deployed artifact.

## Hard rules
- **Styling is inline** on elements; the only stylesheet content is `@keyframes` + body reset. Reuse exact tokens from `design/DESIGN-SYSTEM.md` — don't invent colors or sizes.
- **Type floor 11px**; tracking only on uppercase condensed labels.
- **Entrance animations must be transform-only.** Never animate opacity from 0 on page containers — it blanks thumbnails, PDF export, and background-tab first paint.
- **Copy tone is a feature**: sarcastic league banter ("savage"), with tamer variants behind the `snark` prop. When adding copy, write both.
- Never clear localStorage keys you didn't write. Site keys: `msg1_players_v2`, `msg1_wk_<leagueId>`, `msg1_season_<leagueId>_v2`, `msg_suggestions_v1`.

## Data layer
The helpers live **inside the component class** (`makeS()`, so the single-file build is fully self-contained), with an identical standalone ES-module mirror at `src/sleeper.js` for reuse in other stacks. Keep the two in sync if you change one.
- Base: `https://api.sleeper.app/v1`, read-only, no auth.
- `walkChain(id)` follows `previous_league_id` to build the season list (2022→). The app also auto-discovers the NEXT season by checking a member's leagues for one whose `previous_league_id` matches the newest known league.
- `LEAGUE_ID = '1180618034447187968'` lives in the component class.
- Player DB: `/players/nfl` is huge — always trim (QB/RB/WR/TE/K/DEF, active) and cache 7 days.
- Completed seasons are immutable — cache their matchups/standings permanently.
- Scoring key auto-detected from `league.scoring_settings.rec` (1 → pts_ppr, .5 → pts_half_ppr, else pts_std).

## Derived features (all computed client-side)
- Standings sort: wins desc, then PF. Badges: top `playoff_teams` = PLAYOFFS, last + season complete = SACKO.
- Matchup tags per week: max margin = MASSACRE, min nonzero = PHOTO FINISH, top single score = WEEK'S NUKE.
- Power index: `wins*3 + normalized_PF*4 + last5_wins*0.8`.
- Draft grades: rank teams by total season pts of drafted players; A+ → F by rank bucket.
- Record book scans every season's weekly scores (skips 0–0 unplayed pairs).
- Rivalry (H2H) records pair regular-season matchups by `matchup_id`, keyed by owner id across seasons.

## League-specific notes
- 14 teams. Seasons on Sleeper: 2022–2025 (+2026 pre-draft). Pre-draft seasons must show offseason copy, never 0.00-PF stats.
- Suggestion Box is per-device by design (no backend); COPY ALL exports the docket. Upgrade path: GitHub Issues or a form endpoint.
- Constitution articles VI (dues) and VII (punishment history) are placeholders the commish should fill in.
