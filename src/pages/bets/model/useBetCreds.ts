import { useState } from 'react';
import { loadLS, saveLS } from '@/shared/lib/storage';
import type { Credentials } from '@/entities/bet/api/useBets';

/** Who you are + the league PIN, remembered per browser so settling up is one
    click. A convenience only — the server checks the PIN on every write. */
const LS_KEY = 'msg_bets_v1';

export function useBetCreds() {
  const [creds, setState] = useState<Credentials>(() => ({ pin: '', by: '', ...loadLS<Partial<Credentials>>(LS_KEY) }));
  const set = (next: Partial<Credentials>) =>
    setState((prev) => {
      const merged = { ...prev, ...next };
      saveLS(LS_KEY, merged);
      return merged;
    });
  return { creds, set, ready: !!creds.pin && !!creds.by.trim() };
}
