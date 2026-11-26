import { useEffect, useState } from "react";

const MEDIA_QUERY = "(prefers-color-scheme: dark)";

function readPrefersDark(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia(MEDIA_QUERY).matches;
}

function syncRootTheme(isDark: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", isDark);
  document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
}

/** 跟随浏览器 `prefers-color-scheme: dark` 并同步根节点的 `.dark` 类。 */
export function usePrefersDark(): boolean {
  const [isDark, setIsDark] = useState<boolean>(() => {
    const initial = readPrefersDark();
    syncRootTheme(initial);
    return initial;
  });

  useEffect(() => {
    syncRootTheme(isDark);
  }, [isDark]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(MEDIA_QUERY);
    const onChange = (e: MediaQueryListEvent) => {
      setIsDark(e.matches);
    };
    setIsDark(mql.matches);
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    }
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, []);

  return isDark;
}
