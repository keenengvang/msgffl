import type { Draft, League } from '@/shared/api/types';

export interface RuleArticle {
  n: string;
  title: string;
  body: string;
}

export interface ScoringRow {
  k: string;
  v: string;
}

/** Scoring fine print, pulled live from league.scoring_settings. */
export function scoringRows(lg: League | undefined): ScoringRow[] {
  const sc = lg?.scoring_settings ?? {};
  const perYd = (v: number | undefined) => (v ? `1 PT / ${Math.round(1 / v)} YDS` : '—');
  return [
    { k: 'Passing TD', v: `${sc.pass_td ?? 4} PTS` },
    { k: 'Passing yards', v: perYd(sc.pass_yd ?? 0.04) },
    { k: 'Rushing / receiving TD', v: `${sc.rush_td ?? 6} PTS` },
    { k: 'Rushing yards', v: perYd(sc.rush_yd ?? 0.1) },
    { k: 'Receiving yards', v: perYd(sc.rec_yd ?? 0.1) },
    { k: 'Reception', v: `${sc.rec ?? 0} PT${(sc.rec ?? 0) === 1 ? '' : 'S'}` },
    { k: 'Interception thrown', v: `${sc.pass_int ?? -1} PTS` },
    { k: 'Fumble lost', v: `${sc.fum_lost ?? -2} PTS` },
  ];
}

/** Constitution articles. VI and VII are intentional commish placeholders. */
export function ruleArticles(input: {
  league: League | undefined;
  seasons: string[];
  draft: Draft | null | undefined;
}): RuleArticle[] {
  const { league, seasons, draft } = input;
  const pTeams = league?.settings?.playoff_teams ?? 8;
  const pws = league?.settings?.playoff_week_start ?? 15;
  const waiver = league?.settings?.waiver_budget ?? null;
  const deadline = league?.settings?.trade_deadline ?? null;

  const rp = league?.roster_positions ?? [];
  const counts: Record<string, number> = {};
  rp.forEach((p) => (counts[p] = (counts[p] ?? 0) + 1));
  const rosterComp =
    Object.keys(counts)
      .map((k) => `${k.replace('SUPER_FLEX', 'SFLX')} ×${counts[k]}`)
      .join(' · ') || 'loading…';

  return [
    {
      n: 'I',
      title: 'THE LEAGUE',
      body: `M$G Fantasy Football League. Est. 2012, on Sleeper since ${seasons[seasons.length - 1] ?? '2022'}. Fourteen managers enter. One gets a belt, one gets a punishment, twelve get excuses.`,
    },
    {
      n: 'II',
      title: 'ROSTERS',
      body: `Lineups, per the live Sleeper settings: ${rosterComp}. Set them before kickoff. "I forgot" has never once been an accepted defense.`,
    },
    {
      n: 'III',
      title: 'THE PLAYOFFS',
      body: `${pTeams} teams make the dance. Weeks ${pws}–17. Seeding by record, ties broken by points for, arguments settled in the group chat and never resolved.`,
    },
    {
      n: 'IV',
      title: 'THE DRAFT',
      body: `Once a year. Snake. ${draft ? `${draft.settings?.rounds ?? 15} rounds.` : '15 rounds.'} Auto-drafting earns you a nickname you will not like. Draft grades are published and are legally binding.`,
    },
    {
      n: 'V',
      title: 'TRADES & WAIVERS',
      body: `${waiver ? `FAAB budget: $${waiver}. ` : 'Waivers per Sleeper settings. '}${deadline ? `Trade deadline: week ${deadline}. ` : ''}Collusion is prohibited, obviously. Fleecing a friend fair and square is encouraged.`,
    },
    {
      n: 'VI',
      title: 'DUES & PAYOUTS',
      body: '⚠ COMMISH: EDIT ME — buy-in amount, payout split, side pots. This card is a placeholder until someone types the real numbers.',
    },
    {
      n: 'VII',
      title: 'THE PUNISHMENT',
      body: 'Last place owes the league a punishment. The league votes on it. Precedents exist and they are unkind. ⚠ COMMISH: document past punishments here for the historical record.',
    },
    {
      n: 'VIII',
      title: 'CONDUCT & AMENDMENTS',
      body: 'Trash talk is mandatory. Quitting mid-season voids your dignity. Rule changes go through the Suggestion Box; majority carries; the commish holds a veto he will absolutely abuse.',
    },
  ];
}
