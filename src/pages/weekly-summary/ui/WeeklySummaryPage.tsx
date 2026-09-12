import { useSavage } from '@/shared/lib/vibes';
import { useWeeklySummary } from '@/entities/weekly-summary/api/useWeeklySummary';
import { PageTitle } from '@/shared/ui/PageTitle/PageTitle';
import { LoadingQuip } from '@/shared/ui/LoadingQuip/LoadingQuip';
import { ErrorPanel } from '@/shared/ui/ErrorPanel/ErrorPanel';
import { EmptyState } from '@/shared/ui/EmptyState/EmptyState';
import styles from './WeeklySummaryPage.module.css';

export function WeeklySummaryPage() {
  const savage = useSavage();
  const { data, isLoading, error, refetch } = useWeeklySummary();

  return (
    <div className="pageEnter">
      <div className={styles.titleRow}>
        <PageTitle>The Weekly Wrap</PageTitle>
        <span className={styles.note}>
          {savage ? 'FILED BY A ROBOT WHO NEVER PLAYS' : 'AUTO-GENERATED EACH WEEK'}
        </span>
      </div>

      {error && <ErrorPanel error={error} onRetry={() => refetch()} />}
      {!error && (isLoading || !data) && <LoadingQuip text={savage ? 'BRIBING THE BOT FOR ITS NOTES…' : 'fetching this week’s recap…'} />}

      {!error && data && data.sections.length === 0 && (
        <EmptyState title={savage ? 'THE BOT FILED NOTHING' : 'Nothing here yet'}>
          {savage ? 'Presumably speechless. Check back after the next run.' : 'Check back after the next scheduled run.'}
        </EmptyState>
      )}

      {!error && data && data.sections.length > 0 && (
        <div className={styles.wrap}>
          <div className={styles.meta}>
            <span className={`uLabel ${styles.badge}`}>WEEK {data.week || '—'}</span>
            <span className={styles.dim}>·</span>
            <span className={styles.dim}>{data.season}</span>
            <span className={styles.dim}>·</span>
            <span className={`uMono ${styles.dim}`}>{new Date(data.generatedAt).toLocaleString()}</span>
          </div>
          <h2 className={styles.headline}>{data.headline}</h2>
          <div className={styles.sections}>
            {data.sections.map((s) => (
              <div key={s.heading} className={styles.card}>
                <div className={styles.cardHead}>{s.heading}</div>
                <p className={styles.body}>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
