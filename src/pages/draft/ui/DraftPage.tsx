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
            <div className={styles.board}>
              {Object.keys(rounds)
                .sort((a, b) => Number(a) - Number(b))
                .map((rd) => (
                  <div key={rd} className={styles.roundRow}>
                    <div className={styles.roundNum}>{rd}</div>
                    {rounds[Number(rd)]!.sort((a, b) => a.pick_no - b.pick_no).map((p) => {
                      const md = p.metadata ?? {};
                      const posCol = POS_COLORS[md.position as Position] ?? 'var(--pos-def)';
                      const owner = usersById?.[p.picked_by];
                      return (
                        <div key={p.pick_no} className={styles.pick} style={{ borderTopColor: posCol }}>
                          <span className={styles.pickNo}>
                            {String(p.pick_no).padStart(3, '0')} · {(owner?.display_name ?? '?').slice(0, 10)}
                          </span>
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
