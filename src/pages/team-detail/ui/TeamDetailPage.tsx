import { Link, getRouteApi } from '@tanstack/react-router';
import { useSavage } from '@/shared/lib/vibes';
import { useSeasonBundles } from '@/features/league-history/api/useSeasonBundles';
import { useSeason } from '@/entities/league/api/useSeason';
import { ptsKey } from '@/entities/league/lib/ptsKey';
import { useLeagueUsers, useRosters, useStandings } from '@/entities/team/api/useStandings';
import { useBrackets } from '@/entities/bracket/api/useBrackets';
import { titleGame } from '@/entities/bracket/lib/titleGame';
import { usePlayersDb } from '@/entities/player/api/usePlayersDb';
import { useSeasonStats } from '@/entities/player/api/useSeasonStats';
import { TeamAvatar } from '@/entities/team/ui/TeamAvatar';
import { EmptyState } from '@/shared/ui/EmptyState/EmptyState';
import { LoadingQuip } from '@/shared/ui/LoadingQuip/LoadingQuip';
import { ErrorPanel } from '@/shared/ui/ErrorPanel/ErrorPanel';
import { POS_COLORS, type Position } from '@/shared/config/constants';
import { fmt, ord } from '@/shared/lib/format';
import styles from './TeamDetailPage.module.css';

const route = getRouteApi('/teams/$ownerId');

export function TeamDetailPage() {
  const { ownerId } = route.useParams();
  const savage = useSavage();
  const history = useSeasonBundles();
  const { season, league } = useSeason();
  const { standings, isLoading, error } = useStandings(league);
  const rosters = useRosters(league);
  useLeagueUsers(league);
  const brackets = useBrackets(league);
  const playersDb = usePlayersDb();
  const stats = useSeasonStats(season, league);

  if (error) return <ErrorPanel error={error} />;
  if (isLoading || !standings) return <LoadingQuip />;

  const row = standings.find((r) => r.ownerId === ownerId);
  if (!row) {
    return (
      <EmptyState title="No such franchise">
        This owner isn't in the {season} league. Retired, relegated, or imaginary.
      </EmptyState>
    );
  }

  const { champRoster } = titleGame(brackets.data?.winners);
  const isChamp = champRoster != null && row.rosterId === champRoster;
  const rank = standings.indexOf(row) + 1;

  const roster = rosters.data?.find((r) => r.owner_id === ownerId);
  const db = playersDb.data;
  const statMap = stats.data;
  const pk = ptsKey(league);
  const rosterRows =
    roster && db
      ? (roster.players ?? [])
          .map((pid) => {
            const p = db[pid] ?? { n: `Player #${pid}`, p: '?' as Position, t: '?', a: 0, x: -1 };
            const pts = statMap?.[pid] ? (statMap[pid]?.[pk] ?? 0) : null;
            return {
              pid,
              name: p.n,
              pos: p.p,
              posCol: POS_COLORS[p.p as Position] ?? 'var(--pos-def)',
              team: p.t,
              pts: pts == null ? '…' : fmt(pts),
              _s: (roster.starters ?? []).includes(pid) ? 0 : 1,
              _pts: pts ?? 0,
            };
          })
          .sort((a, b) => a._s - b._s || b._pts - a._pts)
      : [];

  return (
    <div className="pageEnter">
      <Link to="/teams" className={styles.back}>
        ← ALL TEAMS
      </Link>
      <div className={styles.head}>
        <TeamAvatar src={row.avatar} size={76} className={styles.av} />
        <div className={styles.headStack}>
          <h1 className={styles.teamName}>{row.team}</h1>
          <span className={styles.recLine}>
            {season}: {row.w}–{row.l} · PF {fmt(row.pf)} · PA {fmt(row.pa)} · MGR {row.owner}
          </span>
        </div>
        <span className={styles.rkChip}>
          {isChamp ? `★ ${season} CHAMPION` : `${ord(rank)} OF ${standings.length}`}
        </span>
      </div>

      <div className={styles.grid}>
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardTitle}>CAREER LEDGER</span>
          </div>
          {history.bundles ? (
            history.bundles.map((b) => {
              const idx = b.standings.findIndex((r) => r.ownerId === ownerId);
              if (idx === -1) return null;
              const s = b.standings[idx]!;
              const isCh = b.champ?.ownerId === ownerId;
              const isSk = b.sacko?.ownerId === ownerId;
              return (
                <div key={b.season} className={styles.seasonRow}>
                  <span className={styles.seasonYear}>{b.season}</span>
                  <span className={styles.seasonTeam}>{s.team}</span>
                  <span className={styles.seasonRec}>
                    {s.w}–{s.l}
                  </span>
                  <span
                    className={styles.seasonFinish}
                    style={{
                      color: isCh ? 'var(--red)' : isSk ? 'var(--loss)' : 'var(--text-muted)',
                    }}
                  >
                    {isCh ? '★ CHAMPION' : isSk ? 'SACKO' : `${ord(idx + 1)} PLACE`}
                  </span>
                </div>
              );
            })
          ) : (
            <div className={styles.loadingLine}>digging through the archives…</div>
          )}
        </div>

        <div className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardTitle}>RIVALRY LEDGER — ALL TIME</span>
          </div>
          {history.derived ? (
            <div className={styles.scroll}>
              {Object.entries(history.derived.h2h[ownerId] ?? {})
                .map(([k, rec]) => ({ k, rec, meta: history.derived!.ownerMeta[k], games: rec.w + rec.l }))
                .sort((a, b) => b.games - a.games)
                .map(({ k, rec, meta }) => {
                  const edge =
                    rec.w > rec.l
                      ? savage
                        ? 'OWNS THEM'
                        : 'EDGE'
                      : rec.w < rec.l
                        ? savage
                          ? 'OWNED'
                          : 'TRAILS'
                        : 'DEAD EVEN';
                  return (
                    <div key={k} className={styles.h2hRow}>
                      <TeamAvatar src={meta?.av ?? ''} size={24} />
                      <span className={styles.h2hOpp}>{meta?.team ?? meta?.owner ?? '?'}</span>
                      <span className={styles.h2hRec}>
                        {rec.w}–{rec.l}
                      </span>
                      <span
                        className={styles.h2hEdge}
                        style={{
                          color:
                            rec.w > rec.l ? 'var(--win)' : rec.w < rec.l ? 'var(--loss)' : 'var(--text-muted)',
                        }}
                      >
                        {edge}
                      </span>
                    </div>
                  );
                })}
            </div>
          ) : (
            <div className={styles.loadingLine}>digging through the archives…</div>
          )}
        </div>

        <div className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardTitle}>ROSTER · {season}</span>
            <span className={styles.cardNote}>
              {league?.status === 'pre_draft' ? 'PRE-DRAFT — EMPTY' : 'SEASON PTS'}
            </span>
          </div>
          {roster && db ? (
            rosterRows.length ? (
              <div className={styles.scroll}>
                {rosterRows.map((p) => (
                  <div key={p.pid} className={styles.rosterRow}>
                    <span className={styles.pos} style={{ color: p.posCol }}>
                      {p.pos}
                    </span>
                    <span className={styles.playerName}>{p.name}</span>
                    <span className={styles.nflTeam}>{p.team}</span>
                    <span className={styles.pts}>{p.pts}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.loadingLine}>no players. the draft will fix this. probably.</div>
            )
          ) : (
            <div className={styles.loadingLine}>summoning the roster…</div>
          )}
        </div>
      </div>
    </div>
  );
}
