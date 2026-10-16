import type { ReactNode } from 'react';
import type { League, SeasonWeeks } from '@/shared/api/types';
import type { StandingRow } from '@/entities/team/model/types';
import { Panel } from '@/shared/ui/Panel/Panel';
import { LoadingQuip } from '@/shared/ui/LoadingQuip/LoadingQuip';
import type { Game } from '../model/analytics';
import styles from './AnalyticsPage.module.css';

/** Everything a tab needs from the page: the season, its decided games, and
    the shared highlight. */
export interface TabProps {
  league: League;
  weeks: SeasonWeeks;
  games: Game[];
  standings: StandingRow[];
  through: number;
  complete: boolean;
  selected: number | null;
  onSelect: (rosterId: number) => void;
  nameOf: (rosterId: number) => string;
  savage: boolean;
}

interface ChartPanelProps {
  label: string;
  /** The answer, in one sentence — the chart is the evidence. */
  headline?: ReactNode;
  /** How to read it, in one line. */
  how: string;
  children: ReactNode;
  className?: string;
}

/** Every chart leads with its takeaway, then a line on how to read it. */
export function ChartPanel({ label, headline, how, children, className }: ChartPanelProps) {
  return (
    <Panel label={label} className={className}>
      {headline && <p className={styles.headline}>{headline}</p>}
      <p className={styles.how}>{how}</p>
      {children}
    </Panel>
  );
}

/** A chart's own data is still loading or failed — said inside its panel, so
    one slow request doesn't hold the whole tab hostage. */
export function PanelStatus({ error, savage, empty }: { error?: unknown; savage: boolean; empty?: string }) {
  if (empty) return <p className={styles.dim}>{empty}</p>;
  if (error)
    return (
      <p className={styles.dim} role="status">
        {savage ? 'Sleeper hung up on this one. Try again in a minute.' : 'This chart couldn’t load from Sleeper — try again shortly.'}
      </p>
    );
  return <LoadingQuip text="crunching the tape…" />;
}

/** 0–1 → "87%", but never claims certainty it doesn't have: "<1%", ">99%". */
export function oddsPct(v: number): string {
  if (v >= 1) return '100%';
  if (v <= 0) return '0%';
  if (v < 0.01) return '<1%';
  if (v > 0.99) return '>99%';
  return `${Math.round(v * 100)}%`;
}

/** +2.6 / −1.4 with a real minus sign. */
export function signed(v: number, digits = 1): string {
  const s = Math.abs(v).toFixed(digits);
  return v > 0 ? `+${s}` : v < 0 ? `−${s}` : s;
}

export const Name = ({ children }: { children: ReactNode }) => <b className={styles.who}>{children}</b>;
export const Num = ({ children }: { children: ReactNode }) => <span className="uMono">{children}</span>;
