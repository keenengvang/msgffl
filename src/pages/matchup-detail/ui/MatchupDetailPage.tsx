import { Link, getRouteApi } from '@tanstack/react-router';
import { useSeason } from '@/entities/league/api/useSeason';
import { useStandings } from '@/entities/team/api/useStandings';
import { useMatchupWeekDetail } from '@/entities/matchup/api/useMatchupWeekDetail';
import { usePlayersDb } from '@/entities/player/api/usePlayersDb';
import { TeamAvatar } from '@/entities/team/ui/TeamAvatar';
import { LoadingQuip } from '@/shared/ui/LoadingQuip/LoadingQuip';
import { ErrorPanel } from '@/shared/ui/ErrorPanel/ErrorPanel';
import { EmptyState } from '@/shared/ui/EmptyState/EmptyState';
import { POS_COLORS, type Position } from '@/shared/config/constants';
import { fmt } from '@/shared/lib/format';
import { buildRosterRows, type RosterRow } from '../model/buildRosterRows';
import type { Matchup } from '@/shared/api/types';
import type { StandingRow } from '@/entities/team/model/types';
import styles from './MatchupDetailPage.module.css';

const route = getRouteApi('/matchups/$week/$matchupId');

function RosterList({ rows, done }: { rows: RosterRow[]; done: boolean }) {
  const starters = rows.filter((r) => r.starter);
  const bench = rows.filter((r) => !r.starter);
  return (
    <div className={styles.roster}>
      {starters.length > 0 && (
        <>
          <span className={styles.groupLabel}>STARTERS</span>
          {starters.map((r) => (
            <PlayerRow key={r.pid} row={r} done={done} />
          ))}
        </>
      )}
      {bench.length > 0 && (
        <>
          <span className={styles.groupLabel}>BENCH</span>
          {bench.map((r) => (
            <PlayerRow key={r.pid} row={r} done={done} />
          ))}
        </>
      )}
    </div>
  );
}

function PlayerRow({ row, done }: { row: RosterRow; done: boolean }) {
  return (
    <div className={styles.playerRow}>
      <span className={styles.pos} style={{ color: POS_COLORS[row.pos as Position] ?? 'var(--pos-def)' }}>
        {row.pos}
      </span>
      <span className={styles.playerName}>{row.name}</span>
      <span className={styles.nflTeam}>{row.team}</span>
      <span className={styles.playerPts}>{!done ? '—' : row.pts == null ? '—' : fmt(row.pts)}</span>
    </div>
  );
}

function SidePanel({
  side,
  opp,
  row,
  rows,
  done,
}: {
  side: Matchup;
  opp: Matchup;
  row: StandingRow | undefined;
  rows: RosterRow[];
  done: boolean;
}) {
  const win = done && (side.points ?? 0) > (opp.points ?? 0);
  const lose = done && (side.points ?? 0) < (opp.points ?? 0);
  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <TeamAvatar
          src={row?.avatar ?? ''}
          size={44}
          className={win ? styles.avWin : lose ? styles.avLose : undefined}
        />
        <div className={styles.headStack}>
          <span className={styles.teamName} style={{ color: lose ? 'var(--text-muted)' : 'var(--text-primary)' }}>
            {row?.team ?? `Roster ${side.roster_id}`}
          </span>
          <span className={styles.owner}>{row?.owner ?? ''}</span>
        </div>
        <span className={styles.totalPts} style={{ color: lose ? 'var(--text-muted)' : 'var(--text-primary)' }}>
          {done ? fmt(side.points ?? 0) : '—'}
        </span>
      </div>
      <RosterList rows={rows} done={done} />
    </div>
  );
}

export function MatchupDetailPage() {
  const { week: weekParam, matchupId: matchupIdParam } = route.useParams();
  const week = Number(weekParam);
  const matchupId = Number(matchupIdParam);
  const { league } = useSeason();
  const { standings, isLoading, error } = useStandings(league);
  const detail = useMatchupWeekDetail(league, week);
  const playersDb = usePlayersDb();

  if (error) return <ErrorPanel error={error} />;
  if (isLoading || !standings) return <LoadingQuip />;

  const names: Record<number, StandingRow> = {};
  standings.forEach((r) => (names[r.rosterId] = r));

  const back = (
    <Link to="/matchups" search={{ week }} className={styles.back}>
      ← WEEK {week}
    </Link>
  );

  if (detail.error) {
    return (
      <div className="pageEnter">
        {back}
        <ErrorPanel error={detail.error} onRetry={() => detail.refetch()} />
      </div>
    );
  }
  if (detail.isLoading || !detail.data) {
    return (
      <div className="pageEnter">
        {back}
        <LoadingQuip text="pulling the box score…" />
      </div>
    );
  }

  const entries = detail.data
    .filter((m) => m.matchup_id === matchupId)
    .sort((a, b) => a.roster_id - b.roster_id);

  if (entries.length !== 2) {
    return (
      <div className="pageEnter">
        {back}
        <EmptyState title="No such matchup">This game isn't on the week {week} slate.</EmptyState>
      </div>
    );
  }

  const [a, b] = entries as [Matchup, Matchup];
  const done = (a.points ?? 0) > 0 || (b.points ?? 0) > 0;

  return (
    <div className="pageEnter">
      {back}
      <div className={styles.grid}>
        <SidePanel side={a} opp={b} row={names[a.roster_id]} rows={buildRosterRows(a, playersDb.data)} done={done} />
        <SidePanel side={b} opp={a} row={names[b.roster_id]} rows={buildRosterRows(b, playersDb.data)} done={done} />
      </div>
    </div>
  );
}
