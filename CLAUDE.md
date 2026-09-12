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
npm run lint       # eslint src netlify e2e (includes FSD import-boundary rules)
npm run test       # vitest run (unit tests for pure model/lib functions)
npm run test:e2e   # playwright smoke: builds, previews, hits every route (live API, system Chrome)
```

Testing philosophy: the league math (record book, H2H, power index, grades, standings)
lives in pure functions and is unit-tested — a silent wrong number is this site's worst
bug. E2E is ONE smoke spec (`e2e/smoke.spec.ts`) asserting every route renders real
content with no error panel; don't grow it into per-page assertions.

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

Third documented exception: `netlify/` may import **down into `src/`** (the reverse
never happens — nothing in `src/` imports a function). The chatbot has to quote the same
numbers the pages do, so `netlify/lib/` reuses `buildSeasonBundle`, `recordBook`, `h2h`,
`aggregateAllTime`, `computeStandings`, `pairMatchups` and `weekTags` rather than
reimplementing them server-side. Only React-free `lib/` and `model/` files are fair game.
Mechanically this needs the `@/` alias in **three** places — `tsconfig.app.json` (the SPA),
`tsconfig.node.json` (typechecks `netlify/`, and must `include` `src/**/*.ts` so composite
mode accepts the cross-project imports), and the root `tsconfig.json` (esbuild reads the
*nearest* tsconfig when Netlify bundles a function, and silently fails to resolve `@/`
without it). ESLint's FSD zones only cover `src/`, so the downward-only rule inside
`netlify/` is convention, not enforcement.

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
- **Keyframes used in a `.module.css` must be defined in that same module** — CSS Modules
  scopes animation names, so referencing a keyframe from the global `keyframes.css`
  silently resolves to nothing. Global keyframes are only for global classes (`.pageEnter`).
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
- Record book: win/loss streaks count **regular season only**; fewest-PF and
  best-record records only consider **complete** seasons (a partial year would steal them).
- Matchup tag precedence: WEEK'S NUKE > MASSACRE > PHOTO FINISH.
- Constitution articles VI (dues) and VII (punishments) are intentional commish
  placeholders — don't invent numbers.
- Avatar/headshot 404s are handled per-image (`TeamAvatar`, `Headshot`) — no global
  error listeners.

## localStorage

Owned keys: `msgffl-query-cache` (persister), `msg_vibes_v1` (motion/snark). The legacy
site's `msg1_*` keys and the old `msg_suggestions_v1` docket are abandoned — **never
clear keys this app didn't write.**

## Deploy

Netlify: `netlify.toml` builds `npm run build`, publishes `dist/`, SPA redirect
`/* → /index.html 200`.

**Suggestion box backend**: `netlify/functions/suggest.ts` — POST `{who, text}` creates
a `suggestion`-labeled GitHub issue on this repo (Notion mirrors them via its GitHub
connector; that synced database is read-only in Notion). Requires `GITHUB_TOKEN` in the
Netlify UI env vars: a fine-grained PAT scoped to ONLY this repo with Issues read/write
(these expire — max 1 year — renew when it lapses). Optional `GITHUB_REPO` overrides the
default `keenengvang/msgffl`. Validation: text ≤ 1000 chars, best-effort 5/hour/IP rate
limit. The client (`entities/suggestion/api/submitSuggestion.ts`) submits via mutation;
on failure the text stays in the form (nothing is lost), on success the page links to
the created issue. The old localStorage docket is retired — GitHub *is* the docket
(`SUGGESTIONS_URL` in shared/config/constants). The function is a plain
`Request → Response` handler, unit-tested in vitest with a mocked fetch — no Netlify
CLI needed for tests.

**Chatbot backend**: `netlify/functions/chat.ts` — POST `{messages, snark}` → `{text}`.
Requires `ANTHROPIC_API_KEY` in the Netlify UI env vars (never a `VITE_` var — those ship
to the browser). The Messages API is stateless, so the browser owns the transcript and
replays it every turn, windowed to 40 turns × 2000 chars by `widgets/chatbot`.

The analyst knows the league two ways, both built in `netlify/lib/`:

- **The brief** (`brief.ts`) — standings, all-time table, champions/sackos, record book
  and the live week, rendered to ~1000 tokens of plain text into the system prompt on
  every turn. Most questions never touch a tool, which is the point: a synchronous
  Netlify function has ~10s, and each extra hop is another round trip.
- **Five tools** (`tools.ts`) — `get_team`, `get_matchups`, `get_head_to_head`,
  `get_season`, `search_players`. Shaped like the questions people ask, **not** like the
  Sleeper endpoints: `/matchups/{week}` is 28 rows of `{matchup_id, roster_id, points}`
  with no names, so endpoint-shaped tools would cost three round trips and a join for
  "who played who". Team arguments are free text resolved by `names.ts`, which returns
  **candidates instead of guessing** when ambiguous — a confidently wrong owner poisons
  every number after it.

`league.ts` is the server's answer to TanStack Query: the same fetches behind a warm
module-scope cache on the function instance, with the client's freshness rules (chain 1 h,
completed season ∞, live season 5 min, a rejected fetch evicted immediately so one Sleeper
blip isn't cached for an hour). A cold snapshot is ~80 Sleeper requests and lands in well
under a second. `players.ts` loads `/players/nfl` **lazily** — only tools that need a
player name pay for it, and it's trimmed on arrival like `usePlayersDb`.

Loop control: `MAX_TOOL_ROUNDS` hops, and past `DEADLINE_MS` the tools are dropped from
the request so the model must answer in words instead of starting a round there's no time
to finish. If Sleeper is down the chat still answers and says the data is missing.
Model is `claude-sonnet-5` — tool use here is a multi-hop join and Haiku fumbles the
chain; it's a one-line swap in `chat.ts` if the bill argues.
