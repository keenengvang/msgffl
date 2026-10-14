import { useState } from 'react';
import { BET_LIMITS } from '@/entities/bet/lib/validate';
import type { BetDraft, BetPatch, BetRecord, BetTerms } from '@/entities/bet/model/types';
import type { StandingRow } from '@/entities/team/model/types';
import type { Credentials } from '@/entities/bet/api/useBets';
import styles from './BetsPage.module.css';

interface FormState {
  sideA: string;
  sideB: string;
  week: number;
  kind: BetTerms['kind'];
  text: string;
  stakes: string;
}

const fromBet = (b: BetRecord): FormState => ({
  sideA: b.sideA,
  sideB: b.sideB,
  week: b.week,
  kind: b.terms.kind,
  text: b.terms.kind === 'custom' ? b.terms.text : '',
  stakes: b.stakes,
});

/** Only what changed — an edit that doesn't touch the wager shouldn't trip the kickoff lock. */
function diff(before: BetRecord, d: BetDraft): BetPatch {
  const p: BetPatch = {};
  if (d.week !== before.week) p.week = d.week;
  if (d.sideA !== before.sideA) p.sideA = d.sideA;
  if (d.sideB !== before.sideB) p.sideB = d.sideB;
  if (d.stakes !== before.stakes) p.stakes = d.stakes;
  if (JSON.stringify(d.terms) !== JSON.stringify(before.terms)) p.terms = d.terms;
  return p;
}

interface BetFormProps {
  season: string;
  defaultWeek: number;
  managers: StandingRow[];
  creds: Credentials;
  setCreds: (c: Partial<Credentials>) => void;
  editing: BetRecord | null;
  onCancelEdit: () => void;
  onCreate: (d: BetDraft) => void;
  onEdit: (bet: BetRecord, p: BetPatch) => void;
  pending: boolean;
  status: { tone: 'ok' | 'err'; text: string } | null;
  savage: boolean;
}

export function BetForm(props: BetFormProps) {
  const { season, managers, creds, setCreds, editing, savage, pending } = props;
  // Seeded once — the page keys this component by the bet being edited, so
  // opening another bet (or cancelling) remounts it with fresh fields.
  const [form, setForm] = useState<FormState>(() => (
    editing ? fromBet(editing) : { sideA: '', sideB: '', week: props.defaultWeek, kind: 'matchup', text: '', stakes: '' }
  ));

  const set = (p: Partial<FormState>) => setForm((f) => ({ ...f, ...p }));
  const draft: BetDraft = {
    season,
    week: form.week,
    sideA: form.sideA,
    sideB: form.sideB,
    stakes: form.stakes.trim(),
    terms: form.kind === 'matchup' ? { kind: 'matchup' } : { kind: 'custom', text: form.text.trim() },
  };
  const valid =
    !!draft.sideA &&
    !!draft.sideB &&
    draft.sideA !== draft.sideB &&
    !!draft.stakes &&
    (form.kind === 'matchup' || !!form.text.trim()) &&
    !!creds.by.trim() &&
    !!creds.pin;

  const submit = () => {
    if (!valid || pending) return;
    if (editing) props.onEdit(editing, diff(editing, draft));
    else props.onCreate(draft);
  };

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
      <span className={styles.formLabel}>{editing ? (savage ? 'AMEND THE WAGER' : 'EDIT BET') : 'PLACE A BET'}</span>

      <div className={styles.row2}>
        <select
          value={creds.by}
          onChange={(e) => setCreds({ by: e.target.value })}
          className={styles.select}
          aria-label="Who's booking this"
        >
          <option value="">— {savage ? 'who’s the bookie?' : 'who are you?'} —</option>
          {managers.map((m) => (
            <option key={m.ownerId} value={m.owner}>
              {m.owner}
            </option>
          ))}
        </select>
        <input
          type="password"
          value={creds.pin}
          onChange={(e) => setCreds({ pin: e.target.value })}
          placeholder="league PIN"
          autoComplete="off"
          className={styles.input}
          aria-label="League PIN"
        />
      </div>

      <div className={styles.versus}>
        {pick('sideA', 'side A')}
        <span className={styles.vs}>VS</span>
        {pick('sideB', 'side B')}
      </div>

      <div className={styles.row2}>
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
        <div className={styles.kinds} role="radiogroup" aria-label="Bet type">
          {(
            [
              ['matchup', savage ? 'HIGH SCORE' : 'HIGHER SCORE'],
              ['custom', 'CUSTOM'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={form.kind === k}
              className={form.kind === k ? `${styles.kind} ${styles.kindActive}` : styles.kind}
              onClick={() => set({ kind: k })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {form.kind === 'custom' ? (
        <textarea
          value={form.text}
          onChange={(e) => set({ text: e.target.value })}
          maxLength={BET_LIMITS.terms}
          rows={2}
          placeholder={savage ? "e.g. 'first to start a guy on bye'" : "e.g. 'more points from their QB'"}
          className={styles.textarea}
          aria-label="Terms"
        />
      ) : (
        <span className={styles.hint}>
          {savage
            ? 'Higher score that week wins — Sleeper settles it, no appeals.'
            : 'Higher score that week wins. Settled automatically from Sleeper.'}
        </span>
      )}

      <input
        value={form.stakes}
        onChange={(e) => set({ stakes: e.target.value })}
        maxLength={BET_LIMITS.stakes}
        placeholder="stakes — a keg, $20, wears a Cowboys jersey to work"
        className={styles.input}
        aria-label="Stakes"
      />

      <div className={styles.formActions}>
        <button type="button" className={styles.submit} onClick={submit} disabled={!valid || pending}>
          {pending ? 'BOOKING…' : editing ? 'SAVE CHANGES' : savage ? 'BOOK IT ⏎' : 'ADD BET'}
        </button>
        {editing && (
          <button type="button" className={styles.ghost} onClick={props.onCancelEdit}>
            CANCEL
          </button>
        )}
        <span className={styles.hint}>
          {savage ? 'Locks the moment either side scores. No halftime renegotiations.' : 'Bets lock once either side starts scoring.'}
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
