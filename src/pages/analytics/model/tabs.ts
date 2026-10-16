/** The three sections of /analytics, in nav order. `race` is the default and
    stays out of the URL. */
export const ANALYTICS_TABS = ['race', 'skill', 'roster'] as const;
export type AnalyticsTab = (typeof ANALYTICS_TABS)[number];

export function parseTab(v: unknown): AnalyticsTab | undefined {
  return ANALYTICS_TABS.includes(v as AnalyticsTab) && v !== 'race' ? (v as AnalyticsTab) : undefined;
}
