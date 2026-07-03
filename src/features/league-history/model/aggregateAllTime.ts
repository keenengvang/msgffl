import type { SeasonBundle } from './buildSeasonBundle';

export interface OwnerAgg {
  w: number;
  l: number;
  pf: number;
  titles: number;
  sackos: number;
  seasons: number;
}

export interface OwnerMeta {
  owner: string;
  team: string;
  av: string;
}

export interface AllTime {
  agg: Record<string, OwnerAgg>;
  ownerMeta: Record<string, OwnerMeta>;
}

/** All-time W/L/PF/titles/sackos per owner across every season bundle. */
export function aggregateAllTime(bundles: SeasonBundle[]): AllTime {
  const agg: Record<string, OwnerAgg> = {};
  const ownerMeta: Record<string, OwnerMeta> = {};
  bundles.forEach((b) => {
    b.standings.forEach((r) => {
      const k = r.ownerId;
      agg[k] ??= { w: 0, l: 0, pf: 0, titles: 0, sackos: 0, seasons: 0 };
      agg[k].w += r.w;
      agg[k].l += r.l;
      agg[k].pf += r.pf;
      agg[k].seasons++;
      ownerMeta[k] ??= { owner: r.owner, team: r.team, av: r.avatar };
    });
    if (b.champ && agg[b.champ.ownerId]) agg[b.champ.ownerId]!.titles++;
    if (b.sacko && agg[b.sacko.ownerId]) agg[b.sacko.ownerId]!.sackos++;
  });
  return { agg, ownerMeta };
}
