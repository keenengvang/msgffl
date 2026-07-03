import type { CSSProperties } from 'react';
import { useSavage } from '@/shared/lib/vibes';
import { useSeason } from '@/entities/league/api/useSeason';
import { ptsKey } from '@/entities/league/lib/ptsKey';
import { useStandings } from '@/entities/team/api/useStandings';
import { useDraft } from '@/entities/draft/api/useDraft';
import { useSeasonStats } from '@/entities/player/api/useSeasonStats';
import { PageTitle } from '@/shared/ui/PageTitle/PageTitle';
import { LoadingQuip } from '@/shared/ui/LoadingQuip/LoadingQuip';
import { ErrorPanel } from '@/shared/ui/ErrorPanel/ErrorPanel';
import { POS_COLORS, type Position } from '@/shared/config/constants';
import { fmt } from '@/shared/lib/format';
import { GRADE_BLURBS, gradeColor, gradeFor, rankDraftClasses } from '../model/draftGrades';
import styles from './DraftPage.module.css';

export function DraftPage() {
  const savage = useSavage();
  const { season, league } = useSeason();
  const { standings, usersById, isLoading, error } = useStandings(league);
  const draft = useDraft(league);
  const stats = useSeasonStats(season, league);

  if (error) return <ErrorPanel error={error} />;
  if (isLoading || !standings || draft.isLoading) return <LoadingQuip text="checking the war room…" />;

  const d = draft.data?.draft ?? null;
  const picks = draft.data?.picks ?? [];
  const dReady = picks.length > 0;
  const names: Record<number, (typeof standings)[number]> = {};
  standings.forEach((r) => (names[r.rosterId] = r));

  const rounds: Record<number, typeof picks> = {};
  picks.forEach((p) => (rounds[p.round] ??= []).push(p));

  // Snake columns: one per draft slot, headed by the drafting manager.
  // Slot → user comes from draft_order, with round-1 picks as fallback.
  const slotCount = Math.max(14, ...picks.map((p) => p.draft_slot || 0));
  const slotUser: Record<number, string> = {};
  Object.entries(d?.draft_order ?? {}).forEach(([userId, slot]) => (slotUser[slot] = userId));
  picks.forEach((p) => {
    if (p.round === 1 && p.draft_slot && !slotUser[p.draft_slot]) slotUser[p.draft_slot] = p.picked_by;
  });
  const byOwner: Record<string, (typeof standings)[number]> = {};
  standings.forEach((r) => (byOwner[r.ownerId] = r));
  const slots = Array.from({ length: slotCount }, (_, i) => {
    const userId = slotUser[i + 1];
    const row = userId ? byOwner[userId] : undefined;
    return {
      slot: i + 1,
      team: row?.team ?? (userId ? (usersById?.[userId]?.display_name ?? `Slot ${i + 1}`) : `Slot ${i + 1}`),
      owner: row?.owner ?? usersById?.[slotUser[i + 1] ?? '']?.display_name ?? '—',
    };
  });

  const pk = ptsKey(league);
  const ranked = dReady && stats.data ? rankDraftClasses(picks, stats.data, pk) : [];
  const blurbs = GRADE_BLURBS[savage ? 'savage' : 'polite'];

  return (
    <div className="pageEnter">
      <div className={styles.titleRow}>
        <PageTitle suffix={season}>Draft Board</PageTitle>
        <span className={styles.note}>
          {d
            ? `${d.settings?.rounds ?? '?'} ROUNDS · SNAKE · ${(d.status || '').toUpperCase().replace('_', ' ')}`
            : 'checking the war room…'}
        </span>
      </div>

      {d && !dReady && (
        <div className={styles.empty}>draft not started. the war rooms are quiet. too quiet.</div>
      )}

      {dReady && (
        <>
          <div className={styles.boardWrap}>
            <div className={styles.board} style={{ '--slots': slotCount } as CSSProperties}>
              <div className={styles.slotGrid}>
                <div />
                {slots.map((s) => (
                  <div key={s.slot} className={styles.headCell} style={{ gridColumn: s.slot + 1 }}>
                    <span className={styles.headTeam}>{s.team}</span>
                    <span className={styles.headOwner}>{s.owner}</span>
                  </div>
                ))}
              </div>
              {Object.keys(rounds)
                .sort((a, b) => Number(a) - Number(b))
                .map((rd) => (
                  <div key={rd} className={styles.slotGrid}>
                    <div className={styles.roundNum}>
                      {rd}
                      {/* snake: odd rounds pick left→right, even rounds right→left */}
                      <span className={styles.snakeDir}>{Number(rd) % 2 === 1 ? '→' : '←'}</span>
                    </div>
                    {rounds[Number(rd)]!.map((p) => {
                      const md = p.metadata ?? {};
                      const posCol = POS_COLORS[md.position as Position] ?? 'var(--pos-def)';
                      return (
                        <div
                          key={p.pick_no}
                          className={styles.pick}
                          style={{ borderTopColor: posCol, gridColumn: (p.draft_slot || 1) + 1 }}
                        >
                          <span className={styles.pickNo}>{String(p.pick_no).padStart(3, '0')}</span>
                          <span className={styles.pickName}>
                            {md.first_name ?? ''} {md.last_name ?? ''}
                          </span>
                          <span className={styles.pickPos} style={{ color: posCol }}>
                            {md.position ?? '?'} · {md.team ?? 'FA'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ))}
            </div>
          </div>

          <div className={styles.gradesHead}>
            <h2 className={styles.gradesTitle}>Draft Grades</h2>
            <span className={styles.gradesNote}>
              {ranked.length
                ? `TOTAL ${season} PTS SCORED BY EACH TEAM'S DRAFT CLASS. THE MATH DOES NOT CARE ABOUT YOUR FEELINGS.`
                : 'grades compile once the nerd math finishes…'}
            </span>
          </div>
          <div className={styles.gradeGrid}>
            {ranked.map((e, i) => {
              const g = gradeFor(i);
              return (
                <div key={e.rid} className={styles.gradeCard}>
                  <span className={styles.gradeTile} style={{ color: gradeColor(g) }}>
                    {g}
                  </span>
                  <div className={styles.gradeStack}>
                    <span className={styles.gradeTeam}>{names[e.rid]?.team ?? `Roster ${e.rid}`}</span>
                    <span className={styles.gradeBlurb}>{blurbs[g]}</span>
                    <span className={styles.gradeTotal}>{fmt(e.total)} PTS FROM DRAFTED PLAYERS</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
