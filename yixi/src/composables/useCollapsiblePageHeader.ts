import { ref } from "vue";

type CollapsiblePageHeaderOptions = {
  collapseThreshold?: number;
  topExpandGuardMs?: number;
};

const DEFAULT_COLLAPSE_THRESHOLD = 8;
const DEFAULT_TOP_EXPAND_GUARD_MS = 520;

function getScrollTop(event: Event) {
  const target = event.target as HTMLElement | null;
  return Math.max(0, target?.scrollTop || 0);
}

export function useCollapsiblePageHeader(options: CollapsiblePageHeaderOptions = {}) {
  const collapseThreshold = options.collapseThreshold ?? DEFAULT_COLLAPSE_THRESHOLD;
  const topExpandGuardMs = options.topExpandGuardMs ?? DEFAULT_TOP_EXPAND_GUARD_MS;
  const isHeaderCollapsed = ref(false);
  let lastScrollTop = 0;
  let collapsedAt = 0;

  function expandHeader() {
    isHeaderCollapsed.value = false;
    lastScrollTop = 0;
  }

  function collapseHeader() {
    if (!isHeaderCollapsed.value) {
      collapsedAt = performance.now();
    }
    isHeaderCollapsed.value = true;
  }

  function canExpandFromTop() {
    return performance.now() - collapsedAt > topExpandGuardMs;
  }

  function handleScrollableContentScroll(event: Event) {
    const scrollTop = getScrollTop(event);
    if (scrollTop > collapseThreshold) {
      collapseHeader();
      lastScrollTop = scrollTop;
      return;
    }

    if (isHeaderCollapsed.value && scrollTop < lastScrollTop && canExpandFromTop()) {
      expandHeader();
      return;
    }

    lastScrollTop = scrollTop;
  }

  function handleScrollableContentTop() {
    if (!isHeaderCollapsed.value || !canExpandFromTop()) return;
    expandHeader();
  }

  function handleScrollableContentWheel(event: WheelEvent) {
    if (!isHeaderCollapsed.value || event.deltaY >= 0 || !canExpandFromTop()) return;
    expandHeader();
  }

  return {
    isHeaderCollapsed,
    expandHeader,
    handleScrollableContentScroll,
    handleScrollableContentTop,
    handleScrollableContentWheel,
  };
}
