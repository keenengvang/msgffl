// Sleeper API helpers + league math for the M$G league site
const API = 'https://api.sleeper.app/v1';

export async function api(path) {
  const r = await fetch(API + path);
  if (!r.ok) throw new Error('Sleeper said no (' + r.status + ') on ' + path);
  return r.json();
}

export async function walkChain(startId) {
  const chain = [];
  let id = startId;
  while (id && id !== '0' && chain.length < 20) {
    const lg = await api('/league/' + id);
    chain.push(lg);
    id = lg.previous_league_id;
  }
  return chain; // newest first
}

export function ptsOf(s) { return (s.fpts || 0) + (s.fpts_decimal || 0) / 100; }
export function paOf(s) { return (s.fpts_against || 0) + (s.fpts_against_decimal || 0) / 100; }
export function fmt(n) { return (Math.round((n || 0) * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
export function fmt0(n) { return Math.round(n || 0).toLocaleString('en-US'); }
export function avUrl(a) { return a ? 'https://sleepercdn.com/avatars/thumbs/' + a : ''; }

export function computeStandings(rosters, usersById) {
  const rows = (rosters || []).map(r => {
    const u = usersById[r.owner_id] || {};
    const s = r.settings || {};
    return {
      rosterId: r.roster_id, ownerId: r.owner_id,
      team: (((u.metadata && u.metadata.team_name) || u.display_name || 'Team ' + r.roster_id) + '').trim(),
      owner: u.display_name || '—',
      avatar: avUrl(u.avatar),
      w: s.wins || 0, l: s.losses || 0, t: s.ties || 0,
      pf: ptsOf(s), pa: paOf(s),
      recordStr: (r.metadata && r.metadata.record) || ''
    };
  });
  rows.sort((a, b) => b.w - a.w || b.pf - a.pf);
  return rows;
}

export function pairMatchups(list) {
  const by = {};
  (list || []).forEach(m => { if (m.matchup_id == null) return; (by[m.matchup_id] = by[m.matchup_id] || []).push(m); });
  return Object.values(by).filter(p => p.length === 2).map(p => p.sort((a, b) => a.roster_id - b.roster_id));
}

export function trimPlayers(raw) {
  const keep = { QB: 1, RB: 1, WR: 1, TE: 1, K: 1, DEF: 1 };
  const out = {};
  for (const id in raw) {
    const p = raw[id];
    if (!p || !keep[p.position]) continue;
    if (p.position !== 'DEF' && p.status !== 'Active') continue;
    out[id] = {
      n: ((p.first_name || '') + ' ' + (p.last_name || '')).trim(),
      p: p.position, t: p.team || 'FA', a: p.age || 0,
      x: (p.years_exp == null ? -1 : p.years_exp)
    };
  }
  return out;
}

export function headshot(pid, pos) {
  if (pos === 'DEF') return 'https://sleepercdn.com/images/team_logos/nfl/' + String(pid).toLowerCase() + '.png';
  return 'https://sleepercdn.com/content/nfl/players/thumb/' + pid + '.jpg';
}

export function loadLS(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
export function saveLS(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
