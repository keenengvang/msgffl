import { useState } from 'react';
import { useSavage } from '@/shared/lib/vibes';
import { useWeeklySummaryIndex } from '@/entities/weekly-summary/api/useWeeklySummaryIndex';
import { useWeeklySummary } from '@/entities/weekly-summary/api/useWeeklySummary';
import { PageTitle } from '@/shared/ui/PageTitle/PageTitle';
import { LoadingQuip } from '@/shared/ui/LoadingQuip/LoadingQuip';
import { ErrorPanel } from '@/shared/ui/ErrorPanel/ErrorPanel';
import { EmptyState } from '@/shared/ui/EmptyState/EmptyState';
import { splitParagraphs } from '@/entities/weekly-summary/lib/splitParagraphs';
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
          {/* Vertical nav, oldest week at the bottom rising to the newest at the
              top — groups are already newest-first, so plain column order does
              this for free. Top-aligned so it never stretches to match the
              article's height. */}
          <nav className={styles.archive} aria-label="Recap archive">
            {groups.map((g) => (
              <div key={g.season} className={styles.seasonGroup}>
                <span className={`uMono ${styles.seasonLabel}`}>{g.season}</span>
                <div className={styles.weekPills}>
                  {g.weeks.map((w) => (
                    <button
                      key={w.file}
                      type="button"
                      aria-current={w.file === activeFile ? 'true' : undefined}
                      className={w.file === activeFile ? `${styles.weekPill} ${styles.weekPillActive}` : styles.weekPill}
                      onClick={() => setSelectedFile(w.file)}
                    >
                      WK {w.week}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </nav>

          <div className={styles.mainCol}>
            {summary.error && <ErrorPanel error={summary.error} onRetry={() => summary.refetch()} />}
            {!summary.error && (summary.isLoading || !summary.data) && <LoadingQuip />}
            {!summary.error && summary.data && (
              <article className={styles.article}>
                <header className={styles.articleHead}>
                  <div className={styles.dateline}>
                    <span className={`uLabel ${styles.badge}`}>WEEK {summary.data.week || '—'}</span>
                    <span className={styles.sep}>·</span>
                    <span className={`uMono ${styles.dim}`}>{summary.data.season}</span>
                    <span className={styles.sep}>·</span>
                    <span className={`uMono ${styles.dim}`}>
                      {new Date(summary.data.generatedAt).toLocaleString()}
                    </span>
                  </div>
                  <h2 className={styles.headline}>{summary.data.headline}</h2>
                </header>

                {summary.data.sections.length === 0 ? (
                  <EmptyState title={savage ? 'THE BOT FILED NOTHING' : 'Nothing here yet'} />
                ) : (
                  summary.data.sections.map((s) => (
                    <section key={s.heading} className={styles.section}>
                      <h3 className={styles.subhead}>{s.heading}</h3>
                      {splitParagraphs(s.body).map((p, i) => (
                        <p key={i} className={styles.body}>
                          {p}
                        </p>
                      ))}
                    </section>
                  ))
                )}
              </article>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
