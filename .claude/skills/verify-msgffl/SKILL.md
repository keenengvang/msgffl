---
name: verify-msgffl
description: Drive the M$G Fantasy Football League site (msgffl, React SPA over the Sleeper API, plus its bets and suggestion-box Netlify functions) the way a visitor does, on a local production build, and capture proof. Use to prove a change works in the real app before calling it done, to check a fix against its repro, or when anything on a page, the betting board or the suggestion box looks wrong.
---

# verify-msgffl

Proves behaviour on a **local production build** (`npm run build` → `dist/`), served by a stand-in for Netlify that runs the repo's **real** bets and suggest handlers. The browser is Playwright's Chromium, driven by scripted journeys whose end states are listed in `features/`. Everything this skill writes lives outside the repo, in `~/.cache/verify-msgffl/` (override with `VERIFY_MSGFFL_HOME`).

All commands run from the repo root. `V=.claude/skills/verify-msgffl/scripts/verify.mjs`.

## What a local pass does and does not stand for

| Surface | Locally | So a pass does not cover |
|---|---|---|
| Sleeper API (`api.sleeper.app`) | **Cached on disk** in `~/.cache/verify-msgffl/sleeper/`. First run fetches each URL once live; later runs replay. `VERIFY_SLEEPER=replay` never touches the network (a miss is a 599, listed in `results.json`); `VERIFY_SLEEPER=live` bypasses the cache. | Data newer than the cache: `/state/nfl` and the live week freeze at the cache's age (doctor prints it). Delete the folder to refresh. |
| Weekly recaps (raw.githubusercontent.com, `main`) | Served from **this checkout's** `content/weekly-summaries/`. | That the files are on `main` yet. |
| `/.netlify/functions/bets` | The real `netlify/lib/betsHandler.ts` + real `sleeperFacts`, over `memoryBetStore` (one per server, gone at cleanup). | Netlify Blobs itself (etags across instances, persistence across deploys). |
| `/.netlify/functions/suggest` | The real `netlify/functions/suggest.ts`. Its GitHub call lands in a **fake**: every issue it would file is appended to `<run>/github-outbox.jsonl`. `GET /__verify/github?down=1` makes the fake answer 500 (`down=0` restores). Every other outbound host is refused by the server. | The real GitHub token, labels existing on the repo, Notion's mirror. |
| `/.netlify/functions/chat` | **503**, on purpose (it would spend Anthropic credit). | The chatbot entirely. |
| `netlify.toml` redirects | Exact-path 3xx rules are mirrored (`/power` → `/analytics`); `/*` is the SPA fallback. | Netlify's edge, headers, deploy config. |
| Google Fonts, `sleepercdn.com` images | **Aborted** in the browser. Avatars and headshots show their per-image fallback; text renders in fallback fonts. | Images and webfonts. |

Nothing here needs a share link or a deployed preview, and none may be made: never call `get_access_to_vercel_url`, `web_fetch_vercel_url` or `patch_url_protection_bypass` (msgffl is on Netlify; the rule stands anyway).

## Launch

```
node $V launch               # npm run build, then serve on a free port; prints the URL, run id, pid, sha
node $V launch --no-build    # reuse dist/ (only if you just built this exact tree)
node $V launch --run=fix-42 --port=4300
```

Ready means: `/__verify/health` answers from the pid launch started **and** `GET /.netlify/functions/bets?season=2024` returns 200 (the handler loaded through Vite). Launch exits 1 with the build's output if `npm run build` fails, or with the server log path if it never becomes ready. Each launch is its own run with its own port and bet store, so two runs can sit side by side; the commands below act on the newest live run unless given `--run=<id>`.

## Doctor

```
node $V doctor
```

Read-only. Checks: the run's pid is alive, its port answers with that pid and `app: msgffl`, the instance was built from the current `HEAD`, no app files (`src`, `netlify`, `index.html`, `public`, `vite.config.ts`, `package.json`) changed since launch, the bets function answers, and prints the Sleeper cache mode, size and age. Exit 1 on any ✗. Run it first whenever anything looks off; a ✗ on the sha or on uncommitted changes means **relaunch**, because you would be proving an old build.

