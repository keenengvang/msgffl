import type { Snark } from './constants';

/* ──────────────────────────────────────────────────────────────────────────
   THE BANTER VAULT
   Every pool ships both tones (savage + polite) — house rule, see CLAUDE.md.
   Lines are picked deterministically via pickBanter(pool, snark, seed):
   seed with `${season}-${rosterId}` so each team keeps its line all season
   and draws a fresh one next year. Add lines freely; never delete a tone.
   ────────────────────────────────────────────────────────────────────────── */

export interface BanterPool {
  savage: string[];
  polite: string[];
}

/** djb2 — tiny stable string hash for deterministic line selection. */
function hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return h >>> 0;
}

/** Deterministic line pick. Pass a shared `used` set when rendering a list so
    hash collisions step to the next free line instead of repeating on-page. */
export function pickBanter(pool: BanterPool, snark: Snark, seed: string, used?: Set<string>): string {
  const lines = pool[snark === 'polite' ? 'polite' : 'savage'];
  let idx = hash(seed) % lines.length;
  if (used) {
    for (let step = 0; step < lines.length && used.has(lines[idx]!); step++) idx = (idx + 1) % lines.length;
    used.add(lines[idx]!);
  }
  return lines[idx] ?? '';
}

/* ── POWER RANKINGS ─────────────────────────────────────────────────────── */

