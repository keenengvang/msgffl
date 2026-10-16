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
  'sharpening the charts…',
  'calibrating the threat radar…',
  'leaking the trade rumors…',
  'notarizing the box scores…',
  'benching the load screen…',
  'reviewing the tape. all of it…',
  'asking sleeper nicely…',
  'counting to fourteen…',
];
