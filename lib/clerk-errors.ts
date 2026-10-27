import { isClerkAPIResponseError } from "@clerk/nextjs/errors";

/** Plain-language copy for the Clerk error codes the auth screens can hit. */
const COPY: Record<string, string> = {
  form_identifier_not_found: "No account for this email yet.",
  form_identifier_exists: "There is already an account with this email.",
  form_code_incorrect: "That code is not right. Check the email and try again.",
  verification_expired: "That code has expired. Send a new one.",
  verification_failed: "That code could not be verified. Send a new one.",
  form_param_format_invalid: "Please enter a valid email address.",
  form_username_invalid_length: "Use between 3 and 32 characters.",
  form_username_invalid_character: "Letters, numbers and underscores only.",
  form_password_pwned: "That password has appeared in a data breach.",
  session_exists: "You are already signed in.",
  too_many_requests: "Too many attempts. Wait a moment and try again.",
  web3_wallet_not_found: "No wallet extension was found in this browser.",
};

interface FieldErrorLike {
  code: string;
  message: string;
  longMessage?: string;
}

/** Our copy for a known code, else Clerk's user-facing message. */
export function fieldMessage(err: FieldErrorLike | null | undefined): string | null {
  if (!err) return null;
  return COPY[err.code] ?? err.longMessage ?? err.message;
}

/** The first global (non-field) error as a sentence, or null. */
export function globalMessage(errors: { global: ReadonlyArray<FieldErrorLike> | null } | null | undefined): string | null {
  const first = errors?.global?.[0];
  return first ? fieldMessage(first) : null;
}

export interface ApiErrorInfo {
  code: string;
  param: string | null;
  message: string;
}

/**
 * Thrown errors from UserResource methods (update, setProfileImage,
 * updateMetadata) arrive as ClerkAPIResponseError. Returns the first error's
 * code, the field it names and a sentence to show; null for anything else.
 */
export function apiErrorInfo(err: unknown): ApiErrorInfo | null {
  if (!isClerkAPIResponseError(err)) return null;
  const first = err.errors[0];
  if (!first) return null;
  const meta = (first.meta ?? {}) as { paramName?: string };
  return {
    code: first.code,
    param: meta.paramName ?? null,
    message: COPY[first.code] ?? first.longMessage ?? first.message,
  };
}

/** A sentence for any thrown error, Clerk or not. */
export function errorSentence(err: unknown, fallback: string): string {
  const info = apiErrorInfo(err);
  if (info) return info.message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
