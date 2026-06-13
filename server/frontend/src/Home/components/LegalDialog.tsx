import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, RotateCw } from "lucide-react";
import { fetchContentPage, type LegalPageKind } from "../../api/content";
import { Win } from "../../utils/win-native";

interface LegalDialogProps {
  /** 要拉取的内容页类型。 */
  kind: LegalPageKind;
  /** 接口返回标题前的占位标题。 */
  fallbackTitle: string;
  /** 每次点击入口都递增，用于重复点击时重新聚焦和请求。 */
  requestId: number;
  onClose: () => void;
}

type WindowRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const NARROW_VIEWPORT_MAX_WIDTH = 680;
const NARROW_VIEWPORT_MARGIN = 8;

function getInitialRect(): WindowRect {
  const narrow = window.innerWidth <= NARROW_VIEWPORT_MAX_WIDTH;
  const margin = narrow ? NARROW_VIEWPORT_MARGIN : 24;
  const width = narrow ? window.innerWidth - margin * 2 : Math.min(760, window.innerWidth - margin * 2);
  const height = narrow ? window.innerHeight - margin * 2 : Math.min(640, window.innerHeight - margin * 2);

  return {
    x: Math.max(margin, (window.innerWidth - width) / 2),
    y: Math.max(margin, (window.innerHeight - height) / 2),
    width,
    height,
  };
}

function updateWindowTitle(nativeWindow: Win, title: string) {
  nativeWindow.options.title = title;
  nativeWindow.container.setAttribute("aria-label", title);
  nativeWindow.container.querySelectorAll<HTMLElement>(".win-native-title").forEach((element) => {
    element.innerText = title;
  });
}

function configureWindowControls(nativeWindow: Win) {
  const buttons = nativeWindow.header.querySelectorAll<HTMLButtonElement>(".win-btn");
  const labels = ["最小化", "最大化", "关闭"];

  buttons.forEach((button, index) => {
    const label = labels[index];
    if (!label) return;
    button.title = label;
    button.setAttribute("aria-label", label);
  });

  return buttons.item(1);
}

