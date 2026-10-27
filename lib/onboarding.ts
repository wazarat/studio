/**
 * What Studio stores on a Clerk user beyond name, handle and avatar: one
 * `studio` key in `unsafeMetadata`. Shared by the sign-up card (product
 * updates), the onboarding steps and the server gate.
 */
export const STUDIO_META_KEY = "studio";

export const ROLE_OPTIONS = [
  { value: "solo", label: "Solo builder" },
  { value: "founder", label: "Founder in a team" },
  { value: "developer", label: "Developer at a company" },
  { value: "agency", label: "Agency or client work" },
  { value: "researcher", label: "Researcher" },
  { value: "other", label: "Other" },
] as const;

export const EXPERIENCE_OPTIONS = [
  { value: "new", label: "New to Solidity" },
  { value: "testnet", label: "Built on testnet" },
  { value: "mainnet", label: "Shipped to mainnet" },
] as const;

export const IDE_OPTIONS = [
  { value: "claude-code", label: "Claude Code" },
  { value: "cursor", label: "Cursor" },
  { value: "windsurf", label: "Windsurf" },
  { value: "codex", label: "Codex" },
  { value: "other", label: "Other" },
  { value: "none", label: "None" },
] as const;

export type Role = (typeof ROLE_OPTIONS)[number]["value"];
export type Experience = (typeof EXPERIENCE_OPTIONS)[number]["value"];
export type Ide = (typeof IDE_OPTIONS)[number]["value"];

export interface StudioMeta {
  productUpdates?: boolean;
  role?: Role;
  roleOther?: string;
  experience?: Experience;
  ide?: Ide;
  /** ISO time the account finished the sign-up steps. The onboarding gate. */
  onboardedAt?: string;
}

const ROLES = new Set<string>(ROLE_OPTIONS.map((o) => o.value));
const EXPERIENCES = new Set<string>(EXPERIENCE_OPTIONS.map((o) => o.value));
const IDES = new Set<string>(IDE_OPTIONS.map((o) => o.value));

/** Reads the `studio` key off any unsafeMetadata value, tolerating junk. */
export function readStudioMeta(unsafeMetadata: unknown): StudioMeta {
  const raw = (unsafeMetadata as { [STUDIO_META_KEY]?: unknown } | null | undefined)?.[STUDIO_META_KEY];
  if (!raw || typeof raw !== "object") return {};
  const m = raw as Record<string, unknown>;
  const meta: StudioMeta = {};
  if (typeof m.productUpdates === "boolean") meta.productUpdates = m.productUpdates;
  if (typeof m.role === "string" && ROLES.has(m.role)) meta.role = m.role as Role;
  if (typeof m.roleOther === "string") meta.roleOther = m.roleOther;
  if (typeof m.experience === "string" && EXPERIENCES.has(m.experience)) meta.experience = m.experience as Experience;
  if (typeof m.ide === "string" && IDES.has(m.ide)) meta.ide = m.ide as Ide;
  if (typeof m.onboardedAt === "string") meta.onboardedAt = m.onboardedAt;
  return meta;
}

export function isOnboarded(meta: StudioMeta): boolean {
  return Boolean(meta.onboardedAt);
}

export const NAME_MAX = 60;
export const HANDLE_MIN = 3;
export const HANDLE_MAX = 32;
export const ROLE_OTHER_MAX = 80;

const HANDLE_RE = /^[a-z0-9_]+$/;

/** First problem with a first or last name, or null. */
export function validateName(value: string, what: "First name" | "Last name"): string | null {
  const v = value.trim();
  if (!v) return `${what} is required.`;
  if (v.length > NAME_MAX) return `${what} is too long (${NAME_MAX} characters at most).`;
  return null;
}

/** Lowercases and checks a public handle. First problem or null. */
export function validateHandle(value: string): string | null {
  const v = value.trim().toLowerCase();
  if (!v) return "A handle is required.";
  if (v.length < HANDLE_MIN) return `Use at least ${HANDLE_MIN} characters.`;
  if (v.length > HANDLE_MAX) return `Use at most ${HANDLE_MAX} characters.`;
  if (!HANDLE_RE.test(v)) return "Letters, numbers and underscores only.";
  return null;
}

export function normalizeHandle(value: string): string {
  return value.trim().toLowerCase();
}
