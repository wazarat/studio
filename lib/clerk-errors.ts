import { isClerkAPIResponseError } from "@clerk/nextjs/errors";

/** Plain-language copy for the Clerk error codes the onboarding steps can hit. */
const COPY: Record<string, string> = {
  form_identifier_exists: "That is already taken.",
  form_param_format_invalid: "That value is not in the right format.",
  form_username_invalid_length: "A username is 3 to 32 characters: letters, numbers and underscores.",
  form_username_invalid_character: "A username is 3 to 32 characters: letters, numbers and underscores.",
  too_many_requests: "Too many attempts. Wait a moment and try again.",
};

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
