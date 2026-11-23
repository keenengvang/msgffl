# Betting board

Anyone books a free-text side bet between two managers for a week; the bookie rules a winner, marks it paid, and can delete it, and the board reads the same after a reload because the function holds it.

## Sub-features

- `bets-book` the form (Team A, Team B, Week, the bet) enables `BOOK IT ⏎` and books a card.
- `bets-persist` a reload shows the card again, from the function's store.
- `bets-rule` `<team> won` on a card settles it and shows `MARK PAID`.
- `bets-pay` `MARK PAID` records `paidAt` and shows `UNDO PAID`.
- `bets-delete` `DELETE` (with a confirm) hides the card for good; the record stays as a tombstone in the full export.
- `bets-filter` ALL / PENDING / PAY UP / PAID ✓ chips and the bet-record table (not asserted yet).

## How to get to it (user POV)

- Header `BETTING BOARD` (`/bets`).

## Driving it with verify-msgffl

Preconditions: a launched instance (each run has its own Blobs directory, `<run>/blobs`); 2024 rosters cached (the handler checks sides against Sleeper).

- **Book.** `/bets?season=2024`. `BOOK IT` is disabled. Pick `combobox "Team A"` option 1, `combobox "Team B"` option 2, `combobox "Week"` `WEEK 3`, fill `textbox "The bet"` with a unique string, click `BOOK IT`. One card holds the string.
- **Persist.** Reload. Still one card. `GET /.netlify/functions/bets?season=2024` has the row with `week: 3` and no winner.
- **Rule and pay.** Click the card's first `… won` button, then `MARK PAID`. `UNDO PAID` shows; the stored row has `winner: "A"` and a `paidAt`.
- **Delete.** Click `DELETE`, accept the confirm. The card is gone, and gone after a reload; `GET /.netlify/functions/bets` (no season) still has the row with `deletedAt` set.
- Run: `node $V drive bets`. The stored row lands in `journeys/bets/bets-stored.json`.

## Gotchas

- The pickers are `shared/ui/Picker` (ARIA listbox), not `<select>`: `selectOption` throws; click the trigger, then the option.
- Bet cards have no role: `[class*="_cardCell_"]` filtered by the bet's text.
- The store is per run: a relaunch starts empty. Never drive the live site's board; it is the league's real ledger.
- Writes are rate-limited at 60 an hour per client; each browser context is its own client, so reruns don't share the limit.