export default function LegalDialog({
  kind,
  fallbackTitle,
  requestId,
  onClose,
}: LegalDialogProps) {
  const [portalHost, setPortalHost] = useState<HTMLDivElement | null>(null);
  const [title, setTitle] = useState(fallbackTitle);
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryId, setRetryId] = useState(0);
  const nativeWindowRef = useRef<Win | null>(null);
  const onCloseRef = useRef(onClose);

  onCloseRef.current = onClose;

  useEffect(() => {
    const host = document.createElement("div");
    host.className = "legal-window-root";

    const initialRect = getInitialRect();
    const nativeWindow = new Win({
      title: fallbackTitle,
      theme: "win",
      content: host,
      width: initialRect.width,
      height: initialRect.height,
      x: initialRect.x,
      y: initialRect.y,
      minWidth: 360,
      minHeight: 280,
      onClose: () => onCloseRef.current(),
    });

    nativeWindow.container.classList.add("legal-native-window");
    nativeWindow.container.setAttribute("role", "dialog");
    nativeWindow.container.setAttribute("aria-modal", "false");
    nativeWindow.container.setAttribute("aria-label", fallbackTitle);

    const maximizeButton = configureWindowControls(nativeWindow);
    let desktopRect: WindowRect | null = null;
    let narrowMode = false;

    const blockNarrowHeaderInteraction = (event: Event) => {
      if (!narrowMode) return;
      const target = event.target as HTMLElement;
      if (target.closest("button")) return;
      event.stopImmediatePropagation();
    };

    const applyResponsiveLayout = () => {
      const shouldUseNarrowLayout = window.innerWidth <= NARROW_VIEWPORT_MAX_WIDTH;

      if (shouldUseNarrowLayout) {
        if (!narrowMode) {
          desktopRect = {
            x: nativeWindow.x,
            y: nativeWindow.y,
            width: nativeWindow.width,
            height: nativeWindow.height,
          };
          if (nativeWindow.isMaximized) nativeWindow.toggleMaximize();
        }

        narrowMode = true;
        nativeWindow.x = NARROW_VIEWPORT_MARGIN;
        nativeWindow.y = NARROW_VIEWPORT_MARGIN;
        nativeWindow.width = Math.max(0, window.innerWidth - NARROW_VIEWPORT_MARGIN * 2);
        nativeWindow.height = Math.max(0, window.innerHeight - NARROW_VIEWPORT_MARGIN * 2);
        nativeWindow.container.classList.add("legal-native-window-narrow");
        nativeWindow.container.style.left = `${nativeWindow.x}px`;
        nativeWindow.container.style.top = `${nativeWindow.y}px`;
        nativeWindow.container.style.width = `${nativeWindow.width}px`;
        nativeWindow.container.style.height = `${nativeWindow.height}px`;
        nativeWindow.header.style.cursor = "default";
        if (nativeWindow.resizeHandle) nativeWindow.resizeHandle.style.display = "none";
        if (maximizeButton) maximizeButton.style.display = "none";
        return;
      }

      if (!narrowMode) return;
      narrowMode = false;
      const rect = desktopRect ?? getInitialRect();
      nativeWindow.width = Math.max(nativeWindow.options.minWidth, Math.min(rect.width, window.innerWidth - 32));
      nativeWindow.height = Math.max(nativeWindow.options.minHeight, Math.min(rect.height, window.innerHeight - 32));
      nativeWindow.x = Math.max(0, Math.min(rect.x, window.innerWidth - nativeWindow.width));
      nativeWindow.y = Math.max(0, Math.min(rect.y, window.innerHeight - nativeWindow.height));
      nativeWindow.container.classList.remove("legal-native-window-narrow");
      nativeWindow.container.style.left = `${nativeWindow.x}px`;
      nativeWindow.container.style.top = `${nativeWindow.y}px`;
      nativeWindow.container.style.width = `${nativeWindow.width}px`;
      nativeWindow.container.style.height = `${nativeWindow.height}px`;
      nativeWindow.header.style.cursor = "grab";
      if (nativeWindow.resizeHandle) nativeWindow.resizeHandle.style.display = "flex";
      if (maximizeButton) maximizeButton.style.display = "flex";
    };

    nativeWindow.header.addEventListener("pointerdown", blockNarrowHeaderInteraction, true);
    nativeWindow.header.addEventListener("dblclick", blockNarrowHeaderInteraction, true);
    window.addEventListener("resize", applyResponsiveLayout);

    nativeWindowRef.current = nativeWindow;
    setPortalHost(host);
    nativeWindow.show();
    applyResponsiveLayout();

    return () => {
      window.removeEventListener("resize", applyResponsiveLayout);
      nativeWindow.header.removeEventListener("pointerdown", blockNarrowHeaderInteraction, true);
      nativeWindow.header.removeEventListener("dblclick", blockNarrowHeaderInteraction, true);
      setPortalHost(null);
      nativeWindowRef.current = null;

      if (nativeWindow.container.isConnected) {
        nativeWindow.options.onClose = () => {};
        nativeWindow.close();
      }
    };
  }, []);

  useEffect(() => {
    const nativeWindow = nativeWindowRef.current;
    if (!nativeWindow) return;

    if (nativeWindow.isMinimized) nativeWindow.restore();
    nativeWindow.focus();
  }, [kind, requestId]);

  useEffect(() => {
    const nativeWindow = nativeWindowRef.current;
    if (!nativeWindow) return;

    setTitle(fallbackTitle);
    updateWindowTitle(nativeWindow, fallbackTitle);
    setHtml(null);
    setLoading(true);
    setError(null);

    const controller = new AbortController();

    fetchContentPage(kind, controller.signal)
      .then((page) => {
        const nextTitle = page.title || fallbackTitle;
        setTitle(nextTitle);
        updateWindowTitle(nativeWindow, nextTitle);
        setHtml(page.content ?? "");
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : "内容加载失败，请稍后重试");
        setLoading(false);
      });

    return () => controller.abort();
  }, [fallbackTitle, kind, requestId, retryId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const nativeWindow = nativeWindowRef.current;
      if (!nativeWindow || !nativeWindow.container.isConnected) return;
      nativeWindow.close();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (!portalHost) return null;

  return createPortal(
    <div className="legal-window-body" aria-live="polite">
      {loading && (
        <div className="legal-window-state text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          <span>正在加载…</span>
        </div>
      )}

      {!loading && error && (
        <div className="legal-window-state px-6 text-center">
          <p className="m-0 text-sm font-medium text-rose-600">{error}</p>
          <button
            type="button"
            className="legal-retry-button"
            onClick={() => setRetryId((value) => value + 1)}
          >
            <RotateCw className="h-4 w-4" aria-hidden="true" />
            重新加载
          </button>
        </div>
      )}

      {!loading && !error && html != null && html.trim() !== "" && (
        <div
          className="legal-scroll legal-content"
          aria-label={title}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}

      {!loading && !error && (html == null || html.trim() === "") && (
        <div className="legal-window-state text-slate-500">暂无内容</div>
      )}
    </div>,
    portalHost,
  );
}
