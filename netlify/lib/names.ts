/**
 * Fuzzy team/owner resolution.
 *
 * People type "keenen", a nickname, or half a team name — never the owner_id
 * the API wants. Every tool that takes a team runs its argument through here
 * and, when it can't decide, hands the model a candidate list so it can ask
 * instead of guessing. Guessing is the failure mode that makes a league bot
 * useless: a confidently wrong owner poisons every number after it.
 */
import type { Snapshot } from './league';

export interface Person {
  ownerId: string;
  owner: string;
  team: string;
}

/** Lowercase, strip everything that isn't a letter or digit. "The Won's" and
    "thewons" collapse to the same key. */
function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Every manager who has ever appeared in the league, with their newest
    team name (all-time meta keeps the first one it saw per owner). */
export function people(snap: Snapshot): Person[] {
  const out = new Map<string, Person>();
  // Oldest season first so newer team names overwrite older ones.
  [...snap.bundles]
    .sort((a, b) => Number(a.season) - Number(b.season))
    .forEach((b) =>
      b.standings.forEach((r) => out.set(r.ownerId, { ownerId: r.ownerId, owner: r.owner, team: r.team })),
    );
  return [...out.values()];
}

export interface Resolution {
  hit?: Person;
  /** Populated when the query was ambiguous or matched nothing. */
  candidates: Person[];
}

/** Match a free-text team/owner against the league, most-specific first:
    exact, then prefix, then substring. A tier that yields exactly one person
    wins; a tier with several returns them all for the model to disambiguate. */
export function resolvePerson(query: string, roster: Person[]): Resolution {
  const q = norm(query);
  if (!q) return { candidates: roster };

  const tiers: ((p: Person) => boolean)[] = [
    (p) => norm(p.owner) === q || norm(p.team) === q,
    (p) => norm(p.owner).startsWith(q) || norm(p.team).startsWith(q),
    (p) => norm(p.owner).includes(q) || norm(p.team).includes(q),
  ];

  for (const test of tiers) {
    const found = roster.filter(test);
    if (found.length === 1) return { hit: found[0], candidates: [] };
    if (found.length > 1) return { candidates: found };
  }
  return { candidates: roster };
}
