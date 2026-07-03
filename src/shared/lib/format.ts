/** 1,234.56 — two decimals, always. */
export function fmt(n: number | null | undefined): string {
  return (Math.round((n ?? 0) * 100) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** 1,235 — rounded, no decimals. */
export function fmt0(n: number | null | undefined): string {
  return Math.round(n ?? 0).toLocaleString('en-US');
}

/** 1st / 2nd / 3rd / 4th … */
export function ord(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? 'th');
}

/** AUG 24 · 4:00 PM — viewer's local timezone. */
export function fmtEventDate(ms: number): string {
  const d = new Date(ms);
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toUpperCase();
  return `${date} · ${time}`;
}

/** today / yesterday / Nd ago */
export function ago(ts: number): string {
  const d = Math.floor((Date.now() - ts) / 864e5);
  return d < 1 ? 'today' : d === 1 ? 'yesterday' : `${d}d ago`;
}