## Drive

```
node $V drive                     # every journey
node $V drive bets suggest        # named journeys
node $V drive players --headed    # watch it
node $V snapshot '/teams?season=2024'   # print a page's ARIA tree (find handles before writing a journey)
node $V url                       # the instance URL, for ad-hoc Playwright
```

Journeys live in `scripts/journeys.mjs`, one per file in `features/`: `season`, `matchups`, `players`, `champion`, `bets`, `suggest`, `wrap`. Each prints `PASS`/`FAIL <name>`, and a FAIL names the last step reached and the assertion. Exit 0 only if all pass.

Driving conventions, also for ad-hoc scripts (`import { openBrowser, newContext } from './scripts/browser.mjs'`, which wires the cache and recap routes):

- Handles: headings by role and name (`heading level 1 "Standings 2024"`), the header's season pills (`banner` → `button "2024"`), nav links (`navigation` → `link "MATCHUPS"`), the bet form's pickers (`combobox "Team A"` is `shared/ui/Picker`, an ARIA listbox: click the trigger, then `listbox "Team A"` → `option`), `textbox "search a guy…"`, `textbox "The bet"`, `navigation "Recap archive"`. CSS-module classes are hashed as `_<local>_<hash>`; match `[class*="_row_"]` only where no role exists (Player Lab rows, bet cards).
- `?season=` and `?week=` arrive JSON-encoded in the URL (`season=%222024%22`); compare after stripping quotes.
- The suggestion box's "who" `<select>` has no accessible name: `main select`.
- Copy is savage by default (`msg_vibes_v1` in localStorage); there is no toggle in the UI. Each journey starts in a fresh browser context, so savage copy and an empty query cache.
- Never drive an instance this skill did not launch, and never point it at the live site: the bets board there is the league's real ledger.

## Evidence

Per run, in `~/.cache/verify-msgffl/runs/<run>/`:

- `results.json`: sha, whether the tree was dirty, each journey's pass/fail, the failure text, Sleeper live calls and replay misses.
- `journeys/<name>/steps.log` (every action, the URL after it, and observed values), `final.png`, `final.aria.txt`, plus side-effect reads: `bets-stored.json` (the stored row, read back through the function), `github-outbox.json` (the issue suggest would have filed).
- `github-outbox.jsonl` and `server.log` for the run.

Proof standards: a journey drives the user path (clicks, typing, reloads) and asserts the end state read **after** the action from a second view (a reload, another page that shows the same fact, the stored row, the outbox), never only the screen that took the action. A claim about a change quotes the `PASS`/`FAIL` lines and the `steps.log` lines that show its end state, with the run's sha. A new journey is shown failing once with its guarded behaviour broken (in a scratch copy, never committed) before its pass counts.

## Cleanup

```
node $V cleanup            # stop the newest run's server
node $V cleanup --run=<id> | --all
```

Kills only the process group launch started (by its recorded pid), and removes `state.json`. Evidence, logs and the Sleeper cache stay. To drop the cache: `rm -rf ~/.cache/verify-msgffl/sleeper`. Run cleanup after every failed attempt too.

## Helpers

All in `scripts/`, Node ESM, run with the repo's own `node_modules` (`npm ci` first):

| File | Does |
|---|---|
| `verify.mjs` | The CLI above (executable: `./.claude/skills/verify-msgffl/scripts/verify.mjs doctor` works too). |
| `server.mjs` | The Netlify stand-in. Started by `launch`; never run by hand. |
| `browser.mjs` | `openBrowser()` (Playwright Chromium, falling back to system Chrome) and `newContext(browser, state)` with the routes above. |
| `journeys.mjs` | The journeys and the runner. Add one per new feature file. |
| `sleeper-cache.mjs` | The disk cache and its three modes. |
| `paths.mjs` | Where everything lives. |

Keep the map honest as the app changes: pstack's `maintain-verification-skill` (`system/tools/pstack.md` in EDI says how it is fetched).
