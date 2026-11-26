import { useEffect, useState } from "react";
import { getHostBridge, readUrlQueryParam } from "./hostBridge";

/** 按 App 桥接 -> URL Query -> 系统偏好的优先级解析是否深色模式。 */
export function resolveAppDarkMode(): boolean {
  try {
    const bridge = getHostBridge();
    if (bridge && typeof bridge.isDarkMode === "function") {
      return Boolean(bridge.isDarkMode());
    }
    const theme = readUrlQueryParam("theme");
    if (theme === "dark") return true;
    if (theme === "light") return false;
  } catch {
    // 忽略桥接异常
  }
  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  return false;
}

export function applyDocumentTheme(isDark: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
  document.documentElement.classList.toggle("dark", isDark);
}

/** 跟随宿主 App 深色模式（支持 AndroidWebHost / PisaDesktopHost 主动注入与 pmThemeChanged 事件同步）。 */
export function useAppTheme(): boolean {
  const [isDark, setIsDark] = useState<boolean>(() => {
    const initial = resolveAppDarkMode();
    applyDocumentTheme(initial);
    return initial;
  });

  useEffect(() => {
    applyDocumentTheme(isDark);
  }, [isDark]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleApply = (dark: boolean) => {
      const next = Boolean(dark);
      applyDocumentTheme(next);
      setIsDark(next);
    };

    window.pmApplyAppTheme = handleApply;

    const onThemeChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ isDark?: boolean; dark?: boolean }>).detail;
      if (detail && typeof detail.isDark === "boolean") {
        handleApply(detail.isDark);
      } else if (detail && typeof detail.dark === "boolean") {
        handleApply(detail.dark);
      } else {
        handleApply(resolveAppDarkMode());
      }
    };

    window.addEventListener("pmThemeChanged", onThemeChanged);
    const onUrlChange = () => handleApply(resolveAppDarkMode());
    window.addEventListener("hashchange", onUrlChange);
    window.addEventListener("popstate", onUrlChange);

    let mql: MediaQueryList | null = null;
    const onMediaChange = () => {
      handleApply(resolveAppDarkMode());
    };
    if (typeof window.matchMedia === "function") {
      mql = window.matchMedia("(prefers-color-scheme: dark)");
      if (typeof mql.addEventListener === "function") {
        mql.addEventListener("change", onMediaChange);
      }
    }

    return () => {
      if (window.pmApplyAppTheme === handleApply) {
        delete window.pmApplyAppTheme;
      }
      window.removeEventListener("pmThemeChanged", onThemeChanged);
      window.removeEventListener("hashchange", onUrlChange);
      window.removeEventListener("popstate", onUrlChange);
      if (mql && typeof mql.removeEventListener === "function") {
        mql.removeEventListener("change", onMediaChange);
      }
    };
  }, []);

  return isDark;
}
