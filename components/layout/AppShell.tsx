import { AppHeader } from "@/components/layout/AppHeader";
import { AppShellProvider } from "@/components/layout/AppShellContext";
import { AppTheme } from "@/components/layout/AppTheme";
import { ThemeScript } from "@/components/layout/ThemeScript";

/**
 * The signed-in frame: the app header and a flat page surface. No
 * marketing footer and no background gradient; the wrapper paints the
 * plain ink-950 canvas over the body's glows.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AppShellProvider>
      <ThemeScript />
      <AppTheme />
      <div className="relative flex min-h-screen flex-col bg-ink-950">
        <AppHeader />
        <main className="flex-1">{children}</main>
      </div>
    </AppShellProvider>
  );
}
