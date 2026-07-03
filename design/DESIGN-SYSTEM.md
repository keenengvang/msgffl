# M$G League — Design System

Theme: **dark broadcast command center**, derived entirely from the league badge (navy field, red ring, white monogram). Tone of voice: sarcastic league banter.

## Logo

- `assets/logo-original.jpg` — source badge (white background). Use on light surfaces.
- `assets/logo-circle.png` — circular crop with transparency, for dark surfaces. Header 52px, footer 30px.
- Clear space ≥ 25% of badge diameter. Never recolor or stretch.

## Color

**Backgrounds**
- Page: `#070d20`
- Header gradient: `#0a1533 → #081128`
- Panel / card: `#0d1b40` · deep panel & inputs: `#0a1533`
- Trophy-card gradient: `#122457 → #0d1b40`

**Brand red**
- Primary accent: `#e60c1a` (active states, bars, W indicators, badges)
- Deep red (gradient pair): `#b30916`
- Red tints: bg `rgba(230,12,26,.08–.2)`, borders `rgba(230,12,26,.35–.6)`

**Text** (dark bg)
- Primary: `#ffffff` / `#f5f7fc`
- Body: `#d6e0f5`
- Secondary: `#b5c3e4`
- Muted labels: `#a7b8de`
- Dim (11px minimum size at this color): `#8194c4`
- Deepest (decorative only): `#5e719f`

**Semantic**
- Win / positive diff: `#7ee2a8`
- Loss / alert: `#ff9aa2`
- Sacko / shame: `#dfa0aa`

**Hairlines & borders**: `rgba(255,255,255,.09)` dividers; `.14–.18` alpha for interactive borders.

**Position colors**: QB `#ff4d6d` · RB `#00ceb8` · WR `#58a7ff` · TE `#ffae58` · K `#c58fff` · DEF `#9aa7c7`

## Typography (Google Fonts)

Families: **Archivo Black** (display) · **Barlow Condensed** 400–800 (headings, labels, UI) · **Barlow** 400–700 (body) · **IBM Plex Mono** 400–600 (data).

| Role | Spec |
|---|---|
| Hero display | Archivo Black, `clamp(38px, 4.6vw, 60px)`, line-height .98, uppercase |
| Page title | Archivo Black 34px, uppercase, red season suffix |
| Section heading | Archivo Black 22px |
| Panel label | Barlow Condensed 700, 13–14px, tracking .18em, uppercase |
| Team / card title | Barlow Condensed 700–800, 16–18px |
| Nav item | Barlow Condensed 600, 14.5px, tracking .13em |
| Body copy | Barlow 400–600, 14px / 1.55 |
| Data & micro-labels | IBM Plex Mono, 12px (11px absolute floor) |

**Rules:** nothing under 11px, ever. Letter-spacing (.16–.2em) only on uppercase condensed labels — never on body or mono content. All numerals in mono for alignment.

## Layout

- Content max-width **1380px**, gutter 26px
- Radius: cards **10px**, inner cells 6px, pills 5px
- Panel padding 16–22px; grid gaps 18–26px
- Responsive: CSS grid `repeat(auto-fit, minmax(280–340px, 1fr))`; wide tables get `min-width` + horizontal scroll on small screens

## Motion

| Name | Spec | Used for |
|---|---|---|
| `msgUp` | translateY(10px) → 0, .45s ease | page-enter. **Transform-only by design** — never animate opacity from 0 on page containers (breaks thumbnails/PDF/background-tab paint) |
| `msgMarquee` | translateX 0 → −50%, 32s linear ∞ | ticker (content duplicated 2× for a seamless loop) |
| `msgSweep` | rotate 360°, 4.5s linear ∞ | radar conic-gradient wedge |
| `msgPulse` | opacity 1 → .22, 1.6s ∞ | live-status dots, cursor blocks |

Hovers: borders → `rgba(230,12,26,.5)`; cards lift `translateY(-2px)`; CTAs `brightness(1.08)`. All motion sits behind the `motion` prop.

## Component inventory (reference implementations in `src/`)

- **League Wire ticker** — red bar, navy tag chip, 14px BC600 marquee
- **Header** — badge + wordmark stack, season pills, mono live-status chip, red-underline active nav
- **Panel** — `#0d1b40`, hairline border, label row with red "ACTION →" link
- **Standings row** — rank (red = playoff seed), 26px avatar, team/owner stack, BC800 record, PF bar, mono numerals, status badge (CHAMPION / PLAYOFFS / SACKO)
- **Matchup card** — tag chip (auto: MASSACRE / PHOTO FINISH / WEEK'S NUKE), two team rows, winner = white text + red-ring avatar, mono scores + margin
- **Draft cell** — 126px, position-color top border, mono pick number, drafted-by
- **Grade card** — 52px grade tile (A green → F red), snark blurb, mono total
- **Threat radar** — 118px circle, two inner rings, conic sweep, 3 blips, mono threat list
- **Intel feed** — mono lines, red `>` prompt, highlighted values
- **Trophy card** — gradient bg, ghost year numeral, red-ring 52px avatar, runner-up + sacko footnotes
- **Record card** — red tracked label, Archivo Black value, holder + mono context
- **Bracket game** — two-row card, winner bold white + W tag, red border for title game
- **Power row** — outlined rank numeral, index bar, trend (L5), snark blurb
- **Suggestion card** — red author, mono timestamp, ✕ delete; form = select + textarea + red submit
