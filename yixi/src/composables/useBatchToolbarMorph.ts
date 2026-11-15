import { nextTick, onBeforeUnmount, watch, type Ref } from "vue";

type PillSnapshot = {
  rect: DOMRect;
  background: string;
  border: string;
  color: string;
  content?: HTMLElement;
};

const DURATION = 380;
const EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

/** 只变形装饰背景；真实按钮保持原尺寸和原有业务生命周期。 */
export function useBatchToolbarMorph(active: Readonly<Ref<boolean>>, target: Readonly<Ref<HTMLElement | null>>) {
  let origin: PillSnapshot | null = null;
  let generation = 0;
  let entered = false;
  let exitFrom: PillSnapshot | null = null;
  let lastGroup: PillSnapshot | null = null;
  let observer: MutationObserver | undefined;
  let observedScope: HTMLElement | null = null;
  let overlay: HTMLElement | null = null;
  const animations = new Set<Animation>();
  const restorers = new Set<() => void>();

  const scope = () => target.value?.parentElement || null;
  const group = () => target.value?.querySelector<HTMLElement>(".batch-segmented-actions")
    || scope()?.querySelector<HTMLElement>(".batch-segmented-actions") || null;
  const trigger = () => scope()?.querySelector<HTMLElement>("[data-batch-trigger]") || null;
  const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function snapshot(element: HTMLElement, copyContent = false): PillSnapshot | null {
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height || !element.isConnected) return null;
    const style = getComputedStyle(element);
    const content = copyContent ? element.cloneNode(true) as HTMLElement : undefined;
    if (content && element.matches(".batch-segmented-actions")) {
      // 装饰快照保留退出项的悬停文案宽度，避免移除真实节点后立即收起。
      const originals = element.querySelectorAll<HTMLElement>(".batch-segment, .batch-segment-label");
      const copies = content.querySelectorAll<HTMLElement>(".batch-segment, .batch-segment-label");
      originals.forEach((original, index) => {
        const copy = copies[index];
        const computed = getComputedStyle(original);
        copy.style.transition = "none";
        if (original.matches(".batch-segment")) copy.style.flex = `0 0 ${original.getBoundingClientRect().width}px`;
        else Object.assign(copy.style, { gridTemplateColumns: computed.gridTemplateColumns, marginLeft: computed.marginLeft, opacity: computed.opacity });
      });
    }
    return {
      rect, background: style.backgroundColor, border: style.borderColor, color: style.color,
      content,
    };
  }

  function cleanup() {
    observer?.disconnect();
    observer = undefined;
    observedScope = null;
    animations.forEach(animation => animation.cancel());
    animations.clear();
    restorers.forEach(restore => restore());
    restorers.clear();
    overlay?.remove();
    overlay = null;
  }

  function reset() {
    generation++;
    cleanup();
    origin = null;
    entered = false;
    exitFrom = null;
    lastGroup = null;
  }

  function animate(element: HTMLElement, keyframes: Keyframe[], options: KeyframeAnimationOptions) {
    const animation = element.animate(keyframes, { fill: "both", ...options });
    animations.add(animation);
    // 所有装饰动画由 cleanup 取消；取消属于正常的切换/卸载流程。
    void animation.finished.catch(() => undefined);
    return animation;
  }

  function decorateContent(pill: HTMLElement, content: HTMLElement, entering: boolean) {
    content.removeAttribute("id");
    content.setAttribute("aria-hidden", "true");
    content.inert = true;
    Object.assign(content.style, {
      position: "absolute", inset: "0", width: "100%", height: "100%", margin: "0",
      background: "transparent", borderColor: "transparent", boxShadow: "none", pointerEvents: "none",
    });
    pill.appendChild(content);
    animate(content, [{ opacity: entering ? 1 : 0 }, { opacity: entering ? 0 : 1 }], {
      duration: entering ? 100 : 120, delay: entering ? 0 : DURATION - 120, easing: "ease",
    });
  }

  async function morph(from: PillSnapshot, to: PillSnapshot, destination: HTMLElement, entering: boolean, token: number) {
    if (reducedMotion() || token !== generation || !destination.isConnected) return;
    const pill = document.createElement("div");
    pill.setAttribute("aria-hidden", "true");
    Object.assign(pill.style, {
      position: "fixed", pointerEvents: "none", zIndex: "1000", boxSizing: "border-box",
      border: "1px solid", borderRadius: "999px", overflow: "hidden", color: from.color,
      left: `${from.rect.left}px`, top: `${from.rect.top}px`, width: `${from.rect.width}px`, height: `${from.rect.height}px`,
      backgroundColor: from.background, borderColor: from.border,
    });
    document.body.appendChild(pill);
    overlay = pill;
    if (from.content) decorateContent(pill, from.content, true);
    if (!entering && to.content) decorateContent(pill, to.content, false);
    const faded = entering
      ? destination.closest<HTMLElement>(".batch-action-bar, .list-toolbar") || destination.parentElement || destination
      : destination;
    const wasInert = faded.inert;
    faded.inert = true;
    let restored = false;
    const restore = () => {
      if (restored) return;
      restored = true;
      faded.inert = wasInert;
      restorers.delete(restore);
    };
    restorers.add(restore);
    const reveal = animate(faded, [{ opacity: 0 }, { opacity: 1 }], {
      duration: 140, delay: DURATION - 140, easing: "ease",
    });
    const shape = animate(pill, [
      { left: `${from.rect.left}px`, top: `${from.rect.top}px`, width: `${from.rect.width}px`, height: `${from.rect.height}px`, backgroundColor: from.background, borderColor: from.border },
      { left: `${to.rect.left}px`, top: `${to.rect.top}px`, width: `${to.rect.width}px`, height: `${to.rect.height}px`, backgroundColor: to.background, borderColor: to.border },
    ], { duration: entering ? DURATION : DURATION - 80, delay: entering ? 0 : 80, easing: EASING });
    animate(pill, [{ opacity: 1 }, { opacity: 0 }], { duration: 100, delay: DURATION - 100, easing: "ease" });
    try {
      await Promise.all([shape.finished, reveal.finished]);
    } catch { /* 快速切换或离开页面时直接恢复真实 UI。 */ }
    finally {
      restore();
      if (token === generation) cleanup();
    }
  }

  async function enter(token: number) {
    await nextTick();
    if (token !== generation || !active.value || entered || !origin) return;
    const destination = group();
    const next = destination ? snapshot(destination) : null;
    if (!destination || !next) {
      const container = scope();
      if (container && container !== observedScope) {
        observer?.disconnect();
        observedScope = container;
        observer = new MutationObserver(() => { void enter(token); });
        observer.observe(container, { childList: true, subtree: true });
      }
      return;
    }
    entered = true;
    lastGroup = snapshot(destination, true);
    observer?.disconnect();
    void morph(origin, next, destination, true, token);
  }

  function captureOrigin(event?: MouseEvent) {
    const element = event?.currentTarget instanceof HTMLElement ? event.currentTarget : trigger();
    origin = element ? snapshot(element, true) : null;
  }

  watch(active, (value) => {
    const source = !value ? group() : null;
    exitFrom = !value ? (source ? snapshot(source, true) : null) || lastGroup : null;
    generation++;
    cleanup();
    entered = false;
  }, { flush: "sync" });

  // 同步阶段只保留旧组；等父子组件均完成更新后再读取恢复的入口按钮。
  // sync watcher 内的 nextTick 可能早于本次 render 入队，导致找不到按钮而漏掉退出动画。
  watch(active, (value) => {
    const token = generation;
    if (value) {
      if (!origin || reducedMotion()) return;
      void enter(token);
    } else if (exitFrom && origin && !reducedMotion()) {
      const previous = exitFrom;
      void nextTick(() => {
        if (token !== generation || active.value) return;
        const destination = trigger();
        const next = destination ? snapshot(destination, true) : null;
        if (destination && next) void morph(previous, next, destination, false, token);
      });
    }
  }, { flush: "post" });
  watch(target, () => { if (active.value && !entered && origin) void enter(generation); }, { flush: "post" });
  onBeforeUnmount(reset);
  return { captureOrigin, reset };
}
