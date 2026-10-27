import type { useUser } from "@clerk/nextjs";

/** The signed-in user object from useUser(), for components that take it as a prop. */
export type ClerkUser = NonNullable<ReturnType<typeof useUser>["user"]>;
