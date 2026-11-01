/** Copy for the studio entry page (step 4: strategies, no longer canhav.dev's projects). */
export const STUDIO_COPY = {
  kicker: "Studio",
  /** The plan word beside the account name in the app header. */
  plan: "Studio",
  newStrategy: "New strategy",
  subtitle:
    "Design a trading strategy, backtest it with real costs, paper trade it, " +
    "then let a bot trade it live within limits you set. Everything you have " +
    "started is below.",
  empty: {
    title: "No strategies yet",
    lead: "Pick a market and an entry rule, set your size and caps, and Studio backtests it against the venue's history with fees and rollover included.",
  },
  /** For accounts outside the allowlist while strategies are internal. */
  soon: "Strategies are opening soon.",
  storage: "Storage is not configured. Set DATABASE_URL and run npm run db:setup, then reload.",
} as const;
