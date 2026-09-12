export interface WeeklySummarySection {
  heading: string;
  body: string;
}

/** Shape of one content/weekly-summaries/<season>-w<week>.json file. */
export interface WeeklySummary {
  season: string;
  week: number;
  generatedAt: string;
  headline: string;
  sections: WeeklySummarySection[];
}

/** One row of content/weekly-summaries/index.json — the manifest the agent
    prepends a new entry to every time it writes a new weekly file. */
export interface WeeklySummaryIndexEntry {
  season: string;
  week: number;
  generatedAt: string;
  headline: string;
  file: string;
}

export interface WeeklySummaryIndex {
  weeks: WeeklySummaryIndexEntry[];
}
