export interface WeeklySummarySection {
  heading: string;
  body: string;
}

/** Shape the weekly-summary managed agent writes to content/weekly-summaries/latest.json. */
export interface WeeklySummary {
  season: string;
  week: number;
  generatedAt: string;
  headline: string;
  sections: WeeklySummarySection[];
}
