# Season

The visitor picks a season from the header pills; every page then shows that season until they pick another, including after a reload or a nav click.

## Sub-features

- `season-pick` a header pill switches the current page to that season.
- `season-retain` nav links carry `?season=` to the next page.
- `season-reload` a reload keeps the season.
- `season-default` with no `?season=`, the newest complete or in-season league shows.

## How to get to it (user POV)

- Click a year pill (`2026` … `2022`) in the header on any page.
- Open a link that already has `?season=`.

## Driving it with verify-msgffl

Preconditions: a launched instance; the cache holds the league chain.

- **Default.** Open `/standings`. The H1 is `Standings <year>` for the newest season.
- **Pick.** Click `banner` → `button "2024"`. The H1 reads `Standings 2024` and the URL's `season` is `2024`.
- **Retain.** Click `navigation` → `link "MATCHUPS"`, then `link "PLAYERS"`. The H1s read `Matchups 2024`, then `Player Lab 2024`.
- **Reload.** Reload. The H1 still reads `Player Lab 2024`.
- Run: `node $V drive season`.

## Gotchas

- Retention is the root route's `retainSearchParams(['season'])` middleware; header nav links pass no search of their own, so dropping it silently resets every page to the default season. Broken once that way, the journey fails at `Matchups 2024`.
- The URL holds `season=%222024%22`; strip quotes before comparing.
