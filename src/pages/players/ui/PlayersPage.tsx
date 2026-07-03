import { useEffect, useState } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import { useSeason } from '@/entities/league/api/useSeason';
import { ptsKey } from '@/entities/league/lib/ptsKey';
import { usePlayersDb } from '@/entities/player/api/usePlayersDb';
import { useSeasonStats } from '@/entities/player/api/useSeasonStats';
import { headshotUrl } from '@/shared/api/sleeper';
import { PageTitle } from '@/shared/ui/PageTitle/PageTitle';
import { ErrorPanel } from '@/shared/ui/ErrorPanel/ErrorPanel';
import { POS_COLORS, type Position } from '@/shared/config/constants';
import { fmt } from '@/shared/lib/format';
import { filterPlayers } from '../model/filterPlayers';
import styles from './PlayersPage.module.css';

const route = getRouteApi('/players');
const POS_ORDER = ['ALL', 'QB', 'RB', 'WR', 'TE', 'K', 'DEF'] as const;

function Headshot({ pid, pos }: { pid: string; pos: string }) {
  const [broken, setBroken] = useState(false);
  return (
    <img
      src={headshotUrl(pid, pos)}
      alt=""
      className={styles.headshot}
      style={broken ? { opacity: 0 } : undefined}
      onError={() => setBroken(true)}
    />
  );
}

export function PlayersPage() {
  const { season, league } = useSeason();
  const players = usePlayersDb();
  const stats = useSeasonStats(season, league);
  const { q = '', pos = 'ALL' } = route.useSearch();
  const navigate = route.useNavigate();

  // Debounce typing locally, write through to the URL for shareable filters.
  const [draft, setDraft] = useState(q);
  const [lastQ, setLastQ] = useState(q);
  if (q !== lastQ) {
    // sync from URL during render (back/forward, shared links)
    setLastQ(q);
    setDraft(q);
  }
  useEffect(() => {
    if (draft === q) return;
    const t = setTimeout(
      () => navigate({ search: (prev) => ({ ...prev, q: draft || undefined }), replace: true }),
      300,
    );
    return () => clearTimeout(t);
  }, [draft, q, navigate]);

  if (players.error) return <ErrorPanel error={players.error} />;

  const pk = ptsKey(league);
  const ready = !!(players.data && stats.data);
  const list = ready ? filterPlayers(players.data!, stats.data!, pk, pos, q) : [];

  return (
    <div className="pageEnter">
      <div className={styles.titleRow}>
        <PageTitle suffix={season}>Player Lab</PageTitle>
        <span className={styles.note}>
          SCORING: {pk === 'pts_ppr' ? 'FULL PPR' : pk === 'pts_half_ppr' ? 'HALF PPR' : 'STANDARD'} — PULLED FROM
          YOUR LEAGUE SETTINGS. DON'T @ THE COMMISH.
        </span>
      </div>

      <div className={styles.controls}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="search a guy…"
          className={styles.search}
        />
        <div className={styles.pills}>
          {POS_ORDER.map((p) => (
            <button
              key={p}
              type="button"
              className={p === pos ? `${styles.pill} ${styles.pillActive}` : styles.pill}
              onClick={() => navigate({ search: (prev) => ({ ...prev, pos: p === 'ALL' ? undefined : p }) })}
            >
              {p}
            </button>
          ))}
        </div>
        {ready && <span className={styles.count}>{list.length.toLocaleString()} PLAYERS · TOP 150 SHOWN</span>}
      </div>

      {!ready && (
        <div className={styles.loading}>
          {players.isLoading
            ? "downloading every player in the NFL. one sec, it's a big league…"
            : 'crunching season stats…'}
        </div>
      )}

      {ready && (
        <div className={styles.tableWrap}>
          <div className={styles.table}>
            <div className={styles.head}>
              <span style={{ width: 30 }}>RK</span>
              <span style={{ width: 28 }} />
              <span style={{ flex: 1.5 }}>PLAYER</span>
              <span style={{ width: 44 }}>POS</span>
              <span style={{ width: 48 }}>TEAM</span>
              <span style={{ width: 44, textAlign: 'right' }}>GP</span>
              <span style={{ width: 74, textAlign: 'right' }}>PTS</span>
              <span style={{ width: 64, textAlign: 'right' }}>AVG</span>
            </div>
            {list.slice(0, 150).map((p, i) => (
              <div key={p.pid} className={styles.row}>
                <span className={styles.rk}>{i + 1}</span>
                <Headshot pid={p.pid} pos={p.p} />
                <span className={styles.name}>{p.n}</span>
                <span className={styles.posCell}>
                  <span className={styles.pos} style={{ color: POS_COLORS[p.p as Position] ?? 'var(--pos-def)' }}>
                    {p.p}
                  </span>
                </span>
                <span className={styles.team}>{p.t}</span>
                <span className={styles.gp}>{p.gp || '—'}</span>
                <span className={styles.pts}>{fmt(p.pts)}</span>
                <span className={styles.avg}>{p.gp ? fmt(p.pts / p.gp) : '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
