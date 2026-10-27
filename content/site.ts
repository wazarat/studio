/**
 * Site-wide constants. Edit here to change branding, metadata, and the
 * copy that appears in more than one place.
 */
export const SITE = {
  name: "CanHav Research",
  tagline: "DeFi ecosystem solutions for capital markets.",
  url: "https://canhav.com",
  docsUrl: "https://docs.canhav.com",
  /** The booking page (Google Calendar on a canhav address). */
  meetUrl: "https://meet.canhav.com",
  description:
    "CanHav Research builds DeFi ecosystem solutions. Token design, testnet deployment, MCP data connectors, and market validation for teams and independent builders.",
  footerBlurb:
    "DeFi ecosystem solutions. Research grade datasets and launch tooling, curated and refreshed daily.",
  footerLegal: "Research preview, not financial advice.",
} as const;

/**
 * Primary nav links, rendered right-aligned before the theme toggle and the
 * auth button. Launch and Explore left the nav in M147: the only tokens
 * CanHav focuses on are the ones a project creates, so a launch starts from
 * a project ("Launch a token from this project" opens /launch?project=<id>)
 * and /explore stays reachable by URL, unlinked. Studio Pro (/studiopro) is
 * reached from the studio, not from here.
 */
export const NAV_LINKS: ReadonlyArray<{ label: string; href: string; soon?: boolean }> = [
  { label: "Meet", href: SITE.meetUrl },
  { label: "Docs", href: SITE.docsUrl },
];
