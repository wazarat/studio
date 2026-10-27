import { cn } from "@/lib/utils";

/** Initials for an account: first letters of the first and last name, else of the username. */
export function initialsOf(user: {
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
}): string {
  const parts = [user.firstName, user.lastName].filter((p): p is string => Boolean(p && p.trim()));
  if (parts.length > 0) return parts.map((p) => p.trim()[0]!.toUpperCase()).join("").slice(0, 2);
  const u = user.username?.trim();
  return u ? u.slice(0, 2).toUpperCase() : "";
}

/**
 * The account picture, or the initials on a neutral ink circle when the
 * account has none (never Clerk's violet default). `hasImage` is Clerk's
 * flag; `src` is the uploaded image or a preview.
 */
export function Avatar({
  src,
  initials,
  size = "md",
  className,
}: {
  src: string | null;
  initials: string;
  size?: "md" | "lg";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-ink-700/60 bg-ink-800 font-display font-semibold text-ink-100",
        size === "lg" ? "h-20 w-20 text-2xl" : "h-9 w-9 text-xs",
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <span aria-hidden>{initials}</span>
      )}
    </span>
  );
}
