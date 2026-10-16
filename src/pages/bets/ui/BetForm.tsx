import { useState } from 'react';
import { BET_LIMITS } from '@/entities/bet/lib/validate';
import type { BetDraft, BetPatch, BetRecord } from '@/entities/bet/model/types';
import type { StandingRow } from '@/entities/team/model/types';
import { BOOKIE } from '@/shared/config/constants';
import { diff, fromBet, placeholderBet, rebaseForm, type FormState } from '../model/betForm';
import styles from './BetsPage.module.css';

interface BetFormProps {
  season: string;
  defaultWeek: number;
  managers: StandingRow[];
  editing: BetRecord | null;
  onCancelEdit: () => void;
  onCreate: (d: BetDraft) => void;
  onEdit: (bet: BetRecord, p: BetPatch) => void;
  pending: boolean;
  status: { tone: 'ok' | 'err'; text: string } | null;
  savage: boolean;
}

export function BetForm(props: BetFormProps) {
  const { season, managers, editing, savage, pending } = props;
  // Seeded once — the page keys this component by the bet being edited, so
  // opening another bet (or cancelling) remounts it with fresh fields.
  const [form, setForm] = useState<FormState>(() =>
    editing ? fromBet(editing) : { sideA: '', sideB: '', week: props.defaultWeek, terms: '' },
  );
  // A different example each time the form opens.
  const [example] = useState(() => Math.floor(Math.random() * 100));
  // A conflict hands us a fresher copy of the same bet (same key, so no
  // remount): rebase the user's edits onto it rather than resending stale
  // values for fields someone else just changed.
  const [base, setBase] = useState(editing);
  if (editing && base && editing.version !== base.version) {
    setBase(editing);
    setForm(rebaseForm(form, base, editing));
  }

  const set = (p: Partial<FormState>) => setForm((f) => ({ ...f, ...p }));
  const draft: BetDraft = { season, week: form.week, sideA: form.sideA, sideB: form.sideB, terms: form.terms.trim() };
  const valid = !!draft.sideA && !!draft.sideB && draft.sideA !== draft.sideB && !!draft.terms;

  const submit = () => {
    if (!valid || pending) return;
    if (editing) props.onEdit(editing, diff(editing, draft));
    else props.onCreate(draft);
  };

  const nameOf = (id: string, fallback: string) => managers.find((m) => m.ownerId === id)?.owner ?? fallback;

  const pick = (key: 'sideA' | 'sideB', label: string) => (
    <select value={form[key]} onChange={(e) => set({ [key]: e.target.value })} className={styles.select} aria-label={label}>
      <option value="">— {label} —</option>
      {managers.map((m) => (
        <option key={m.ownerId} value={m.ownerId}>
          {m.owner}
        </option>
      ))}
    </select>
  );

  return (
    <div className={`${styles.form} ${editing ? styles.formEditing : ''}`}>
      <div className={styles.formHead}>
        <span className={styles.formLabel}>{editing ? (savage ? 'AMEND THE WAGER' : 'EDIT BET') : 'PLACE A BET'}</span>
        <span className={styles.bookie}>
          BOOKIE · <span className={styles.bookieName}>{BOOKIE.toUpperCase()}</span>
        </span>
      </div>

      {/* Frozen while a save is in flight: the success path remounts or closes
          the form, so anything typed meanwhile would be silently dropped. */}
      <fieldset disabled={pending} className={styles.fields}>
        <div className={styles.versus}>
          {pick('sideA', 'Team A')}
          <span className={styles.vs}>VS</span>
          {pick('sideB', 'Team B')}
        </div>

        <select
          value={form.week}
          onChange={(e) => set({ week: Number(e.target.value) })}
          className={styles.select}
          aria-label="Week"
        >
          {Array.from({ length: 17 }, (_, i) => i + 1).map((w) => (
            <option key={w} value={w}>
              WEEK {w}
            </option>
          ))}
        </select>

        <textarea
          value={form.terms}
          onChange={(e) => set({ terms: e.target.value })}
          maxLength={BET_LIMITS.terms}
          rows={4}
          placeholder={placeholderBet(
            example,
            savage,
            nameOf(form.sideA, 'Team A'),
            nameOf(form.sideB, 'Team B'),
            form.week,
          )}
          className={styles.textarea}
          aria-label="The bet"
        />
      </fieldset>

      <div className={styles.formActions}>
        <button type="button" className={styles.submit} onClick={submit} disabled={!valid || pending}>
          {pending ? 'BOOKING…' : editing ? 'SAVE CHANGES' : savage ? 'BOOK IT ⏎' : 'ADD BET'}
        </button>
        {editing && (
          <button type="button" className={styles.ghost} onClick={props.onCancelEdit} disabled={pending}>
            CANCEL
          </button>
        )}
        <span className={styles.hint}>
          {savage ? 'Book it whenever. Same matchup, ten side bets? Go nuts.' : 'Bets can be added or edited any time.'}
        </span>
      </div>
      {props.status && (
        <span className={props.status.tone === 'ok' ? styles.status : `${styles.status} ${styles.statusError}`}>
          {props.status.text}
        </span>
      )}
    </div>
  );
}