export const POWER_BANTER = {
  /** Reigning champion. */
  champ: {
    savage: [
      'Has the belt. Insufferable about it.',
      'Won it all and reminds the chat daily.',
      'The belt lives here now. Rent is trash talk.',
      'Champion. Legally allowed to skip your trade offers.',
      'Still doing victory laps. It has been months.',
      'Signs texts with the trophy emoji now.',
      'The commissioner fears them. So does math.',
      'Defending champ. Offense: elite. Humility: waived.',
      'Put the ring on and never took it off.',
      'Champion until proven otherwise. Nobody has proven otherwise.',
    ],
    polite: [
      'The reigning champion.',
      'Holder of the belt, fair and square.',
      'Last season ended at the top. Well earned.',
      'The champion, defending with confidence.',
      'Winner of the whole thing. Congratulations stand.',
      'The title holder until someone takes it.',
      'Earned the crown. Wears it well.',
      'Champion — the résumé speaks for itself.',
      'The one everyone is chasing this year.',
      'Started from the draft, ended with the belt.',
    ],
  },
  /** League leader in points-for. */
  pfKing: {
    savage: [
      'Scoreboard bully. Points hog. Menace.',
      'Treats every week like a personal high-score run.',
      'Their bench outscores your starters. Sit with that.',
      'Runs up the score out of principle.',
      'The scoreboard files a complaint every Sunday.',
      'Points for days. Mercy for no one.',
      'Playing a different sport. It is called winning.',
      'Offense so loud the neighbors complained.',
      'Averaging disrespect per game. League leader.',
      'Somebody unplug their lineup. Please.',
    ],
    polite: [
      "The league's top scorer.",
      'Leads the league in points for.',
      'The highest-powered offense in the league.',
      'Setting the scoring pace this season.',
      'The scoreboard favors them, week after week.',
      'Point production the rest can only envy.',
      'A truly relentless offense.',
      'The measuring stick for scoring this year.',
      'Consistently the biggest number on the board.',
      'An offense firing on every cylinder.',
    ],
  },
  /** Most points allowed. */
  paMax: {
    savage: [
      'Plays defense like a screen door.',
      'Opponents schedule their season high here.',
      'A generous host. Every opponent leaves full.',
      'The league’s favorite matchup. That is not a compliment.',
      'Runs a charity for opposing offenses.',
      'Their opponents’ group chat is just thank-you notes.',
      'All gas from the other team, no brakes from this one.',
      'Every week is take-your-opponent-to-work day.',
      'Points against: record-setting. Sympathy: pending.',
      'The welcome mat of the league.',
    ],
    polite: [
      'Took some tough beats on points against.',
      'The schedule has not been kind.',
      'Faced the hottest lineups every single week.',
      'Points against leader — pure bad luck.',
      'Ran into a buzzsaw more than once.',
      'Opponents saved their best for this matchup.',
      'A season of unfortunate timing.',
      'Deserved better from the schedule.',
      'The luck has to turn eventually.',
      'Weathering a storm of opposing career weeks.',
    ],
  },
  /** Locked-in last place, season complete. */
  sacko: {
    savage: [
      'Punishment loading. Thoughts and prayers.',
      'The ceremony committee has been notified.',
      'Last place. The league is accepting punishment proposals.',
      'Historically bad. The record book flinched.',
      'The sacko belt fits. It was custom made.',
      'Next year’s draft pick: hopefully better instincts.',
      'The punishment clause sends its regards.',
      'Finished last. The autopsy is scheduled.',
      'A season so bad it needs a documentary.',
      'The floor. The literal floor.',
    ],
    polite: [
      'A rebuilding year.',
      'A tough season — next year is a fresh start.',
      'Sometimes the ball just does not bounce your way.',
      'A learning experience from start to finish.',
      'The draft board owes them one next year.',
      'Every dynasty starts somewhere. Usually here.',
      'A season to file away and move on from.',
      'The comeback story starts now.',
      'Down this year, dangerous next year.',
      'Character-building, they call it.',
    ],
  },
  /** Exactly .500. */
  fiveHundred: {
    savage: [
      'Aggressively mediocre. The .500 lifestyle.',
      'Perfectly balanced. Perfectly forgettable.',
      'The definition of “fine.” Nothing more.',
      'Wins one, gifts one. A rhythm, technically.',
      'The league’s beige wallpaper.',
      'Vibes: neutral. Threat level: also neutral.',
      'Coin-flip football. The coin is tired.',
      'Neither feared nor pitied. Impressive, honestly.',
      'A .500 record and a 1.000 excuse rate.',
      'The most committed fence-sitter in the league.',
    ],
    polite: [
      'Right in the middle of the pack.',
      'A balanced record with room to climb.',
      'Even keel — one hot streak from contention.',
      'Splitting the difference every week.',
      'Steady, with the ceiling still unwritten.',
      'A coin-flip team in the best sense.',
      'Holding serve and waiting for a run.',
      'The playoff picture still includes them.',
      'Every week a fresh 50/50.',
      'Consistent — now chasing that extra gear.',
    ],
  },
  /** High points-for but a losing record. */
  cursed: {
    savage: [
      'Great team. Tragic scheduling. Cursed.',
      'Outscores everyone except their weekly opponent.',
      'The schedule has a personal vendetta.',
      'Elite points, cursed calendar. Someone check the stars.',
      'Losing shootouts like it is a paid gig.',
      'The best team the standings refuse to acknowledge.',
      'Scoring like a contender, losing like a plot twist.',
      'Every loss is a 140-point crime scene.',
      'The fantasy gods demand a sacrifice. It is always them.',
      'Statistically great. Cosmically doomed.',
    ],
    polite: [
      'Better than the record shows.',
      'The points say contender, the schedule disagrees.',
      'Unlucky in the matchups that mattered.',
      'A strong roster hiding in a rough record.',
      'The numbers insist this team is good.',
      'Losing close, high-scoring games — the tide turns.',
      'One schedule quirk away from the top tier.',
      'The record undersells the roster.',
      'Due for the luck to even out.',
      'A dangerous team nobody wants in the playoffs.',
    ],
  },
  /** Everyone else. */
  generic: {
    savage: [
      'One hot week away from being a problem.',
      'The group chat remains unthreatened.',
      'Vibes: fine. Ceiling: debatable.',
      'Lurking in the middle like a speed trap.',
      'Dangerous on paper. The paper is damp.',
      'Quietly plotting, loudly losing waivers.',
      'A dark horse. Emphasis on dark. And horse.',
      'The algorithm shrugged at this one.',
      'Somewhere between a threat and a bye week.',
      'Building something. Possibly a lawsuit against luck.',
      'The rest of the league forgot they exist. Convenient.',
      'Every week a new identity. None of them scary.',
      'Playing chess. The pieces are checkers.',
      'Momentum pending. Check back never.',
      'Their ceiling called. It is a low ceiling.',
    ],
    polite: [
      'Trending in the right direction.',
      'A steady season.',
      'Plenty left to prove.',
      'Quietly putting the pieces together.',
      'A sleeper pick to make some noise.',
      'Finding form at the right time.',
      'The kind of team nobody wants to overlook.',
      'Grinding out a respectable campaign.',
      'One good stretch from the conversation.',
      'Solid foundation, ceiling to be determined.',
      'Writing a better second half.',
      'Keeping every week competitive.',
      'The middle of the pack, moving up.',
      'An honest season with upside left.',
      'Patience now, payoff later.',
    ],
  },
} satisfies Record<string, BanterPool>;

/* ── DRAFT GRADES ───────────────────────────────────────────────────────── */

export type Grade = 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F';

