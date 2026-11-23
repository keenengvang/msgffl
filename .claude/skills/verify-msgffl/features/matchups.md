# Matchups

The visitor browses a season's games week by week, opens one game for both lineups side by side, and comes back to the same week.

## Sub-features

- `matchups-week` a week pill shows that week's seven games and writes `?week=`.
- `matchups-detail` a game card opens `/matchups/<week>/<id>` with both teams' starters.
- `matchups-back` the detail's `← WEEK n` link returns to that week.
- `matchups-tags` cards carry WEEK'S NUKE / MASSACRE / PHOTO FINISH tags (not asserted yet).

## How to get to it (user POV)

- Header `MATCHUPS`, then a `WK n` / `QF W15` / `SEMI W16` / `SHIP W17` pill.
- A deep link `/matchups?season=2024&week=14`.

## Driving it with verify-msgffl

Preconditions: 2024 weeks are in the cache.

- **Open.** `/matchups?season=2024&week=14`. Text `REGULAR SEASON · WEEK 14`.
- **Switch week.** Click `button "WK 3"`. Text `REGULAR SEASON · WEEK 3`, URL `week=3`, exactly 7 card links, every href starting `/matchups/3/`.
- **Detail.** Read the 4th card's two teams and final scores (a different game from card 1), and click it. The path is that card's `/matchups/3/<id>`, `STARTERS` shows, both of its teams and scores are on the page, none of game 1's teams is, and `link "← WEEK 3"` is there.
- **Back.** Click `← WEEK 3`. Text `REGULAR SEASON · WEEK 3`.
- Run: `node $V drive matchups`.

## Gotchas

- Always open a card that is not the first: a detail page that ignores its id shows game 1, and a journey on card 1 would pass it.
- Playoff weeks label as `QF W15` etc. and their header text differs; the journey stays in the regular season.
- A complete season defaults to the title week, a live one to the current week; always deep-link the week you mean.
