/**
 * Copy for the Studio Pro page (/studiopro), the services offer for small
 * teams. Reached from the studio's "Join Studio Pro" button, not from the nav.
 * No colons and no em dashes in any string (npm run check:copy).
 */
export const STUDIO_PRO_COPY = {
  metaTitle: "Studio Pro",
  metaDescription:
    "Studio Pro from CanHav Research. Legal and compliance, product development, customer discovery, content, fundraising prep and launch operations, handled and managed for small Web3 teams.",
  kicker: "Are you developing a DeFi product?",
  /** Two fixed lines. The second one carries the hero gradient. */
  titleLine1: "Your team may be small.",
  titleLine2: "Your to do list is not.",
  /**
   * CoinGecko counted 53% of every token listed on GeckoTerminal as dead by
   * late 2025 (52.7% in its April 2025 report). The sentence stays "over half"
   * so it holds as the number moves.
   */
  leadFact: "Over half of all tokens ever listed are already dead.",
  lead:
    "Small teams find it increasingly complicated to juggle everything needed to bring a Web3 project to market.",
  cta: "Let's talk",
  ctaNote: "Pick what you want off your plate. We take it from there.",
  cards: {
    testnet: {
      title: "Testnet Design",
      description:
        "Design your token in the studio and deploy it to testnet in minutes. Supply, allocations, and vesting captured as a verifiable record.",
    },
    workflow: {
      title: "Manage Workflow",
      description:
        "Run your launch work from the tools your team already uses. Query published designs, deployed launches, verified journeys, sales and pools over MCP and keep every workstream moving from one place.",
    },
    validation: {
      title: "Market Validation",
      description:
        "Publish the evidence behind your launch and gather real market feedback before a market exists. Scrutiny first, speculation later.",
    },
  },
  /** Every one of the nine cards opens the contact form with this label. */
  cardCta: "Ask about this",
  services: {
    legal: {
      title: "Legal and Compliance",
      description:
        "Entity setup, token classification, terms and disclosures, and the KYC or AML path that fits your market. Reviewed before anything goes live.",
    },
    development: {
      title: "Product Development",
      description:
        "Contracts, indexers and front ends built to the design you published, with audits scoped early and shipped on a schedule you can see.",
    },
    discovery: {
      title: "Customer Discovery",
      description:
        "Interviews, surveys and usage signals that tell you who actually wants the product, before the token decides it for you.",
    },
    content: {
      title: "Content and Media",
      description:
        "Docs, launch posts, explainers and the social cadence that keeps your community informed, written from the evidence you publish.",
    },
    fundraising: {
      title: "Fundraising Prep",
      description:
        "Data room, deck, tokenomics narrative and investor reachouts, grounded in the on-chain record so every claim checks out.",
    },
    operations: {
      title: "Launch Operations",
      description:
        "Timeline, listings, liquidity, milestone updates and the day of launch itself, run as one plan with someone accountable for each step.",
    },
  },
} as const;

/** The nine solutions a lead can pick in the contact form, cards first then services. */
export const STUDIO_PRO_SOLUTIONS = [
  { key: "testnet", label: STUDIO_PRO_COPY.cards.testnet.title },
  { key: "workflow", label: STUDIO_PRO_COPY.cards.workflow.title },
  { key: "validation", label: STUDIO_PRO_COPY.cards.validation.title },
  { key: "legal", label: STUDIO_PRO_COPY.services.legal.title },
  { key: "development", label: STUDIO_PRO_COPY.services.development.title },
  { key: "discovery", label: STUDIO_PRO_COPY.services.discovery.title },
  { key: "content", label: STUDIO_PRO_COPY.services.content.title },
  { key: "fundraising", label: STUDIO_PRO_COPY.services.fundraising.title },
  { key: "operations", label: STUDIO_PRO_COPY.services.operations.title },
] as const;

export type SolutionKey = (typeof STUDIO_PRO_SOLUTIONS)[number]["key"];

export const SOLUTION_KEYS = STUDIO_PRO_SOLUTIONS.map((s) => s.key) as [SolutionKey, ...SolutionKey[]];

export function solutionLabel(key: SolutionKey): string {
  return STUDIO_PRO_SOLUTIONS.find((s) => s.key === key)?.label ?? key;
}

/** The contact modal, opened from Pro Services, Contact us and every Ask about this. */
export const CONTACT_COPY = {
  kicker: "Bespoke Solutions",
  optional: "(optional)",
  solutionsLabel: "How can we help?",
  solutionsPlaceholder: "Pick one or more",
  solutionsCount: (n: number) => `${n} selected`,
  /** meet.canhav.com shows the Google Calendar appointment schedule below on a canhav address. */
  bookingUrl: "https://meet.canhav.com",
  /** The schedule's embed URL (gv=true is Google's embed mode). The invite and Meet link go out by email on booking. */
  bookingEmbedUrl:
    "https://calendar.google.com/calendar/appointments/schedules/AcZssZ1ZOzTURzo3nsTBJlRHJ-3b8_ChbPqR4SPBfGctUKPCqZK6Ite3d9MbMKaSTORT01a-QzRA_TCE?gv=true",
  bookingLabel: "Let's talk it through!",
  bookingCta: "Book a discovery call",
  commentsLabel: "Comments",
  commentsPlaceholder: "Anything else we should know?",
} as const;
