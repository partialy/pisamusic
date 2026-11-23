import { nextTick, onActivated, onDeactivated, type Ref } from "vue";

/**
 * 在 KeepAlive 失活与重新激活时保存并恢复自定义局部滚动容器的 scrollTop，
 * 避免组件 DOM 移出文档流后浏览器将滚动位置清零。
 */
export function useKeepAliveScroll(containerRef: Ref<HTMLElement | null>) {
  let savedScrollTop = 0;

  onDeactivated(() => {
    savedScrollTop = containerRef.value?.scrollTop ?? 0;
  });

  onActivated(() => {
    const targetScrollTop = savedScrollTop;
    if (targetScrollTop <= 0) return;

    void nextTick(() => {
      requestAnimationFrame(() => {
        if (containerRef.value) {
          containerRef.value.scrollTop = targetScrollTop;
        }
      });
    });
  });
}
