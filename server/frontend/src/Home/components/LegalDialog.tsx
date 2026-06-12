import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { fetchContentPage, type LegalPageKind } from "../../api/content";

interface LegalDialogProps {
  /** 要拉取的内容页类型。 */
  kind: LegalPageKind;
  /** 接口返回标题前的占位标题。 */
  fallbackTitle: string;
  onClose: () => void;
}

export default function LegalDialog({ kind, fallbackTitle, onClose }: LegalDialogProps) {
  const [title, setTitle] = useState(fallbackTitle);
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    fetchContentPage(kind)
      .then((page) => {
        if (!mounted) return;
        if (page.title) setTitle(page.title);
        setHtml(page.content ?? "");
        setLoading(false);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : "内容加载失败，请稍后重试");
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [kind]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="legal-overlay fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 px-4 py-6 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="legal-panel flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/70 bg-white shadow-[0_30px_80px_rgba(16,24,40,0.22)]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-4 border-b border-slate-100 px-6 py-4 sm:px-7">
          <h2 className="font-display text-lg font-bold tracking-tight text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-slate-400 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div className="legal-scroll grow overflow-y-auto px-6 py-5 sm:px-7">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-20 text-sm font-medium text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span>正在加载…</span>
            </div>
          )}
          {!loading && error && (
            <div className="py-20 text-center text-sm font-medium text-rose-500">{error}</div>
          )}
          {!loading && !error && html != null && html.trim() !== "" && (
            <div className="legal-content" dangerouslySetInnerHTML={{ __html: html }} />
          )}
          {!loading && !error && (html == null || html.trim() === "") && (
            <div className="py-20 text-center text-sm font-medium text-slate-400">暂无内容</div>
          )}
        </div>
      </div>
    </div>
  );
}
