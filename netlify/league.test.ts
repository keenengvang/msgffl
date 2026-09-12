import { describe, expect, it, vi } from 'vitest';
import { makeSnapshot } from './fixture';
import { leagueBrief } from './lib/brief';
import { people, resolvePerson } from './lib/names';
import { runTool, TOOLS } from './lib/tools';

// The tools that reach past the bundles (rosters, the 5MB player db) are the
// only place these tests would hit the network — faked here so the suite stays
// offline and fast.
const DB = {
  p1: { n: 'Josh Allen', p: 'QB', t: 'BUF', a: 28, x: 6 },
  p2: { n: 'Joe Burrow', p: 'QB', t: 'CIN', a: 27, x: 4 },
  p3: { n: 'Benched Guy', p: 'WR', t: 'FA', a: 30, x: 9 },
};
// A rostered player the active-only trim drops — rosters keep IR players.
const BENCHED = { p4: { n: 'Hurt Guy', p: 'RB', t: 'DET', status: 'IR' } };

vi.mock('./lib/players', () => ({
  playerIndex: vi.fn(async () => ({ db: DB, benched: BENCHED })),
  playersDb: vi.fn(async () => DB),
  seasonStats: vi.fn(async () => ({ p1: { pts_ppr: 310.4 }, p2: { pts_ppr: 288.1 } })),
  // p3/p4 have no projection — the "not projected to play" case.
  weekProjections: vi.fn(async () => ({ p1: { pts_ppr: 18.3 }, p2: { pts_ppr: 21.34 } })),
}));

vi.mock('./lib/league', async (orig) => ({
  ...(await orig<typeof import('./lib/league')>()),
  rostersFor: vi.fn(async () => ({
    // p3 (no projection) listed first, p1 second — the tool must reorder.
    rosters: [{ roster_id: 1, owner_id: 'a', players: ['p3', 'p1', 'p4'], starters: ['p1'] }],
    users: [{ user_id: 'a', display_name: 'alice', avatar: null, metadata: { team_name: 'Boom Squad' } }],
  })),
}));

const snap = makeSnapshot();
const call = async (name: string, input: unknown) => {
  const out = await runTool(name, input, snap);
  return { isError: out.isError ?? false, data: out.isError ? out.content : JSON.parse(out.content) };
};

describe('name resolution', () => {
  const roster = people(snap);

  it('matches a manager or a team name exactly', () => {
    expect(resolvePerson('alice', roster).hit?.ownerId).toBe('a');
    expect(resolvePerson('Boom Squad', roster).hit?.ownerId).toBe('a');
  });

  it('ignores case and punctuation', () => {
    expect(resolvePerson('  chaos theory!! ', roster).hit?.ownerId).toBe('c');
  });

  it('matches on a partial name', () => {
    expect(resolvePerson('chao', roster).hit?.ownerId).toBe('c');
  });

  it('returns candidates instead of guessing when several match', () => {
    const { hit, candidates } = resolvePerson('squad', roster);
    expect(hit).toBeUndefined();
    expect(candidates.map((p) => p.ownerId).sort()).toEqual(['a', 'b']);
  });

  it('returns the whole league when nothing matches', () => {
    const { hit, candidates } = resolvePerson('nobody at all', roster);
    expect(hit).toBeUndefined();
    expect(candidates).toHaveLength(4);
  });
});

describe('league brief', () => {
  const brief = leagueBrief(snap);

  it('carries the current standings, all-time table, titles and records', () => {
    expect(brief).toContain('2024 STANDINGS');
    expect(brief).toContain('ALL-TIME');
    expect(brief).toContain('2023: CHAMPION Boom Squad (alice)');
    expect(brief).toContain('RECORD BOOK');
    expect(brief).toContain('Most points, one week');
  });

  it('reports the live week with its scores and tags', () => {
    expect(brief).toContain('2024 WEEK 2');
    expect(brief).toContain('Chaos Theory 60.00 — 175.25 Dust Bowl');
    // That game is both the week's top score and its biggest margin;
    // precedence hands it NUKE, not MASSACRE.
    expect(brief).toContain("[WEEK'S NUKE]");
    expect(brief).not.toContain('[MASSACRE]');
    expect(brief).toContain('[PHOTO FINISH]');
  });

  it('counts streaks and wins as whole numbers, not scores', () => {
    expect(brief).toContain('Longest win streak (reg. season): 2 —');
    expect(brief).toContain('Most points, one week: 175.25 —');
  });

  it('names the scoring format and the playoff week', () => {
    expect(brief).toContain('full PPR');
    expect(brief).toContain('Playoffs start week 3');
  });

  it('shows offseason copy rather than a table of zeroes before kickoff', () => {
    const pre = makeSnapshot({ active: { ...snap.active, status: 'pre_draft' } });
    const text = leagueBrief(pre);
    expect(text).toContain('has not started');
    expect(text).toContain('offseason');
  });

  it('explains the 0-0 table in week 1 instead of printing it', () => {
    // Sleeper only totals a week once it closes, so mid-week-1 every roster
    // reads 0-0 / 0.00 even though games are being played.
    const wk1 = makeSnapshot({ liveWeek: 1 });
    wk1.bundles[0]!.standings = wk1.bundles[0]!.standings.map((r) => ({ ...r, w: 0, l: 0, t: 0, pf: 0, pa: 0 }));
    const text = leagueBrief(wk1);
    expect(text).toContain('no games decided yet');
    expect(text).not.toMatch(/^1\. .* 0-0 {2}PF 0\.00/m);
    // The live scores still have to be there — they're the real state of play.
    expect(text).toContain('2024 WEEK 1');
    expect(text).toContain('120.50');
  });
});

