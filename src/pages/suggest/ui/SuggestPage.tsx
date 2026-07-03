import { useState } from 'react';
import { useSavage } from '@/shared/lib/vibes';
import { useSeason } from '@/entities/league/api/useSeason';
import { useStandings } from '@/entities/team/api/useStandings';
import { useSuggestions } from '@/entities/suggestion/model/useSuggestions';
import { useSubmitSuggestion } from '@/entities/suggestion/api/submitSuggestion';
import { PageTitle } from '@/shared/ui/PageTitle/PageTitle';
import { ago } from '@/shared/lib/format';
import styles from './SuggestPage.module.css';

export function SuggestPage() {
  const savage = useSavage();
  const { league } = useSeason();
  const { standings } = useStandings(league);
  const { suggestions, add, remove, copyAll, copied } = useSuggestions();
  const remote = useSubmitSuggestion();
  const [who, setWho] = useState('');
  const [text, setText] = useState('');

  const names = (standings ?? []).map((r) => r.owner).sort();

  const submit = () => {
    const t = text.trim();
    // local docket first (offline fallback), then transmit to league HQ
    if (!add(who, t)) return;
    remote.mutate({ who: who || 'ANONYMOUS COWARD', text: t });
    setText('');
  };

  const status = remote.isPending
    ? 'transmitting…'
    : remote.isSuccess
      ? savage
        ? `FILED AS ISSUE #${remote.data.number}. NO TAKEBACKS.`
        : `Submitted to the league — issue #${remote.data.number}.`
      : remote.isError
        ? savage
          ? 'HQ UNREACHABLE. LOGGED LOCALLY — HIT COPY ALL AND HARASS THE COMMISH DIRECTLY.'
          : "Couldn't reach HQ — saved on this device instead."
        : null;

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
            <button type="button" className={styles.submit} onClick={submit}>
              SUBMIT TO LEAGUE ⏎
            </button>
            <span className={styles.hint}>FILES A LEAGUE HQ TICKET + SAVES ON THIS DEVICE</span>
          </div>
          {status && (
            <span className={styles.status} style={remote.isError ? { color: 'var(--loss)' } : undefined}>
              {status}
            </span>
          )}
        </div>

        <div className={styles.docket}>
          <div className={styles.docketHead}>
            <span className="uLabel">THE DOCKET</span>
            <button type="button" className={styles.copyBtn} onClick={copyAll}>
              {copied ? 'COPIED ✓' : 'COPY ALL'}
            </button>
          </div>
          {suggestions.length === 0 && (
            <div className={styles.empty}>
              docket's empty. either the league is perfect or you're all cowards.
            </div>
          )}
          {suggestions.map((s, i) => (
            <div key={s.ts} className={styles.card}>
              <div className={styles.cardHead}>
                <span className={styles.who}>{s.who}</span>
                <div className={styles.meta}>
                  <span className={styles.when}>{ago(s.ts)}</span>
                  <button type="button" className={styles.del} onClick={() => remove(i)} aria-label="delete">
                    ✕
                  </button>
                </div>
              </div>
              <span className={styles.text}>{s.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
