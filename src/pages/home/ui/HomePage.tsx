import { Link, useNavigate } from '@tanstack/react-router';
import { useSavage, useVibes } from '@/shared/lib/vibes';
import { useSeason } from '@/entities/league/api/useSeason';
import { useStandings } from '@/entities/team/api/useStandings';
import { useBrackets } from '@/entities/bracket/api/useBrackets';
import { titleGame } from '@/entities/bracket/lib/titleGame';
import { TeamAvatar } from '@/entities/team/ui/TeamAvatar';
import { LoadingQuip } from '@/shared/ui/LoadingQuip/LoadingQuip';
import { ErrorPanel } from '@/shared/ui/ErrorPanel/ErrorPanel';
import { fmt } from '@/shared/lib/format';
import { heroCopy } from '../model/heroCopy';
import styles from './HomePage.module.css';

export function HomePage() {
  const savage = useSavage();
  const { motion } = useVibes();
  const { season, league, chain } = useSeason();
  const { standings, isLoading, error } = useStandings(league);
  const brackets = useBrackets(league);
  const navigate = useNavigate();

  if (error) return <ErrorPanel error={error} />;
  if (isLoading || !standings || !season) return <LoadingQuip />;

  const stand = standings;
  const complete = league?.status === 'complete';
  const preDraft = league?.status === 'pre_draft' || league?.status === 'drafting';
  const pws = league?.settings?.playoff_week_start ?? 15;
  const nextDraftYear = preDraft ? Number(season) : Number(season) + 1;

  const { champRoster, ruRoster } = titleGame(brackets.data?.winners);
  const champ = stand.find((r) => r.rosterId === champRoster);
  const ru = stand.find((r) => r.rosterId === ruRoster);
  const sacko = stand.length ? stand[stand.length - 1] : undefined;
  const pfKing = stand.length ? [...stand].sort((a, b) => b.pf - a.pf)[0] : undefined;
  const paMax = stand.length ? [...stand].sort((a, b) => b.pa - a.pa)[0] : undefined;
  const seedOf = (r: typeof champ) => (r ? stand.findIndex((x) => x.rosterId === r.rosterId) + 1 : '?');

  const hero = heroCopy({ season, status: league?.status, champ, ru, repeat: false, savage });

  const radarPool = [...stand].sort((a, b) => b.pf - a.pf).slice(0, 3);
  const radarLvls = [
    ['HIGH', 'var(--red)'],
    ['MED', 'var(--text-primary)'],
    ['LOW', 'var(--text-dim)'],
  ] as const;

  const intel: Array<{ p1: string; hi: string; hiCol: string; p2: string }> = [];
  if (champ) intel.push({ p1: 'title_decided: ', hi: champ.team, hiCol: 'var(--text-primary)', p2: ` def. ${ru ? ru.team : '?'}` });
  if (pfKing && pfKing.pf > 0) intel.push({ p1: `pf_record: ${pfKing.team} `, hi: fmt(pfKing.pf), hiCol: 'var(--text-primary)', p2: '' });
  if (sacko && complete) intel.push({ p1: 'punishment_locked: ', hi: sacko.team, hiCol: 'var(--loss)', p2: savage ? ' — lawyer up' : '' });
  if (paMax && paMax.pa > 0) intel.push({ p1: `${paMax.team} allowed `, hi: fmt(paMax.pa), hiCol: 'var(--text-primary)', p2: savage ? ' pts. brutal.' : ' pts.' });
  if (preDraft) intel.push({ p1: 'rosters: ', hi: 'empty', hiCol: 'var(--text-muted)', p2: ' · trash_talk: already flowing' });
  intel.push({ p1: `draft_${nextDraftYear}: `, hi: 'awaiting commissioner', hiCol: 'var(--text-muted)', p2: ' █' });

  return (
    <div className="pageEnter">
      <div className={styles.heroGrid}>
        <div className={styles.heroCol}>
          <span className={styles.kicker}>{hero.kicker}</span>
          <h1 className={styles.heroTitle}>
            {hero.a}
            <br />
            {hero.b}
            <span className={styles.heroDot}>.</span>
          </h1>
          <p className={styles.heroSub}>{hero.sub}</p>
          {champ && ru && (
            <div className={styles.champStrip}>
              <TeamAvatar src={champ.avatar} size={62} alt="champ" className={styles.champAv} />
              <div className={styles.col}>
                <span className={styles.champName}>{champ.team.toUpperCase()}</span>
                <span className={styles.champTag}>{season} CHAMPION</span>
              </div>
              <div className={styles.champDivider} />
              <TeamAvatar src={ru.avatar} size={38} alt="runner-up" className={styles.ruAv} />
              <div className={styles.colTight}>
                <span className={styles.ruName}>{ru.team.toUpperCase()}</span>
                <span className={styles.ruSub}>RUNNER-UP · {ru.owner.toUpperCase()}</span>
              </div>
            </div>
          )}
        </div>

        <div className={styles.snapshot}>
          <span className="uLabel">SEASON SNAPSHOT</span>
          <div className={styles.snapRow}>
            <span className={styles.snapLabel}>Most points scored</span>
            <span className={styles.snapValue}>
              {preDraft ? 'AWAITING KICKOFF' : pfKing ? pfKing.team.toUpperCase() : '…'} ·{' '}
              <span className={styles.snapAccent}>{preDraft ? '—' : pfKing ? fmt(pfKing.pf) : ''}</span>
            </span>
          </div>
          <div className={styles.snapRow}>
            <span className={styles.snapLabel}>Most points allowed</span>
            <span className={styles.snapValue}>
              {preDraft ? 'NOBODY, YET' : paMax ? paMax.team.toUpperCase() : '…'} ·{' '}
              <span className={styles.snapAccent}>{preDraft ? '—' : paMax ? fmt(paMax.pa) : ''}</span>
            </span>
          </div>
          <div className={styles.snapRow}>
            <span className={styles.snapLabel}>Last place — punishment owed</span>
            <span className={styles.snapValue}>
              {preDraft ? 'TBD' : sacko ? sacko.team.toUpperCase() : '…'} ·{' '}
              <span className={styles.snapAccent}>{preDraft ? '—' : sacko ? `${sacko.w}–${sacko.l}` : ''}</span>
            </span>
          </div>
          <div className={styles.snapFoot}>
            <span className={styles.snapLabel}>Next event</span>
            <span className={styles.nextEvent}>DRAFT {nextDraftYear} — TBD</span>
          </div>
        </div>
      </div>

      <div className={styles.lowerGrid}>
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardTitle}>STANDINGS</span>
            <Link to="/standings" className={styles.cardLink}>
              FULL TABLE →
            </Link>
          </div>
          {stand.slice(0, 6).map((r, i) => (
            <div key={r.rosterId} className={styles.homeRow}>
              <span className={`${styles.homeRank} ${i < 4 ? styles.rankHot : styles.rankCold}`}>{i + 1}</span>
              <TeamAvatar src={r.avatar} size={22} />
              <span className={styles.homeTeam}>
                {r.team}{' '}
                {champ && r.rosterId === champ.rosterId && <span className={styles.champChip}>★ CHAMP</span>}
              </span>
              <span className={styles.homeWl}>
                {r.w}–{r.l}
              </span>
              <span className={styles.homePf}>{fmt(r.pf)}</span>
            </div>
          ))}
        </div>

        <div className={styles.sideCol}>
          <div className={styles.card}>
            <div className={styles.cardHead}>
              <span className={styles.cardTitle}>{complete ? `TITLE GAME · WK ${Math.min(pws + 2, 17)}` : 'TITLE GAME'}</span>
              <Link to="/bracket" className={styles.cardLink}>
                BRACKET →
              </Link>
            </div>
            {champ && ru && (
              <div className={styles.tgBody}>
                <div className={styles.tgRow}>
                  <TeamAvatar src={champ.avatar} size={38} className={styles.tgAvA} />
                  <div className={styles.colTight} style={{ flex: 1, minWidth: 0 }}>
                    <span className={styles.tgName}>{champ.team.toUpperCase()}</span>
                    <span className={styles.tgSub}>
                      {champ.w}–{champ.l} · {seedOf(champ)} SEED
                    </span>
                  </div>
                  <span className={styles.tgW}>W</span>
                </div>
                <div className={styles.tgVs}>
                  <span className={styles.tgVsLabel}>VS</span>
                  <div className={styles.tgVsLine} />
                </div>
                <div className={`${styles.tgRow} ${styles.tgLoser}`}>
                  <TeamAvatar src={ru.avatar} size={38} className={styles.tgAvB} />
                  <div className={styles.colTight} style={{ flex: 1, minWidth: 0 }}>
                    <span className={styles.tgName}>{ru.team.toUpperCase()}</span>
                    <span className={styles.tgSub}>
                      {ru.w}–{ru.l} · {seedOf(ru)} SEED
                    </span>
                  </div>
                  <span className={styles.tgL}>L</span>
                </div>
              </div>
            )}
          </div>

          <div className={styles.radarCard}>
            <div className={styles.radarDish}>
              <div className={styles.radarRing1} />
              <div className={styles.radarRing2} />
              <div className={motion ? `${styles.radarSweep} ${styles.sweeping}` : styles.radarSweep} />
              <div className={styles.blip1} />
              <div className={styles.blip2} />
              <div className={styles.blip3} />
            </div>
            <div className={styles.radarList}>
              <span className={styles.cardTitle}>
                {preDraft ? season : Number(season) + 1} THREAT RADAR
              </span>
              <div className={styles.radarLines}>
                {preDraft ? (
                  <div className={styles.radarLine}>
                    <span style={{ color: 'var(--text-muted)' }}>▲ SCAN</span> NO READS — EVERYONE TALKS TOUGH IN JULY · PF —
                  </div>
                ) : (
                  radarPool.map((r, i) => (
                    <div key={r.rosterId} className={styles.radarLine}>
                      <span style={{ color: radarLvls[i]?.[1] }}>▲ {radarLvls[i]?.[0]}</span> {r.team.toUpperCase()} · PF{' '}
                      {fmt(r.pf)}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <div className={styles.sideCol}>
          <div className={styles.intelCard}>
            <span className={styles.cardTitle}>INTEL FEED</span>
            <div className={styles.intelLines}>
              {intel.map((ln, i) => (
                <div key={i} className={styles.intelLine}>
                  <span className={styles.prompt}>&gt;</span> {ln.p1}
                  <span style={{ color: ln.hiCol }}>{ln.hi}</span>
                  {ln.p2}
                </div>
              ))}
            </div>
          </div>

          <Link to="/suggest" className={styles.cta}>
            <span className={styles.ctaLabel}>THE SUGGESTION BOX</span>
            <span className={styles.ctaTitle}>
              GOT A RULE BEEF?
              <br />
              PITCH IT HERE →
            </span>
          </Link>

          <div className={styles.archive}>
            <span className="uLabel">SEASON ARCHIVE</span>
            <div className={styles.archivePills}>
              {(chain ?? []).map((l) => (
                <button
                  key={l.league_id}
                  type="button"
                  className="uLabel"
                  style={{
                    cursor: 'pointer',
                    fontSize: 14,
                    letterSpacing: '.02em',
                    color: l.season === season ? 'var(--text-primary)' : 'var(--text-nav)',
                    background: l.season === season ? 'var(--red)' : 'transparent',
                    border: `1px solid ${l.season === season ? 'var(--red)' : 'var(--border-18)'}`,
                    borderRadius: 'var(--r-pill)',
                    padding: '5px 13px',
                  }}
                  onClick={() => navigate({ to: '.', search: (prev) => ({ ...prev, season: l.season }) })}
                >
                  {l.season}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