describe('tools', () => {
  it('exposes question-shaped tools, not endpoint-shaped ones', () => {
    expect(TOOLS.map((t) => t.name).sort()).toEqual([
      'get_head_to_head',
      'get_matchups',
      'get_season',
      'get_team',
      'search_players',
    ]);
  });

  it('get_team returns history, rivalries and the current roster', async () => {
    const { data } = await call('get_team', { team: 'alice' });
    expect(data.manager).toBe('alice');
    expect(data.allTime).toMatchObject({ record: '4-0', titles: 1 });
    expect(data.seasons.map((s: { season: string }) => s.season)).toEqual(['2024', '2023']);
    expect(data.seasons.find((s: { season: string }) => s.season === '2023').champion).toBe(true);
    expect(data.roster[0]).toEqual({
      name: 'Josh Allen',
      pos: 'QB',
      nflTeam: 'BUF',
      starter: true,
      projectedThisWeek: 18.3,
    });
  });

  it('get_team sorts the roster by projection so start/sit reads off the top', async () => {
    const { data } = await call('get_team', { team: 'alice' });
    const projections = data.roster.map((p: { projectedThisWeek: number | null }) => p.projectedThisWeek);
    // Best first; an unprojected player sinks to the bottom rather than
    // reading as a zero-point recommendation.
    expect(projections).toEqual([18.3, null, null]);
  });

  it('get_team names an IR player instead of leaking a raw Sleeper id', async () => {
    const { data } = await call('get_team', { team: 'alice' });
    const hurt = data.roster.find((p: { name: string }) => p.name === 'Hurt Guy');
    // The active-only trim drops him, but the roster still holds him.
    expect(hurt).toMatchObject({ pos: 'RB', nflTeam: 'DET', status: 'IR' });
    expect(JSON.stringify(data.roster)).not.toContain('unknown player');
  });

  it('search_players reports the week projection alongside season points', async () => {
    const { data } = await call('search_players', { position: 'QB' });
    expect(data.week).toBe(2);
    expect(data.players[0]).toMatchObject({ name: 'Josh Allen', seasonPoints: 310.4, projectedThisWeek: 18.3 });
    expect(data.projectionSource).toContain('Sleeper');
  });

  it('get_team asks for a disambiguation rather than picking one', async () => {
    const { isError, data } = await call('get_team', { team: 'squad' });
    expect(isError).toBe(true);
    expect(data).toContain('Ask the user which they meant');
    expect(data).toContain('Boom Squad');
  });

  it('get_matchups names both sides, the winner and the margin', async () => {
    const { data } = await call('get_matchups', { week: 1, season: '2023' });
    expect(data.games).toHaveLength(2);
    expect(data.games[0]).toMatchObject({ winner: 'Boom Squad', margin: 5 });
    expect(data.games[0].home).toMatchObject({ team: 'Boom Squad', points: 110 });
    expect(data.playoffs).toBe(false);
  });

  it('get_matchups defaults to the current season and rejects a bad week', async () => {
    expect((await call('get_matchups', { week: 2 })).data.season).toBe('2024');
    expect((await call('get_matchups', { week: 44 })).isError).toBe(true);
    expect((await call('get_matchups', { week: 1, season: '1999' })).isError).toBe(true);
  });

  it('get_head_to_head counts the regular season only', async () => {
    const { data } = await call('get_head_to_head', { team_a: 'alice', team_b: 'bob' });
    // Four regular-season meetings across the two seasons, all won by alice.
    expect(data.record).toBe('alice is 4-0 against bob');
    expect(data.meetings).toHaveLength(4);
    expect(data.meetings.every((m: { week: number }) => m.week < 3)).toBe(true);
  });

  it('get_head_to_head refuses a team against itself', async () => {
    expect((await call('get_head_to_head', { team_a: 'alice', team_b: 'Boom' })).isError).toBe(true);
  });

  it('get_season reports the bracket champion, not the standings leader', async () => {
    const { data } = await call('get_season', { season: '2023' });
    expect(data.champion).toBe('Boom Squad (alice)');
    expect(data.runnerUp).toBe('Chaos Theory (cara)');
    expect(data.standings).toHaveLength(4);
  });

  it('get_season withholds the sacko while the season is live', async () => {
    expect((await call('get_season', { season: '2024' })).data.sacko).toBeNull();
    expect((await call('get_season', { season: '2023' })).data.sacko).not.toBeNull();
  });

  it('search_players ranks by this league scoring and says who owns them', async () => {
    const { data } = await call('search_players', { position: 'QB' });
    expect(data.scoring).toBe('pts_ppr');
    expect(data.players[0]).toMatchObject({ name: 'Josh Allen', seasonPoints: 310.4, rosteredBy: 'Boom Squad' });
    expect(data.players[1].rosteredBy).toBeNull();
  });

  it('search_players needs something to search on', async () => {
    expect((await call('search_players', {})).isError).toBe(true);
  });

  it('reports an unknown tool as an error result, not a throw', async () => {
    expect((await call('nonsense', {})).isError).toBe(true);
  });
});
