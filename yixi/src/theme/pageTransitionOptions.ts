export type PageTransitionStyle =
  | "fade-slide-up"
  | "slide-horizontal"
  | "soft-scale"
  | "none";

export interface PageTransitionOptionMeta {
  value: PageTransitionStyle;
  label: string;
  description: string;
  transitionName: string;
}

export const DEFAULT_PAGE_TRANSITION_STYLE: PageTransitionStyle = "fade-slide-up";

export const PAGE_TRANSITION_OPTIONS: ReadonlyArray<PageTransitionOptionMeta> = [
  {
    value: "fade-slide-up",
    label: "柔滑上浮",
    description: "新页面轻微上移并淡入，旧页面平滑淡出。",
    transitionName: "page-fade-slide-up",
  },
  {
    value: "slide-horizontal",
    label: "横向轻推",
    description: "沿水平方向轻快推入与退场。",
    transitionName: "page-slide-horizontal",
  },
  {
    value: "soft-scale",
    label: "景深微聚",
    description: "柔和缩放聚拢配合透明度渐变。",
    transitionName: "page-soft-scale",
  },
  {
    value: "none",
    label: "关闭",
    description: "关闭主页面与设置页标签切换动画。",
    transitionName: "",
  },
] as const;

const VALID_STYLES = new Set<string>(PAGE_TRANSITION_OPTIONS.map((item) => item.value));

export function normalizePageTransitionStyle(value: unknown): PageTransitionStyle {
  if (typeof value === "string" && VALID_STYLES.has(value)) {
    return value as PageTransitionStyle;
  }
  return DEFAULT_PAGE_TRANSITION_STYLE;
}

export function getPageTransitionMeta(style: unknown): PageTransitionOptionMeta {
  const normalized = normalizePageTransitionStyle(style);
  return (
    PAGE_TRANSITION_OPTIONS.find((item) => item.value === normalized) ??
    PAGE_TRANSITION_OPTIONS[0]
  );
}
