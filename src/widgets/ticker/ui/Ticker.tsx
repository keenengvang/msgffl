import { useSavage, useVibes } from '@/shared/lib/vibes';
import { useSeason } from '@/entities/league/api/useSeason';
import { useNflState } from '@/entities/league/api/useNflState';
import { newestLeague } from '@/entities/league/lib/activeLeague';
import { useStandings } from '@/entities/team/api/useStandings';
import { useBrackets } from '@/entities/bracket/api/useBrackets';
import { useDraft } from '@/entities/draft/api/useDraft';
import { nextDraftInfo } from '@/entities/draft/lib/nextDraft';
import { useSeasonWeeks } from '@/entities/matchup/api/useSeasonWeeks';
import { liveWeekFor, weekPulse } from '@/entities/matchup/lib/liveWeek';
import { tickerText } from '../model/tickerBits';
import styles from './Ticker.module.css';

export function Ticker() {
  const savage = useSavage();
  const { motion } = useVibes();
  const { season, league, chain } = useSeason();
  const nflState = useNflState();
  const { standings } = useStandings(league);
  const brackets = useBrackets(league);
  const weeks = useSeasonWeeks(league);
  // The upcoming draft lives on the chain's newest league, not the viewed season.
  const newest = newestLeague(chain);
  const newestDraft = useDraft(newest);

  const week = liveWeekFor({
    status: league?.status,
    playoffWeekStart: league?.settings?.playoff_week_start ?? 15,
    nflSeason: nflState.data?.season,
    nflWeek: nflState.data?.week,
    season,
  });

  const text = tickerText({
    season,
    status: league?.status,
    standings,
    winners: brackets.data?.winners,
    savage,
    nextDraft: newestDraft.data ? nextDraftInfo(newest?.season, newestDraft.data.draft) : undefined,
    week,
    pulse: weeks.data ? weekPulse(weeks.data[week]) : undefined,
  });

  return (
    <div className={styles.bar}>
      <span className={styles.tag}>LEAGUE WIRE</span>
      <div className={styles.viewport}>
        {/* content duplicated 2x for a seamless loop */}
        <div className={motion ? `${styles.track} ${styles.animated}` : styles.track}>
          <span className={styles.text}>{text}</span>
          <span className={styles.text}>{text}</span>
        </div>
      </div>
    </div>
  );
}
