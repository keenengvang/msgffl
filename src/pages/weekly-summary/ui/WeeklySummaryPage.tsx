import { useState } from 'react';
import { useSavage } from '@/shared/lib/vibes';
import { useWeeklySummaryIndex } from '@/entities/weekly-summary/api/useWeeklySummaryIndex';
import { useWeeklySummary } from '@/entities/weekly-summary/api/useWeeklySummary';
import { PageTitle } from '@/shared/ui/PageTitle/PageTitle';
import { LoadingQuip } from '@/shared/ui/LoadingQuip/LoadingQuip';
import { ErrorPanel } from '@/shared/ui/ErrorPanel/ErrorPanel';
import { EmptyState } from '@/shared/ui/EmptyState/EmptyState';
import { groupBySeason } from '../model/groupBySeason';
import styles from './WeeklySummaryPage.module.css';

export function WeeklySummaryPage() {
  const savage = useSavage();
  const index = useWeeklySummaryIndex();
  const [selectedFile, setSelectedFile] = useState<string | undefined>(undefined);

  const entries = index.data ?? [];
  const activeFile = selectedFile ?? entries[0]?.file;
  const summary = useWeeklySummary(activeFile);
  const groups = groupBySeason(entries);

  return (
    <div className="pageEnter">
      <div className={styles.titleRow}>
        <PageTitle>The Weekly Wrap</PageTitle>
        <span className={styles.note}>
          {savage ? 'FILED BY A ROBOT WHO NEVER PLAYS' : 'AUTO-GENERATED EACH WEEK'}
        </span>
      </div>

      {index.error && <ErrorPanel error={index.error} onRetry={() => index.refetch()} />}

      {!index.error && index.isLoading && <LoadingQuip text={savage ? 'BRIBING THE BOT FOR ITS NOTES…' : 'fetching the archive…'} />}

      {!index.error && !index.isLoading && entries.length === 0 && (
        <EmptyState title={savage ? 'THE BOT FILED NOTHING' : 'Nothing here yet'}>
          {savage ? 'Presumably speechless. Check back after the next run.' : 'Check back after the next scheduled run.'}
        </EmptyState>
      )}

      {!index.error && entries.length > 0 && (
        <div className={styles.layout}>
          <div className={styles.main}>
            {summary.error && <ErrorPanel error={summary.error} onRetry={() => summary.refetch()} />}
            {!summary.error && (summary.isLoading || !summary.data) && <LoadingQuip />}
            {!summary.error && summary.data && (
              <div className={styles.wrap}>
                <div className={styles.meta}>
                  <span className={`uLabel ${styles.badge}`}>WEEK {summary.data.week || '—'}</span>
                  <span className={styles.dim}>·</span>
                  <span className={styles.dim}>{summary.data.season}</span>
                  <span className={styles.dim}>·</span>
                  <span className={`uMono ${styles.dim}`}>{new Date(summary.data.generatedAt).toLocaleString()}</span>
                </div>
                <h2 className={styles.headline}>{summary.data.headline}</h2>
                {summary.data.sections.length === 0 ? (
                  <EmptyState title={savage ? 'THE BOT FILED NOTHING' : 'Nothing here yet'} />
                ) : (
                  <div className={styles.sections}>
                    {summary.data.sections.map((s) => (
                      <div key={s.heading} className={styles.card}>
                        <div className={styles.cardHead}>{s.heading}</div>
                        <p className={styles.body}>{s.body}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className={styles.archive}>
            <span className="uLabel">ARCHIVE</span>
            {groups.map((g) => (
              <div key={g.season} className={styles.seasonGroup}>
                <span className={styles.seasonLabel}>{g.season}</span>
                <div className={styles.weekPills}>
                  {g.weeks.map((w) => (
                    <button
                      key={w.file}
                      type="button"
                      className={w.file === activeFile ? `${styles.weekPill} ${styles.weekPillActive}` : styles.weekPill}
                      onClick={() => setSelectedFile(w.file)}
                    >
                      WK {w.week}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
