import { SLEEPER_API } from '@/shared/config/constants';

/** Fetch a Sleeper API path (e.g. `/league/123/rosters`) and parse JSON. */
export async function api<T>(path: string): Promise<T> {
  const r = await fetch(SLEEPER_API + path);
  if (!r.ok) throw new Error(`Sleeper said no (${r.status}) on ${path}`);
  return r.json() as Promise<T>;
}

export function avatarUrl(avatar: string | null | undefined): string {
  return avatar ? `https://sleepercdn.com/avatars/thumbs/${avatar}` : '';
}

export function headshotUrl(playerId: string, pos: string): string {
  if (pos === 'DEF') return `https://sleepercdn.com/images/team_logos/nfl/${playerId.toLowerCase()}.png`;
  return `https://sleepercdn.com/content/nfl/players/thumb/${playerId}.jpg`;
}
