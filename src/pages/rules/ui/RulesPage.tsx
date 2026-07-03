import { useSeason } from '@/entities/league/api/useSeason';
import { useDraft } from '@/entities/draft/api/useDraft';
import { PageTitle } from '@/shared/ui/PageTitle/PageTitle';
import { ruleArticles, scoringRows } from '../model/ruleArticles';
import styles from './RulesPage.module.css';

export function RulesPage() {
  const { league, chain } = useSeason();
  const draft = useDraft(league);
  const seasons = (chain ?? []).map((l) => l.season);

  const articles = ruleArticles({ league, seasons, draft: draft.data?.draft });

  return (
    <div className="pageEnter">
      <div className={styles.titleRow}>
        <PageTitle>The Constitution</PageTitle>
        <span className={styles.note}>
          RATIFIED 2012 · SETTINGS PULLED LIVE FROM SLEEPER · ARGUE WITH THE API
        </span>
      </div>
      <div className={styles.grid}>
        {articles.map((a) => (
          <div key={a.n} className={styles.card}>
            <div className={styles.cardHead}>
              <span className={styles.numeral}>{a.n}</span>
              <span className={styles.cardTitle}>{a.title}</span>
            </div>
            <p className={styles.body}>{a.body}</p>
          </div>
        ))}
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.numeral}>§</span>
            <span className={styles.cardTitle}>SCORING — THE FINE PRINT</span>
          </div>
          <div className={styles.scoreList}>
            {scoringRows(league).map((sr) => (
              <div key={sr.k} className={styles.scoreRow}>
                <span className={styles.scoreKey}>{sr.k}</span>
                <span className={styles.scoreVal}>{sr.v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
