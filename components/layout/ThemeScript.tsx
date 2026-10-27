import { THEME_STORAGE_KEY } from "@/lib/theme-constants";

/**
 * Runs before first paint inside the app shell so nobody sees the wrong
 * theme flash. A stored choice wins; otherwise dark. Tiny and dependency
 * free on purpose; lib/theme.ts owns the same rule for React.
 */
const SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t!=="light")t="dark";var cl=document.documentElement.classList;cl.remove("dark","light");cl.add(t);document.documentElement.style.colorScheme=t;}catch(e){}})();`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}
