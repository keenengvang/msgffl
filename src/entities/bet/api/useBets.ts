import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { qk } from '@/shared/api/queryKeys';
import type { BetDraft, BetPatch, BetRecord } from '../model/types';

const ENDPOINT = '/.netlify/functions/bets';

/** A failed write, with the server's message (it's written for humans) and,
    on a 409, the fresher copy that beat us. */
export class BetApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly fresh?: BetRecord,
  ) {
    super(message);
  }
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  const isJson = r.headers.get('content-type')?.includes('application/json');
  const body = isJson ? ((await r.json()) as { error?: string; bet?: BetRecord }) : null;
  if (!r.ok || !body) throw new BetApiError(r.status, body?.error ?? `the bookie is out (${r.status})`, body?.bet);
  return body as T;
}

/** Every bet in a season, deleted ones included (the page shows those apart). */
export function useBets(season: string | undefined) {
  return useQuery({
    queryKey: qk.bets(season ?? ''),
    enabled: !!season,
    queryFn: () =>
      call<{ bets: BetRecord[] }>(`${ENDPOINT}?season=${season}`).then((b) => b.bets),
    staleTime: 30_000,
    // Other people edit this board — the global default is off, but here a
    // returning tab should pick up their changes.
    refetchOnWindowFocus: true,
    retry: 1,
  });
}

export interface Credentials {
  pin: string;
  by: string;
}

const writeInit = (method: string, creds: Credentials, body: object): RequestInit => ({
  method,
  headers: { 'content-type': 'application/json', 'x-bets-pin': creds.pin },
  body: JSON.stringify({ ...body, by: creds.by }),
});

/** Swap one bet into the cached list (or prepend a new one) — the server's
    response is authoritative, so there's no refetch round trip. */
function useApplyBet() {
  const qc = useQueryClient();
  return async (bet: BetRecord) => {
    const key = qk.bets(bet.season);
    // A focus refetch that started before this write would otherwise land after
    // it and overwrite the server's answer with the pre-write list.
    await qc.cancelQueries({ queryKey: key });
    // No list yet (first load still running, or it failed): don't invent one
    // from this single bet — that would hide every other bet. Fetch the real one.
    if (!qc.getQueryData<BetRecord[]>(key)) {
      await qc.invalidateQueries({ queryKey: key });
      return;
    }
    qc.setQueryData<BetRecord[]>(key, (prev = []) =>
      prev.some((b) => b.id === bet.id) ? prev.map((b) => (b.id === bet.id ? bet : b)) : [bet, ...prev],
    );
  };
}

export function useCreateBet() {
  const apply = useApplyBet();
  return useMutation({
    mutationFn: ({ draft, creds }: { draft: BetDraft; creds: Credentials }) =>
      call<{ bet: BetRecord }>(ENDPOINT, writeInit('POST', creds, { bet: draft })).then((r) => r.bet),
    onSuccess: apply,
  });
}

export function useUpdateBet() {
  const apply = useApplyBet();
  return useMutation({
    mutationFn: ({ bet, patch, creds }: { bet: BetRecord; patch: BetPatch; creds: Credentials }) =>
      call<{ bet: BetRecord }>(
        `${ENDPOINT}?season=${bet.season}&id=${encodeURIComponent(bet.id)}`,
        writeInit('PATCH', creds, { patch, version: bet.version }),
      ).then((r) => r.bet),
    onSuccess: apply,
    // Lost a race: show the winner's version so the next try has a fresh etag.
    onError: (e) => {
      if (e instanceof BetApiError && e.fresh) void apply(e.fresh);
    },
  });
}
