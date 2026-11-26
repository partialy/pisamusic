import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@heroui/react";
import { ChevronLeft } from "lucide-react";
import {
  hasNativeHeaderBar,
  requestHostBackOrClose,
  syncInitialSafeAreaFromBridge,
} from "../utils/hostBridge";

type H5HeaderLayoutProps = {
  title: string;
  subtitle?: string;
  headerRight?: ReactNode;
  /** 可选随滚动吸顶/嵌入进磨砂 Header 的组件（如药丸 SearchField / Tabs） */
  stickySlot?: ReactNode | ((stuck: boolean) => ReactNode);
  children: ReactNode;
};

const TOP_BAR_HEIGHT = 48;

export default function H5HeaderLayout({
  title,
  subtitle,
  headerRight,
  stickySlot,
  children,
}: H5HeaderLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [nativeHeader, setNativeHeader] = useState<boolean>(() => hasNativeHeaderBar());
  const [isDark, setIsDark] = useState<boolean>(() =>
    typeof document !== "undefined" ? document.documentElement.classList.contains("dark") : false,
  );
  const [scrollY, setScrollY] = useState(0);
  const [isStuck, setIsStuck] = useState(false);
  const stickySentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    syncInitialSafeAreaFromBridge();
    setNativeHeader(hasNativeHeaderBar());
    const onSafeArea = () => setNativeHeader(hasNativeHeaderBar());
    window.addEventListener("pmSafeAreaChanged", onSafeArea);
    return () => window.removeEventListener("pmSafeAreaChanged", onSafeArea);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const syncDark = () => {
      setIsDark(document.documentElement.classList.contains("dark"));
    };
    syncDark();
    window.addEventListener("pmThemeChanged", syncDark);
    const observer = new MutationObserver(syncDark);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });
    return () => {
      window.removeEventListener("pmThemeChanged", syncDark);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
    setScrollY(0);
    setIsStuck(false);
  }, [location.pathname]);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY || document.documentElement.scrollTop || 0;
      setScrollY(y);
      if (stickySentinelRef.current) {
        const rect = stickySentinelRef.current.getBoundingClientRect();
        const headerBottom = getSafeTopPx() + TOP_BAR_HEIGHT;
        setIsStuck(rect.top <= headerBottom + 2);
      }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const headerOpacity = Math.min(1, Math.max(0, scrollY / 44));
  const titleOpacity = Math.min(1, Math.max(0, (scrollY - 20) / 28));
  const canRouterBack = location.key !== "default" && window.history.length > 1;
  const frostedActive = headerOpacity > 0.04 || isStuck;

  // 使用纯 RGBA 插值替代 color-mix，确保各版本 WebView 均能流畅渲染透明->磨砂渐变
  const glassRgb = isDark ? "23, 25, 29" : "254, 254, 254";
  const borderRgb = isDark ? "46, 51, 61" : "230, 232, 236";
  const currentAlpha = isStuck ? 0.86 : Number((headerOpacity * 0.86).toFixed(3));
  const headerBgColor = currentAlpha > 0 ? `rgba(${glassRgb}, ${currentAlpha})` : "transparent";
  const headerBorder =
    !stickySlot && headerOpacity > 0.15
      ? `1px solid rgba(${borderRgb}, ${Number((headerOpacity * 0.9).toFixed(3))})`
      : "1px solid transparent";

  const handleBack = () => {
    requestHostBackOrClose(canRouterBack, () => navigate(-1));
  };

  return (
    <div className="min-h-dvh w-full overflow-x-clip bg-background text-foreground">
      {/* 顶部固定磨砂 HeaderBar：初始透明，下划逐渐显露并在吸顶区合并 */}
      <header
        className="fixed inset-x-0 top-0 z-40 transition-colors duration-200"
        style={{
          paddingTop: "max(env(safe-area-inset-top, 0px), var(--status-bar-height, 0px))",
          backgroundColor: headerBgColor,
          backdropFilter: frostedActive ? "blur(20px) saturate(180%)" : "none",
          WebkitBackdropFilter: frostedActive ? "blur(20px) saturate(180%)" : "none",
          borderBottom: headerBorder,
        }}
      >
        <div
          className="mx-auto flex max-w-xl items-center justify-between gap-2 px-3"
          style={{ height: `${TOP_BAR_HEIGHT}px` }}
        >
          <div className="flex min-w-0 items-center gap-1">
            {!nativeHeader ? (
              <Button
                isIconOnly
                size="sm"
                variant="ghost"
                aria-label="返回"
                onPress={handleBack}
                className="h-9 w-9 shrink-0 rounded-full text-foreground"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
            ) : (
              <div className="w-1" aria-hidden />
            )}
            <span
              className="truncate text-[16px] font-semibold tracking-tight text-foreground transition-opacity duration-150"
              style={{ opacity: nativeHeader ? Math.max(0.92, titleOpacity) : titleOpacity }}
            >
              {title}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-1">{headerRight}</div>
        </div>
      </header>

      {/* 主内容：避让状态栏与 Header 高度，直铺 App 风格排版 */}
      <main
        className="mx-auto w-full max-w-xl overflow-x-clip pb-8 h5-safe-bottom"
        style={{
          paddingTop: `calc(max(env(safe-area-inset-top, 0px), var(--status-bar-height, 0px)) + ${TOP_BAR_HEIGHT + 4}px)`,
        }}
      >
        <section className="px-4 pb-2.5 pt-1">
          <h1
            className="text-[22px] leading-tight font-bold tracking-tight text-foreground transition-opacity duration-150"
            style={{ opacity: Math.max(0, 1 - titleOpacity * 0.85) }}
          >
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-1 text-[13px] leading-relaxed text-muted">{subtitle}</p>
          ) : null}
        </section>

        {stickySlot ? (
          <>
            <div ref={stickySentinelRef} className="h-px w-full" aria-hidden />
            <div
              className="sticky z-30 px-4 transition-all duration-200"
              style={{
                top: `calc(max(env(safe-area-inset-top, 0px), var(--status-bar-height, 0px)) + ${TOP_BAR_HEIGHT}px)`,
                paddingTop: isStuck ? "4px" : "2px",
                paddingBottom: isStuck ? "10px" : "10px",
                backgroundColor: isStuck ? `rgba(${glassRgb}, 0.86)` : "transparent",
                backdropFilter: isStuck ? "blur(20px) saturate(180%)" : "none",
                WebkitBackdropFilter: isStuck ? "blur(20px) saturate(180%)" : "none",
                borderBottom: isStuck ? `1px solid rgba(${borderRgb}, 0.9)` : "1px solid transparent",
              }}
            >
              {typeof stickySlot === "function" ? stickySlot(isStuck) : stickySlot}
            </div>
          </>
        ) : null}

        <div className="w-full min-w-0 space-y-6 px-4 pt-1">{children}</div>
      </main>
    </div>
  );
}

function getSafeTopPx(): number {
  if (typeof document === "undefined") return 0;
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--status-bar-height").trim();
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}
