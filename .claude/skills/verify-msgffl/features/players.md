# Player Lab

The visitor searches every fantasy-relevant NFL player by name and position for a season's points, and can share or reload the filtered view.

## Sub-features

- `players-search` the search box narrows rows to names containing the text, after a short debounce, and writes `?q=`.
- `players-pos` a position pill narrows to that position and writes `?pos=` (`ALL` removes it).
- `players-url` a reload restores the box and the same rows from the URL.
- `players-scoring` the header names the league's scoring (HALF PPR for 2024).

## How to get to it (user POV)

- Header `PLAYERS`.
- A deep link `/players?season=2024&q=josh&pos=QB`.

## Driving it with verify-msgffl

Preconditions: `/players/nfl` (about 5 MB, trimmed in the app) and `/stats/nfl/regular/2024` are cached.

- **Open.** `/players?season=2024`. Text `<n> PLAYERS · TOP 150 SHOWN`.
- **Search.** Fill `textbox "search a guy…"` with `josh`. URL `q=josh`, the count drops below the unfiltered count, and every row's name contains `josh`.
- **Position.** Click `button "QB"`. URL `pos=QB`, every row's position reads `QB`, every name still contains `josh`.
- **Reload.** The box holds `josh` and the rows are the same names in the same order.
- Run: `node $V drive players`.

## Gotchas

- The URL update is debounced; wait for `q` in the URL, not a fixed sleep.
- Rows have no role: `main [class*="_row_"]`, name `[class*="_name_"]`, position `[class*="_pos_"]`.
- Only the top 150 rows render; assert on a query narrow enough to fit.
