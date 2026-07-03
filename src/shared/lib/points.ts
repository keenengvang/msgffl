interface FptsSettings {
  fpts?: number;
  fpts_decimal?: number;
  fpts_against?: number;
  fpts_against_decimal?: number;
}

/** Points-for from roster settings (Sleeper splits integer and decimal parts). */
export function ptsOf(s: FptsSettings): number {
  return (s.fpts ?? 0) + (s.fpts_decimal ?? 0) / 100;
}

/** Points-against from roster settings. */
export function paOf(s: FptsSettings): number {
  return (s.fpts_against ?? 0) + (s.fpts_against_decimal ?? 0) / 100;
}
