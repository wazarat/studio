/** Copy for the Studio dashboard (step 4b): trader language, no projects. */
export const STUDIO_COPY = {
  kicker: "Studio",
  /** The plan word beside the account name in the app header. */
  plan: "Studio",
  newStrategy: "New strategy",
  subtitle:
    "Design a strategy on the chart, backtest it with real fees and rollover, " +
    "paper trade it, then let a bot trade it live within the limits you set.",
  strip: {
    accountValue: "Account value",
    today: "Today",
    openPositions: "Open positions",
    note: "Paper and live trading start in the next step.",
  },
  table: {
    title: "Strategies",
    empty: "No strategies yet. Start from a template below or pick a market.",
  },
  feed: {
    title: "Activity",
    empty: "Signals, fills and checker refusals show up here. Backtest events appear once a strategy is saved.",
    source: "backtest",
  },
  markets: { title: "Markets" },
  templates: { title: "Start from a template" },
  /** For accounts outside the allowlist while strategies are internal. */
  soon: "Strategies are opening soon.",
  storage: "Storage is not configured. Set DATABASE_URL and run npm run db:setup, then reload.",
} as const;
