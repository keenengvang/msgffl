import { TeamAvatar } from '@/entities/team/ui/TeamAvatar';
import styles from './MatchupCard.module.css';

export type MatchupTagVariant = 'neutral' | 'nuke' | 'blow' | 'close';

export interface MatchupSide {
  avatar: string;
  name: string;
  owner: string;
  pts: string;
  win: boolean;
}

interface MatchupCardProps {
  tag: string;
  tagVariant: MatchupTagVariant;
  mid: string;
  a: MatchupSide;
  b: MatchupSide;
  done: boolean;
}

const TAG_CLASS: Record<MatchupTagVariant, string> = {
  neutral: styles.tagNeutral!,
  nuke: styles.tagNuke!,
  blow: styles.tagBlow!,
  close: styles.tagClose!,
};

function SideRow({ side, done }: { side: MatchupSide; done: boolean }) {
  const color = !done ? 'var(--text-body)' : side.win ? 'var(--text-primary)' : 'var(--text-muted)';
  return (
    <div className={styles.row}>
      <TeamAvatar src={side.avatar} size={34} className={side.win && done ? styles.avWin : styles.avLose} />
      <div className={styles.stack}>
        <span className={styles.name} style={{ color, fontWeight: side.win ? 800 : 600 }}>
          {side.name}
        </span>
        <span className={styles.owner}>{side.owner}</span>
      </div>
      <span className={styles.pts} style={{ color }}>
        {side.pts}
      </span>
    </div>
  );
}

export function MatchupCard({ tag, tagVariant, mid, a, b, done }: MatchupCardProps) {
  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <span className={`${styles.tag} ${TAG_CLASS[tagVariant]}`}>{tag}</span>
        <span className={styles.mid}>{mid}</span>
      </div>
      <SideRow side={a} done={done} />
      <SideRow side={b} done={done} />
    </div>
  );
}
