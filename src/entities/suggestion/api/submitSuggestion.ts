import { useMutation } from '@tanstack/react-query';

export interface SubmitSuggestionInput {
  who: string;
  text: string;
}

export interface SubmittedIssue {
  number: number;
  url: string;
}

/** Send a suggestion to league HQ (Netlify Function → GitHub issue).
    The localStorage docket is the offline fallback either way. */
export function useSubmitSuggestion() {
  return useMutation({
    mutationFn: async (input: SubmitSuggestionInput): Promise<SubmittedIssue> => {
      const r = await fetch('/.netlify/functions/suggest', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!r.ok) throw new Error(`HQ said no (${r.status})`);
      return r.json() as Promise<SubmittedIssue>;
    },
  });
}
