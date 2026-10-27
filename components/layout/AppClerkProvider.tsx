import { ClerkProvider } from "@clerk/nextjs";

import { isAuthConfigured } from "@/lib/auth";
import { LOGIN_PATH, STUDIO_PATH, WELCOME_PATH } from "@/lib/auth-paths";

/**
 * Site-wide ClerkProvider so the nav can reflect signed-in state everywhere.
 * The provider throws without a publishable key, so an unconfigured deploy
 * renders bare children and auth-aware UI falls back to its signed-out look.
 * Dark only: the variables are the ones canhav.dev's dark theme shipped with.
 */
const DARK_APPEARANCE = {
  variables: {
    colorBackground: "#0B0E14",
    colorInput: "#0B0E14",
    colorForeground: "#E6E8EC",
    colorMutedForeground: "#9BA1AE",
    colorPrimary: "#3D7BFF",
    colorInputForeground: "#E6E8EC",
    borderRadius: "0.75rem",
  },
};

export function AppClerkProvider({ children }: { children: React.ReactNode }) {
  if (!isAuthConfigured()) return <>{children}</>;
  return (
    <ClerkProvider
      signInUrl={LOGIN_PATH}
      signUpUrl={LOGIN_PATH}
      signInFallbackRedirectUrl={STUDIO_PATH}
      signUpFallbackRedirectUrl={WELCOME_PATH}
      afterSignOutUrl="/"
      appearance={DARK_APPEARANCE}
    >
      {children}
    </ClerkProvider>
  );
}
