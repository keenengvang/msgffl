import { useCallback, useState } from 'react';
import { loadLS, saveLS } from '@/shared/lib/storage';

const LS_KEY = 'msg_suggestions_v1';

export interface Suggestion {
  who: string;
  text: string;
  ts: number;
}

/** Per-device suggestion docket (localStorage). The Notion submission
    endpoint is a planned follow-up; this remains the offline fallback. */
export function useSuggestions() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>(() => loadLS<Suggestion[]>(LS_KEY) ?? []);
  const [copied, setCopied] = useState(false);

  const add = useCallback((who: string, text: string) => {
    const t = text.trim();
    if (!t) return false;
    setSuggestions((prev) => {
      const next = [{ who: who || 'ANONYMOUS COWARD', text: t, ts: Date.now() }, ...prev];
      saveLS(LS_KEY, next);
      return next;
    });
    return true;
  }, []);

  const remove = useCallback((index: number) => {
    setSuggestions((prev) => {
      const next = prev.filter((_, j) => j !== index);
      saveLS(LS_KEY, next);
      return next;
    });
  }, []);

  const copyAll = useCallback(() => {
    setSuggestions((prev) => {
      const lines = prev.map((s) => `• ${s.who || '?'}: ${s.text}`).join('\n');
      navigator.clipboard?.writeText(`M$G LEAGUE SUGGESTION DOCKET\n${lines || '(empty)'}`).catch(() => {});
      return prev;
    });
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }, []);

  return { suggestions, add, remove, copyAll, copied };
}
