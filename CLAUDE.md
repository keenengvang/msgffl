# M$G Fantasy Football League — engineering guide

Live league hub for a 14-team Sleeper league (est. 2012). React + Vite + TypeScript SPA,
all data pulled live from the Sleeper public API (no auth, no backend). Deploys to Netlify
as a static site. `legacy/` holds the old single-file site — it is the **pixel and logic
reference only** and must never be imported; `design/DESIGN-SYSTEM.md` is the styling
source of truth.

## Commands

```
npm run dev        # Vite dev server
npm run build      # tsc -b && vite build → dist/
npm run preview    # serve the production build
npm run typecheck  # tsc -b
npm run lint       # eslint src (includes FSD import-boundary rules)
npm run test       # vitest run (unit tests for pure model/lib functions)
```

## Architecture — Feature-Sliced Design

Layers, top to bottom. **Imports flow downward only** (enforced by ESLint
`no-restricted-imports` zones in `eslint.config.js`; aliases `@/…` map to `src/…`):

```
app/       providers (QueryProvider w/ persister), main.tsx
routes/    TanStack Router file-based route glue — thin: createFileRoute +
           validateSearch + a page import. (Documented exception: routes are
           app-layer glue that imports pages.)
pages/     one slice per route: ui/ (component + .module.css) and model/
           (page-local pure math: powerIndex, draftGrades, heroCopy, ruleArticles…)
widgets/   root-layout chrome only: header, ticker, footer
features/  league-history — the ONLY feature. Composes several entities across
           all seasons; consumed by both /history and /teams/$ownerId.
entities/  one slice per Sleeper domain: league, team, matchup, player, draft,
           bracket, suggestion. Each: api/ (query hooks), lib/ (pure functions),
           ui/ (dumb display components), model/ (types).
shared/    api (fetch wrapper, wire types, query-key factory), config, lib,
           styles (tokens/global/keyframes), ui primitives.
```

Where does new code go?
- **A Sleeper resource** → an entity (hook in `api/`, math in `lib/`).
- **Cross-entity derived data used by 2+ pages** → a feature.
- **Math used by exactly one page** → `pages/<page>/model/` as a pure function.
- **A reusable dumb visual** → `shared/ui/` (if league-agnostic) or the entity's `ui/`.

Second documented exception: two global utility classes in `shared/styles/global.css`
(`.uLabel` tracked condensed label, `.uMono` tabular mono data) plus `.pageWrap` /
`.pageEnter`— everything else is CSS Modules.

## Data layer

- Base: `https://api.sleeper.app/v1` via `shared/api/sleeper.ts`. `LEAGUE_ID` lives in
  `shared/config/constants.ts`.
- **Every query key comes from the factory** `shared/api/queryKeys.ts` (`qk.*`).
- Dependent flow: `useNflState` (resolves null on failure) → `useLeagueChain`
  (walkChain + next-season auto-discovery via members' leagues) → everything else,
  each hook `enabled: !!league`.
- Caching semantics (per-query `staleTime`):

  | resource | staleTime | persisted | why |
  |---|---|---|---|
  | nfl-state | 5 min | no | cheap, always refetched |
  | chain | 1 h | yes | season list changes rarely |
  | users / rosters / brackets | complete ? ∞ : 5 min | yes | completed seasons are immutable |
  | weeks (1–17, trimmed) | complete ? ∞ : 60 s | yes | trimmed to `{m,r,p}` inside the queryFn |
  | draft + picks | complete ? ∞ : 5 min | yes | function-form staleTime off fetched status |
  | stats/{season} | complete ? ∞ : 6 h | yes | past seasons never change |
  | players-trimmed | 7 days | yes | see below |
  | season-bundle | complete ? ∞ : 10 min | yes | history feature |

- **Never cache raw `/players/nfl`** — it's ~5MB. `usePlayersDb` trims inside the
  queryFn (QB/RB/WR/TE/K/DEF, active-only except DEF) so only ~200KB enters the
  cache/persister. Keep it that way.
- Persistence: `PersistQueryClientProvider` + localStorage under `msgffl-query-cache`,
  `maxAge: Infinity`, cache **buster `'v1'`** — bump the buster in
  `app/providers/QueryProvider.tsx` whenever a cached shape changes.
- Scoring key auto-detected from `league.scoring_settings.rec`
  (`entities/league/lib/ptsKey.ts`): 1 → pts_ppr, 0.5 → pts_half_ppr, else pts_std.
- Derived aggregates (record book, all-time, H2H, power index, grades) are **computed
  in useMemo / page models, never cached**.

## Routing

File-based via `@tanstack/router-plugin`; `src/routeTree.gen.ts` is generated (committed,
never hand-edited). Client state lives in the URL:

- `?season=` — root search param, retained across navigation by `retainSearchParams`
  middleware in `__root.tsx`. Absent → active league (newest complete/in-season).
  **Gotcha:** the router JSON-parses search values, so `season=2024` arrives as a
  *number* — validateSearch coerces; don't typeof-check for string.
- `/matchups?week=` (1–17; default = title week for complete seasons, else live week),
  `/players?q=&pos=`, `/teams/$ownerId`.
- No Zustand. Remaining client state: form fields (`useState`), the suggestion docket
  (localStorage hook), and the vibes context below.

## Design-system hard rules (from design/DESIGN-SYSTEM.md)

- **Tokens only**: every color/radius/font in `shared/styles/tokens.css`; **no raw hex
  in any `.module.css`** (grep-checkable; hairline rgba() whites are the one latitude).
- **Type floor 11px.** Letter-spacing only on uppercase condensed labels — never body/mono.
- **All numerals in mono** with `font-variant-numeric: tabular-nums`.
- **Entrance animations are transform-only** (`msgUp`). Never animate opacity from 0 on
  page containers — it blanks thumbnails, PDF export, and background-tab first paint.
- All motion is gated twice: the `useVibes().motion` toggle (`data-motion` attribute on
  the app root) and `prefers-reduced-motion`.
- Hovers: borders → red, cards lift `translateY(-2px)`, CTAs `brightness(1.08)`.

## Copy tone

Sarcastic league banter is a feature. Every new user-facing string ships **both**
variants — savage and polite — switched by `useSavage()` / `useVibes().snark`
(see `GRADE_BLURBS` for the pattern).

## League gotchas

- 14 teams; Sleeper seasons 2022→. Pre-draft seasons show offseason copy, never 0.00 stats.
- Champion comes from the **winners bracket** (`titleGame`, p=1 game), not the standings.
- Sacko badge only when `status === 'complete'`.
- H2H rivalry counts **regular season only** (weeks < `playoff_week_start`); record
  scans skip 0–0 unplayed pairs.
- Matchup tag precedence: WEEK'S NUKE > MASSACRE > PHOTO FINISH.
- Constitution articles VI (dues) and VII (punishments) are intentional commish
  placeholders — don't invent numbers.
- Avatar/headshot 404s are handled per-image (`TeamAvatar`, `Headshot`) — no global
  error listeners.

## localStorage

Owned keys: `msgffl-query-cache` (persister), `msg_suggestions_v1` (suggestion docket),
`msg_vibes_v1` (motion/snark). The legacy site's `msg1_*` keys are abandoned — **never
clear keys this app didn't write.**

## Deploy

Netlify: `netlify.toml` builds `npm run build`, publishes `dist/`, SPA redirect
`/* → /index.html 200`. Planned follow-up: suggestions → Notion Tickets database via a
Netlify Function (`netlify/functions/suggest.ts`) holding `NOTION_TOKEN` — env vars in
the Netlify UI, never in the repo.
