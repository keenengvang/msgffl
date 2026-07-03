import { createFileRoute } from '@tanstack/react-router';
import { useLeagueChain } from '@/entities/league/api/useLeagueChain';
import { activeLeague, leagueOf } from '@/entities/league/lib/activeLeague';
import { useStandings } from '@/entities/team/api/useStandings';
import { useSeasonWeeks } from '@/entities/matchup/api/useSeasonWeeks';
import { pairMatchups } from '@/entities/matchup/lib/pairMatchups';
import { weekTags } from '@/entities/matchup/lib/weekTags';
import { Panel } from '@/shared/ui/Panel/Panel';
import { PageTitle } from '@/shared/ui/PageTitle/PageTitle';
import { LoadingQuip } from '@/shared/ui/LoadingQuip/LoadingQuip';
import { ErrorPanel } from '@/shared/ui/ErrorPanel/ErrorPanel';
import { fmt } from '@/shared/lib/format';

// Temporary Phase 2 debug page: dumps live standings + week tags for every
// season in the chain. Replaced by the real home page in Phase 4.
function SeasonBlock({ season }: { season: string }) {
  const chain = useLeagueChain();
  const league = leagueOf(chain.data, season);
  const { standings, isLoading, error } = useStandings(league);
  const weeks = useSeasonWeeks(league);
  const wk14 = pairMatchups(weeks.data?.[14] ?? []);
  const tags = weekTags(wk14);

  if (error) return <ErrorPanel error={error} />;
  if (isLoading || !standings) return <LoadingQuip text={`pulling the ${season} tape…`} />;
  return (
    <Panel label={`${season} — ${league?.status}`}>
      <table style={{ borderCollapse: 'collapse' }}>
        <tbody>
          {standings.map((r, i) => (
            <tr key={r.rosterId}>
              <td className="uMono" style={{ paddingRight: 12 }}>{i + 1}</td>
              <td style={{ paddingRight: 16, color: 'var(--text-body)' }}>{r.team}</td>
              <td className="uMono" style={{ paddingRight: 16 }}>{r.w}–{r.l}</td>
              <td className="uMono">{fmt(r.pf)} PF</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="uMono" style={{ color: 'var(--text-dim)' }}>
        wk14 tags — nuke: {String(tags.nuke)} · blow: {String(tags.blow)} · close: {String(tags.close)}
      </p>
    </Panel>
  );
}

function Debug() {
  const chain = useLeagueChain();
  if (chain.error) return <ErrorPanel error={chain.error} />;
  if (!chain.data) return <LoadingQuip />;
  const active = activeLeague(chain.data);
  return (
    <div style={{ maxWidth: 'var(--max-w)', margin: '0 auto', padding: 'var(--gutter)', display: 'grid', gap: 22 }}>
      <PageTitle suffix={active?.season} kicker={`chain: ${chain.data.map((l) => l.season).join(' · ')}`}>
        Query layer debug
      </PageTitle>
      {chain.data.map((l) => (
        <SeasonBlock key={l.league_id} season={l.season} />
      ))}
    </div>
  );
}

export const Route = createFileRoute('/')({ component: Debug });