export const GRADE_BANTER: Record<Grade, BanterPool> = {
  'A+': {
    savage: [
      'Robbery in broad daylight.',
      'The rest of the league should press charges.',
      'Cheated. Nobody knows how, but cheated.',
      'A heist. The war room wore ski masks.',
      'This draft should be investigated and framed.',
    ],
    polite: [
      'Exceptional value all draft long.',
      'A masterclass from the war room.',
      'Every pick aged beautifully.',
      'The blueprint everyone will copy next year.',
      'As close to a perfect draft as it gets.',
    ],
  },
  A: {
    savage: [
      'The war room cooked.',
      'Annoyingly competent from pick one.',
      'Drafted like they had next week’s stats.',
      'The homework was done. Show-off.',
      'Left the draft rich and smug about it.',
    ],
    polite: [
      'A very strong board.',
      'Sharp picks from start to finish.',
      'A draft built on real preparation.',
      'Value found in every round.',
      'A war room firing on all cylinders.',
    ],
  },
  'B+': {
    savage: [
      'Solid. Boring, but solid.',
      'No fireworks. No disasters. No fun.',
      'Competent enough to be forgettable.',
      'Drafted responsibly. Yawn.',
      'The sensible sedan of draft classes.',
    ],
    polite: [
      'Above average work.',
      'A dependable, well-built board.',
      'Good value with very few misses.',
      'A draft that quietly gets it done.',
      'Steady hands throughout.',
    ],
  },
  B: {
    savage: [
      'Fine. Perfectly fine. Whatever.',
      'A draft that exists. Congratulations.',
      'Mid. Aggressively, proudly mid.',
      'Nothing to mock, nothing to fear.',
      'The participation trophy of draft boards.',
    ],
    polite: [
      'A steady, sensible draft.',
      'A solid foundation to build on.',
      'Respectable value across the board.',
      'No major misses — that counts.',
      'A workmanlike draft, in a good way.',
    ],
  },
  'C+': {
    savage: [
      'Reached a little. We noticed.',
      'Some picks were… a choice.',
      'The rankings were open. Nobody looked.',
      'Bold reaches. Bolder consequences.',
      'A few picks the group chat is still discussing.',
    ],
    polite: [
      'A few reaches in there.',
      'Some picks were ahead of their market.',
      'Hit and miss, leaning hit.',
      'A couple of gambles that may still pay off.',
      'Room to tighten up next year.',
    ],
  },
  C: {
    savage: [
      'Drafted with vibes, not rankings.',
      'The strategy was “trust me.” It should not have been trusted.',
      'Astrology had more input than ADP.',
      'Picks made on gut feeling. The gut was wrong.',
      'A draft powered entirely by hope.',
    ],
    polite: [
      'Room to improve next year.',
      'A draft that went its own way.',
      'Some unconventional calls in there.',
      'The board did not cooperate this time.',
      'A rebuilding draft with a few bright spots.',
    ],
  },
  D: {
    savage: [
      'The autodraft did some of this.',
      'Was this drafted or randomly generated?',
      'The picks suggest an unattended laptop.',
      'A cry for help, in draft form.',
      'The war room was a nap.',
    ],
    polite: [
      'A tough draft day.',
      'The board broke the wrong way early.',
      'A day to learn from.',
      'The value never quite lined up.',
      'Next year’s draft starts today.',
    ],
  },
  F: {
    savage: [
      'Punishment speedrun, draft edition.',
      'A war crime against roster construction.',
      'The sacko race started at pick one.',
      'This draft class needs witness protection.',
      'Historians will study this. As a warning.',
    ],
    polite: [
      'It gets better from here.',
      'A draft to put behind you quickly.',
      'The waiver wire is the path forward.',
      'Everyone has one of these years.',
      'Onward — the season is long.',
    ],
  },
};

/* ── LOADING QUIPS ──────────────────────────────────────────────────────── */

export const QUIPS = [
  'bribing the refs…',
  'counting rings…',
  'waking up the interns…',
  'auditing the box scores…',
  'consulting the algorithm…',
  'warming up the teletype…',
  'interrogating the waiver wire…',
  'polishing the sacko trophy…',
  'fact-checking the trash talk…',
  'rerunning the simulations…',
  'digging through the archives…',
  'appealing to the commissioner…',
  'sharpening the power rankings…',
  'calibrating the threat radar…',
  'leaking the trade rumors…',
  'notarizing the box scores…',
  'benching the load screen…',
  'reviewing the tape. all of it…',
  'asking sleeper nicely…',
  'counting to fourteen…',
];
