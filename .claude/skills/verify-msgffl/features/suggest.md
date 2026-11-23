# Suggestion box

A visitor files a proposal (optionally signed) that becomes a `suggestion`-labelled GitHub issue; if that fails, the text stays in the box so nothing is lost.

## Sub-features

- `suggest-fail-keeps` a failed submit shows `HQ UNREACHABLE…` and leaves the text in the box.
- `suggest-file` a good submit shows `FILED AS TICKET #n`, clears the box, and files exactly one issue labelled `suggestion`, signed by the picked manager.
- `suggest-anon` no name picked signs it `ANONYMOUS COWARD` (not asserted yet).

## How to get to it (user POV)

- Header `SUGGESTION BOX` (`/suggest`).

## Driving it with verify-msgffl

Preconditions: a launched instance (the fake GitHub starts up).

- **GitHub down.** `GET /__verify/github?down=1`. Open `/suggest`, pick `Keeneng` in `main select`, fill the textbox (accessible name starts `e.g. 'two flex spots'`), click `SUBMIT TO LEAGUE ⏎`. `HQ UNREACHABLE` shows, the box still holds the text, the outbox gained nothing.
- **GitHub back.** `GET /__verify/github?down=0`, click submit again. `FILED AS TICKET #<n>` shows, the box is empty, and the outbox gained one entry whose labels include `suggestion` and whose body starts with the text and names `**Keeneng**`.
- Run: `node $V drive suggest`. The filed request lands in `journeys/suggest/github-outbox.json`.

## Gotchas

- The real function is rate-limited to 5 submissions an hour per IP inside one server; reruns past that get 429. Relaunch.
- The "who" select has no accessible name; `main select` is the handle.
- Nothing ever reaches GitHub: the server refuses every outbound host except Sleeper, and the fake answers for `verify-msgffl/sandbox`.
