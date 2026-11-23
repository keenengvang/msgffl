# Champion

Every page that names a season's champion names the winner of the winners-bracket title game (the `p=1` game), never the regular-season leader.

## Sub-features

- `champ-bracket` the Gauntlet's banner `★ <team> — <year> CHAMPION` matches the W side of its CHAMPIONSHIP round.
- `champ-standings` the standings mark exactly one row `★ CHAMPION`, that team.
- `champ-wall` the Record Book's trophy wall names that team for the year.

## How to get to it (user POV)

- Header `PLAYOFFS` (`/bracket`), `STANDINGS`, `RECORDS` (`/history`).

## Driving it with verify-msgffl

Preconditions: 2024 brackets and rosters cached. In 2024 the champion (Lisan al Gaib, seed 3) is not the regular-season leader (Hmoob Meka Hiluss, 12–2), which is what makes this season a real test.

- **Bracket.** `/bracket?season=2024`. Read the banner's team, and the team listed just before `W · <pts>` in the CHAMPIONSHIP round. They are equal.
- **Standings.** `/standings?season=2024`. One `link` whose name contains `★ CHAMPION`, and it contains that team.
- **Trophy wall.** `/history`. The text after `2024 CHAMPION` contains that team.
- Run: `node $V drive champion`.

## Gotchas

- The bracket card's W/L come from the game's own scores; the banner and the standings star come from `titleGame()`. Breaking `titleGame` to take the loser fails the journey at the first comparison (`Expected: "lisan al gaib"`, `Received: "hmoob meka hiluss"`).
- The trophy wall shows the season's team name with the manager's name upper-cased above it; match the team name.
