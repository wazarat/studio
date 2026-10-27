"use client";

import { createContext, useContext, useEffect, useState } from "react";

/**
 * What a page inside the app shell can add to the header breadcrumb: for
 * now the project name, once project pages exist. `useProjectCrumb(name)`
 * from a page sets it while that page is mounted.
 */
const Ctx = createContext<{ project: string | null; setProject: (name: string | null) => void } | null>(null);

export function AppShellProvider({ children }: { children: React.ReactNode }) {
  const [project, setProject] = useState<string | null>(null);
  return <Ctx.Provider value={{ project, setProject }}>{children}</Ctx.Provider>;
}

export function useProjectCrumb(name: string | null) {
  const ctx = useContext(Ctx);
  useEffect(() => {
    ctx?.setProject(name);
    return () => ctx?.setProject(null);
  }, [ctx, name]);
}

export function useAppShell() {
  return useContext(Ctx);
}
