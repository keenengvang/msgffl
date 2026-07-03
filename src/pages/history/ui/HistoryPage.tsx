import { useSavage } from '@/shared/lib/vibes';
import { useSeasonBundles } from '@/features/league-history/api/useSeasonBundles';
import { TeamAvatar } from '@/entities/team/ui/TeamAvatar';
import { PageTitle } from '@/shared/ui/PageTitle/PageTitle';
import { ErrorPanel } from '@/shared/ui/ErrorPanel/ErrorPanel';
import { fmt } from '@/shared/lib/format';
import type { RecordEntry } from '@/features/league-history/model/recordBook';
import styles from './HistoryPage.module.css';

export function HistoryPage() {
  const savage = useSavage();
  const { bundles, derived, isLoading, error } = useSeasonBundles();

  if (error) return <ErrorPanel error={error} />;

  const seasons = (bundles ?? []).map((b) => b.season);
  const span = seasons.length ? `${seasons[seasons.length - 1]}–${seasons[0]}` : '…';

  const records: Array<{ label: string; value: string; holder: string; sub: string }> = [];
  if (derived) {
    const push = (label: string, e: RecordEntry | null, valFmt: (v: number) => string) => {
      if (e) records.push({ label, value: valFmt(e.val), holder: e.who, sub: e.sub });
    };
    const rc = derived.recs;
    push(savage ? 'NUCLEAR WEEK' : 'HIGHEST WEEK', rc.hiWk, (v) => `${fmt(v)} PTS`);
    push(savage ? 'CRIME SCENE' : 'LOWEST WEEK', rc.loWk, (v) => `${fmt(v)} PTS`);
    push(savage ? 'THE MASSACRE' : 'BIGGEST BLOWOUT', rc.blow, (v) => `+${fmt(v)}`);
    push(savage ? 'HEARTBREAKER' : 'CLOSEST GAME', rc.close, (v) => `+${fmt(v)}`);
    push(savage ? 'FLAMETHROWER SEASON' : 'MOST PF, SEASON', rc.hiPF, (v) => `${fmt(v)} PF`);
    push(savage ? 'HUMAN TURNSTILE' : 'MOST PA, SEASON', rc.hiPA, (v) => `${fmt(v)} PA`);
  }

  const allTime = derived
    ? Object.keys(derived.agg)
        .map((k) => {
          const a = derived.agg[k]!;
          const m = derived.ownerMeta[k];
          const games = a.w + a.l;
          return {
            key: k,
            owner: m?.owner ?? '?',
            av: m?.av ?? '',
            wl: `${a.w}–${a.l}`,
            pct: games ? `${((a.w / games) * 100).toFixed(1)}%` : '—',
            pf: fmt(a.pf),
            titles: a.titles || '—',
            sackos: a.sackos || '—',
            _pct: games ? a.w / games : 0,
            _t: a.titles,
          };
        })
        .sort((a, b) => b._t - a._t || b._pct - a._pct)
    : [];

  return (
    <div className="pageEnter">
      <div className={styles.titleRow}>
        <PageTitle>The Record Book</PageTitle>
        <span className={styles.note}>SLEEPER ERA · {span} · HISTORY REMEMBERS EVERYTHING</span>
      </div>

      {isLoading && <div className={styles.loading}>excavating five seasons of shame…</div>}

      {bundles && derived && (
        <>
          <h2 className={styles.sectionHead}>TROPHY WALL</h2>
          <div className={styles.trophyGrid}>
            {bundles
              .filter((b) => b.champ)
              .map((b) => (
                <div key={b.season} className={styles.trophy}>
                  <span className={styles.ghostYear}>{b.season}</span>
                  <span className={styles.trophyLabel}>{b.season} CHAMPION</span>
                  <div className={styles.trophyRow}>
                    <TeamAvatar src={b.champ!.av} size={52} className={styles.trophyAv} />
                    <div className={styles.trophyStack}>
                      <span className={styles.trophyName}>{b.champ!.owner.toUpperCase()}</span>
                      <span className={styles.trophyTeam}>{b.champ!.team}</span>
                    </div>
                  </div>
                  <div className={styles.trophyFoot}>
                    <span>RUNNER-UP: {b.ru?.team ?? '—'}</span>
                    <span className={styles.sackoLine}>SACKO: {b.sacko?.team ?? '—'}</span>
                  </div>
                </div>
              ))}
          </div>

          <h2 className={`${styles.sectionHead} ${styles.sectionHeadLater}`}>LEAGUE RECORDS</h2>
          <div className={styles.recordGrid}>
            {records.map((rc) => (
              <div key={rc.label} className={styles.record}>
                <span className={styles.recordLabel}>{rc.label}</span>
                <span className={styles.recordValue}>{rc.value}</span>
                <span className={styles.recordHolder}>{rc.holder}</span>
                <span className={styles.recordSub}>{rc.sub}</span>
              </div>
            ))}
          </div>

          <h2 className={`${styles.sectionHead} ${styles.sectionHeadLater}`}>ALL-TIME TABLE</h2>
          <div className={styles.tableWrap}>
            <div className={styles.table}>
              <div className={styles.head}>
                <span style={{ width: 26 }}>RK</span>
                <span style={{ flex: 1.5 }}>MANAGER</span>
                <span style={{ width: 80 }}>W–L</span>
                <span style={{ width: 64, textAlign: 'right' }}>WIN%</span>
                <span style={{ width: 90, textAlign: 'right' }}>PF</span>
                <span style={{ width: 64, textAlign: 'right' }}>RINGS</span>
                <span style={{ width: 70, textAlign: 'right' }}>SACKOS</span>
              </div>
              {allTime.map((a, i) => (
                <div key={a.key} className={styles.row}>
                  <span className={`${styles.rk} ${i < 3 ? styles.rkHot : styles.rkCold}`}>{i + 1}</span>
                  <div className={styles.mgr}>
                    <TeamAvatar src={a.av} size={24} />
                    <span className={styles.mgrName}>{a.owner}</span>
                  </div>
                  <span className={styles.wl}>{a.wl}</span>
                  <span className={styles.pct}>{a.pct}</span>
                  <span className={styles.pf}>{a.pf}</span>
                  <span className={styles.rings}>{a.titles}</span>
                  <span className={styles.sackos}>{a.sackos}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
