import { useState } from 'react';
import { useSavage } from '@/shared/lib/vibes';
import { useSeason } from '@/entities/league/api/useSeason';
import { useStandings } from '@/entities/team/api/useStandings';
import { useSubmitSuggestion } from '@/entities/suggestion/api/submitSuggestion';
import { PageTitle } from '@/shared/ui/PageTitle/PageTitle';
import { SUGGESTIONS_URL } from '@/shared/config/constants';
import styles from './SuggestPage.module.css';

export function SuggestPage() {
  const savage = useSavage();
  const { league } = useSeason();
  const { standings } = useStandings(league);
  const remote = useSubmitSuggestion();
  const [who, setWho] = useState('');
  const [text, setText] = useState('');

  const names = (standings ?? []).map((r) => r.owner).sort();

  const submit = () => {
    const t = text.trim();
    if (!t || remote.isPending) return;
    remote.mutate(
      { who: who || 'ANONYMOUS COWARD', text: t },
      { onSuccess: () => setText('') }, // keep the text on failure so nothing is lost
    );
  };

  const intel = savage
    ? [
        'proposal transmitted straight to league HQ',
        'filed as a public ticket — the league can pile on',
        'the commish triages. the veto looms.',
        'anonymity honored. cowardice noted.',
      ]
    : [
        'your proposal is sent to league HQ',
        'it becomes a public ticket the league can discuss',
        'the commissioner reviews every submission',
        'submitting anonymously is perfectly fine',
      ];

  return (
    <div className="pageEnter">
      <div className={styles.titleRow}>
        <PageTitle>The Suggestion Box</PageTitle>
        <span className={styles.note}>DEMOCRACY, SORT OF.</span>
      </div>
      <div className={styles.grid}>
        <div className={styles.form}>
          <span className={styles.formLabel}>TRANSMIT PROPOSAL</span>
          <select value={who} onChange={(e) => setWho(e.target.value)} className={styles.select}>
            <option value="">— who's complaining? —</option>
            {names.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder="e.g. 'two flex spots', 'punishment should be public', 'ban whoever keeps vetoing trades'…"
            className={styles.textarea}
          />
          <div className={styles.actions}>
            <button type="button" className={styles.submit} onClick={submit} disabled={remote.isPending || !text.trim()}>
              {remote.isPending ? 'TRANSMITTING…' : 'SUBMIT TO LEAGUE ⏎'}
            </button>
            <span className={styles.hint}>FILES STRAIGHT INTO LEAGUE HQ. THE COMMISH SEES EVERYTHING.</span>
          </div>
          {remote.isSuccess && (
            <span className={styles.status}>
              {savage ? `FILED AS TICKET #${remote.data.number}. NO TAKEBACKS. ` : `Submitted — ticket #${remote.data.number}. `}
              <a href={remote.data.url} target="_blank" rel="noopener noreferrer" className={styles.issueLink}>
                {savage ? 'FOLLOW THE BEEF ↗' : 'view it ↗'}
              </a>
            </span>
          )}
          {remote.isError && (
            <span className={`${styles.status} ${styles.statusError}`}>
              {savage
                ? 'HQ UNREACHABLE. YOUR GRIEVANCE SURVIVES IN THE BOX ABOVE — TRY AGAIN IN A MINUTE.'
                : "Couldn't reach HQ — your text is safe above. Try again shortly."}
            </span>
          )}
        </div>

        <div className={styles.sideCol}>
          <div className={styles.intelCard}>
            <span className={styles.intelTitle}>HOW THIS WORKS</span>
            <div className={styles.intelLines}>
              {intel.map((line) => (
                <div key={line} className={styles.intelLine}>
                  <span className={styles.prompt}>&gt;</span> {line}
                </div>
              ))}
            </div>
          </div>

          <a href={SUGGESTIONS_URL} target="_blank" rel="noopener noreferrer" className={styles.docketCta}>
            <span className={styles.docketLabel}>THE PUBLIC DOCKET</span>
            <span className={styles.docketTitle}>
              {savage ? (
                <>
                  READ EVERY GRIEVANCE
                  <br />
                  EVER FILED ↗
                </>
              ) : (
                <>
                  BROWSE ALL
                  <br />
                  SUBMISSIONS ↗
                </>
              )}
            </span>
          </a>
        </div>
      </div>
    </div>
  );
}
