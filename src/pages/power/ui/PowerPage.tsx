import { useVibes } from '@/shared/lib/vibes';
import { POWER_BANTER, pickBanter } from '@/shared/config/banter';
import { useSeason } from '@/entities/league/api/useSeason';
import { useStandings } from '@/entities/team/api/useStandings';
import { useSeasonWeeks } from '@/entities/matchup/api/useSeasonWeeks';
import { useBrackets } from '@/entities/bracket/api/useBrackets';
import { titleGame } from '@/entities/bracket/lib/titleGame';
import { TeamAvatar } from '@/entities/team/ui/TeamAvatar';
import { PageTitle } from '@/shared/ui/PageTitle/PageTitle';
import { LoadingQuip } from '@/shared/ui/LoadingQuip/LoadingQuip';
import { ErrorPanel } from '@/shared/ui/ErrorPanel/ErrorPanel';
import { powerIndex } from '../model/powerIndex';
import styles from './PowerPage.module.css';

export function PowerPage() {
  const { snark } = useVibes();
  const { season, league } = useSeason();
  const { standings, isLoading, error } = useStandings(league);
  const weeks = useSeasonWeeks(league);
  const brackets = useBrackets(league);

  if (error) return <ErrorPanel error={error} />;
  if (isLoading || !standings) return <LoadingQuip />;

  const pws = league?.settings?.playoff_week_start ?? 15;
  const complete = league?.status === 'complete';
  const { champRoster } = titleGame(brackets.data?.winners);
  const maxPf = Math.max(1, ...standings.map((r) => r.pf));
  const pfKing = [...standings].sort((a, b) => b.pf - a.pf)[0];
  const paMax = [...standings].sort((a, b) => b.pa - a.pa)[0];
  const sacko = standings[standings.length - 1];

  const rows = powerIndex(standings, weeks.data, pws);
  const maxIdx = Math.max(1, ...rows.map((e) => e.idx));

  // Pool picked by condition, line picked deterministically per team+season —
  // stable across renders, fresh every year. Pools live in shared/config/banter.ts.
  const usedLines = new Set<string>();
  const blurbFor = (r: (typeof standings)[number]): string => {
    const seed = `${season}-${r.rosterId}`;
    const pool =
      champRoster != null && r.rosterId === champRoster
        ? POWER_BANTER.champ
        : pfKing && r.rosterId === pfKing.rosterId
          ? POWER_BANTER.pfKing
          : paMax && r.rosterId === paMax.rosterId
            ? POWER_BANTER.paMax
            : sacko && r.rosterId === sacko.rosterId && complete
              ? POWER_BANTER.sacko
              : r.w === r.l
                ? POWER_BANTER.fiveHundred
                : r.pf > maxPf * 0.9 && r.w < r.l
                  ? POWER_BANTER.cursed
                  : POWER_BANTER.generic;
    return pickBanter(pool, snark, seed, usedLines);
  };

  return (
    <div className="pageEnter">
      <div className={styles.titleRow}>
        <PageTitle suffix={season}>Power Index</PageTitle>
        <span className={styles.note}>THE ALGORITHM HAS SPOKEN. COMPLAINTS → SUGGESTION BOX.</span>
      </div>
      <div className={styles.list}>
        {rows.map((e, i) => (
          <div key={e.r.rosterId} className={styles.row}>
            <span className={`${styles.rank} ${i < 3 ? styles.rankHot : styles.rankCold}`}>
              {String(i + 1).padStart(2, '0')}
            </span>
            <TeamAvatar src={e.r.avatar} size={40} className={styles.av} />
            <div className={styles.stack}>
              <div className={styles.nameRow}>
                <span className={styles.team}>{e.r.team}</span>
                <span className={styles.recTrend}>
                  {e.r.w}–{e.r.l} · {e.l5.length ? `L5: ${e.l5w}–${e.l5.length - e.l5w}` : 'L5: …'}
                </span>
              </div>
              <span className={styles.blurb}>{blurbFor(e.r)}</span>
            </div>
            <div className={styles.meter}>
              <span className={styles.idx}>IDX {e.idx.toFixed(1)}</span>
              <div className={styles.track}>
                <div
                  className={`${styles.fill} ${i < 3 ? styles.fillHot : styles.fillCold}`}
                  style={{ width: `${Math.round((e.idx / maxIdx) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
