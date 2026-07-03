import { useSavage } from '@/shared/lib/vibes';
import { useSeason } from '@/entities/league/api/useSeason';
import { useStandings } from '@/entities/team/api/useStandings';
import { useSeasonWeeks } from '@/entities/matchup/api/useSeasonWeeks';
import { useBrackets } from '@/entities/bracket/api/useBrackets';
import { titleGame } from '@/entities/bracket/lib/titleGame';
import { PageTitle } from '@/shared/ui/PageTitle/PageTitle';
import { ErrorPanel } from '@/shared/ui/ErrorPanel/ErrorPanel';
import { bracketRounds } from '../model/bracketRounds';
import styles from './BracketPage.module.css';

export function BracketPage() {
  const savage = useSavage();
  const { season, league } = useSeason();
  const { standings, error } = useStandings(league);
  const brackets = useBrackets(league);
  const weeks = useSeasonWeeks(league);

  if (error) return <ErrorPanel error={error} />;

  const winners = brackets.data?.winners ?? [];
  const ready = winners.length > 0 && !!standings?.length;

  const names: Record<number, NonNullable<typeof standings>[number]> = {};
  standings?.forEach((r) => (names[r.rosterId] = r));

  const { champRoster } = titleGame(winners);
  const champ = champRoster != null ? names[champRoster] : undefined;
  const sacko = standings?.[standings.length - 1];

  const rounds = ready
    ? bracketRounds(winners, names, weeks.data, league?.settings?.playoff_week_start ?? 15)
    : [];

  return (
    <div className="pageEnter">
      <div className={styles.titleRow}>
        <PageTitle suffix={season}>The Gauntlet</PageTitle>
        <span className={styles.note}>
          {champ ? `★ ${champ.team.toUpperCase()} — ${season} CHAMPION` : 'TITLE UNDECIDED'}
        </span>
      </div>

      {!ready && <div className={styles.loading}>assembling the gauntlet…</div>}

      {ready && (
        <>
          <div className={styles.rounds}>
            {rounds.map((rd) => (
              <div key={rd.title} className={styles.round}>
                <span className={styles.roundTitle}>{rd.title}</span>
                <div className={styles.games}>
                  {rd.games.map((g) => (
                    <div key={g.key} className={`${styles.game} ${g.isTitle ? styles.gameTitle : ''}`}>
                      {([g.a, g.b] as const).map((side, si) => (
                        <div key={si} className={si === 0 ? `${styles.side} ${styles.sideTop}` : styles.side}>
                          <span
                            className={styles.sideName}
                            style={{
                              color: side.win ? 'var(--text-primary)' : 'var(--text-muted)',
                              fontWeight: side.win ? 800 : 600,
                            }}
                          >
                            {side.name}
                          </span>
                          <span
                            className={styles.sideTag}
                            style={{ color: side.win ? 'var(--text-primary)' : 'var(--text-muted)' }}
                          >
                            {side.tag}
                          </span>
                        </div>
                      ))}
                      {g.label && <div className={styles.label}>{g.label}</div>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className={styles.cellar}>
            <span className={styles.cellarLabel}>THE CELLAR</span>
            <span className={styles.cellarLine}>
              {sacko
                ? `${sacko.team} finished ${sacko.w}–${sacko.l}. ${
                    savage
                      ? 'The punishment clause has been activated. The league is accepting ceremony proposals via the Suggestion Box.'
                      : 'Last place — better luck next season.'
                  }`
                : 'loading the shame files…'}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
