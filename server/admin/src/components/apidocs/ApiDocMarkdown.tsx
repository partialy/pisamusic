import { Children, isValidElement, type ReactNode } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button, message } from "antd";
import {
  BulbOutlined,
  CheckOutlined,
  CopyOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { useState } from "react";
import { resolveDocLink, slugifyHeading } from "../../utils/apidocParser";

type ApiDocMarkdownProps = {
  content: string;
  currentDocPath: string;
  onNavigateDoc: (docPath: string, hash?: string) => void;
};

type AlertType = "NOTE" | "TIP" | "IMPORTANT" | "WARNING" | "CAUTION";

const ALERT_STYLES: Record<
  AlertType,
  { label: string; wrapper: string; title: string; icon: ReactNode }
> = {
  NOTE: {
    label: "说明",
    wrapper: "bg-sky-50/75 border-sky-400 text-slate-700",
    title: "text-sky-700",
    icon: <InfoCircleOutlined />,
  },
  TIP: {
    label: "提示",
    wrapper: "bg-emerald-50/75 border-emerald-400 text-slate-700",
    title: "text-emerald-700",
    icon: <BulbOutlined />,
  },
  IMPORTANT: {
    label: "重要",
    wrapper: "bg-indigo-50/75 border-indigo-400 text-slate-700",
    title: "text-indigo-700",
    icon: <ExclamationCircleOutlined />,
  },
  WARNING: {
    label: "注意",
    wrapper: "bg-amber-50/80 border-amber-400 text-slate-700",
    title: "text-amber-700",
    icon: <WarningOutlined />,
  },
  CAUTION: {
    label: "警告",
    wrapper: "bg-rose-50/80 border-rose-400 text-slate-700",
    title: "text-rose-700",
    icon: <WarningOutlined />,
  },
};

function extractPlainText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(extractPlainText).join("");
  }
  if (isValidElement(node)) {
    const props = node.props as { children?: ReactNode };
    return extractPlainText(props.children);
  }
  return "";
}

function CodeBlockCard({ language, codeText }: { language: string; codeText: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeText);
      setCopied(true);
      void message.success("代码已复制");
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      void message.error("复制失败，请手动复制");
    }
  };

  return (
    <div className="my-4 rounded-xl overflow-hidden border border-slate-800/80 bg-slate-900 shadow-sm">
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-slate-800/90 border-b border-slate-700/80 text-xs text-slate-300">
        <span className="font-mono uppercase tracking-wider text-[11px] text-slate-400">
          {language || "text"}
        </span>
        <Button
          type="text"
          size="small"
          icon={copied ? <CheckOutlined className="text-emerald-400" /> : <CopyOutlined />}
          onClick={handleCopy}
          className="!text-slate-300 hover:!text-white !text-xs !h-6"
        >
          {copied ? "已复制" : "复制"}
        </Button>
      </div>
      <pre className="p-3.5 m-0 overflow-x-auto text-[13px] leading-relaxed font-mono text-slate-100">
        <code>{codeText}</code>
      </pre>
    </div>
  );
}

export default function ApiDocMarkdown({
  content,
  currentDocPath,
  onNavigateDoc,
}: ApiDocMarkdownProps) {
  const usedIds = new Map<string, number>();

  const allocateHeadingId = (children: ReactNode, countDuplicate: boolean): string | undefined => {
    const text = extractPlainText(children).trim();
    const baseId = slugifyHeading(text);
    if (!baseId) return undefined;
    if (!countDuplicate) return baseId;
    const count = usedIds.get(baseId) ?? 0;
    usedIds.set(baseId, count + 1);
    return count === 0 ? baseId : `${baseId}-${count}`;
  };

  const components: Components = {
    h1({ children }) {
      const id = allocateHeadingId(children, false);
      return (
        <h1
          id={id}
          className="text-2xl font-extrabold text-slate-900 pb-3 mb-5 border-b border-slate-200 tracking-tight"
        >
          {children}
        </h1>
      );
    },
    h2({ children }) {
      const id = allocateHeadingId(children, true);
      return (
        <h2
          id={id}
          className="group scroll-mt-4 text-lg font-bold text-slate-800 mt-8 mb-3 pb-1.5 border-b border-slate-200/80 flex items-center gap-2"
        >
          <span>{children}</span>
          {id && (
            <a
              href={`#${id}`}
              onClick={(e) => {
                e.preventDefault();
                onNavigateDoc(currentDocPath, id);
              }}
              className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-sky-600 text-sm transition-opacity"
              aria-label="定位到此小节"
            >
              #
            </a>
          )}
        </h2>
      );
    },
    h3({ children }) {
      const id = allocateHeadingId(children, true);
      return (
        <h3
          id={id}
          className="group scroll-mt-4 text-base font-bold text-slate-800 mt-6 mb-2.5 flex items-center gap-1.5"
        >
          <span>{children}</span>
          {id && (
            <a
              href={`#${id}`}
              onClick={(e) => {
                e.preventDefault();
                onNavigateDoc(currentDocPath, id);
              }}
              className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-sky-600 text-xs transition-opacity"
              aria-label="定位到此小节"
            >
              #
            </a>
          )}
        </h3>
      );
    },
    h4({ children }) {
      const id = allocateHeadingId(children, false);
      return (
        <h4 id={id} className="scroll-mt-4 text-sm font-bold text-slate-700 mt-4 mb-2">
          {children}
        </h4>
      );
    },
    p({ children }) {
      return <p className="text-sm text-slate-600 leading-7 my-3">{children}</p>;
    },
    ul({ children }) {
      return <ul className="list-disc pl-5 my-3 space-y-1.5 text-sm text-slate-600">{children}</ul>;
    },
    ol({ children }) {
      return <ol className="list-decimal pl-5 my-3 space-y-1.5 text-sm text-slate-600">{children}</ol>;
    },
    li({ children }) {
      return <li className="leading-6">{children}</li>;
    },
    hr() {
      return <hr className="my-6 border-slate-200/80" />;
    },
    blockquote({ children }) {
      const text = extractPlainText(children).trim();
      const alertMatch = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i.exec(text);
      if (alertMatch) {
        const alertType = alertMatch[1].toUpperCase() as AlertType;
        const style = ALERT_STYLES[alertType];
        const strippedChildren = Children.map(children, (child, idx) => {
          if (idx === 0 && isValidElement(child)) {
            const childProps = child.props as { children?: ReactNode };
            const innerArray = Children.toArray(childProps.children);
            if (typeof innerArray[0] === "string") {
              innerArray[0] = innerArray[0].replace(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i, "");
              return <p className="text-sm leading-6 m-0">{innerArray}</p>;
            }
          }
          return child;
        });

        return (
          <div className={`my-4 rounded-xl border-l-4 px-4 py-3 ${style.wrapper}`}>
            <div className={`flex items-center gap-1.5 text-xs font-bold mb-1 ${style.title}`}>
              {style.icon}
              <span>{style.label}</span>
            </div>
            <div className="text-sm leading-6">{strippedChildren}</div>
          </div>
        );
      }

      return (
        <blockquote className="my-4 border-l-4 border-slate-300 bg-slate-50/90 px-4 py-2.5 rounded-r-xl text-sm text-slate-600">
          {children}
        </blockquote>
      );
    },
    table({ children }) {
      return (
        <div className="my-4 overflow-x-auto rounded-xl border border-slate-200/90 bg-white/90 shadow-2xs">
          <table className="w-full border-collapse text-left text-[13px]">{children}</table>
        </div>
      );
    },
    thead({ children }) {
      return <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">{children}</thead>;
    },
    th({ children }) {
      return <th className="px-3.5 py-2.5 font-semibold whitespace-nowrap">{children}</th>;
    },
    td({ children }) {
      return <td className="px-3.5 py-2.5 border-t border-slate-100 text-slate-600 align-top">{children}</td>;
    },
    pre({ children }) {
      const childArray = Children.toArray(children);
      const codeChild = childArray[0];
      if (isValidElement(codeChild)) {
        const props = codeChild.props as { className?: string; children?: ReactNode };
        const match = /language-([^\s]+)/.exec(props.className ?? "");
        const language = match ? match[1] : "";
        const codeText = extractPlainText(props.children).replace(/\n$/, "");
        return <CodeBlockCard language={language} codeText={codeText} />;
      }
      return (
        <pre className="my-4 p-3.5 rounded-xl bg-slate-900 text-slate-100 overflow-x-auto text-xs">
          {children}
        </pre>
      );
    },
    code({ className, children }) {
      const hasLang = Boolean(className && /language-/.test(className));
      if (hasLang) {
        return <code className={className}>{children}</code>;
      }
      return (
        <code className="px-1.5 py-0.5 mx-0.5 rounded-md bg-slate-100 text-rose-700 font-mono text-[12px] border border-slate-200/70 break-all">
          {children}
        </code>
      );
    },
    a({ href = "", children }) {
      const internalTarget = resolveDocLink(currentDocPath, href);
      if (internalTarget) {
        return (
          <a
            href={`#/api-docs?doc=${encodeURIComponent(internalTarget.docPath)}`}
            onClick={(e) => {
              e.preventDefault();
              onNavigateDoc(internalTarget.docPath, internalTarget.hash);
            }}
            className="text-sky-600 hover:text-sky-700 underline decoration-sky-300 underline-offset-2 font-medium"
          >
            {children}
          </a>
        );
      }
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sky-600 hover:text-sky-700 underline underline-offset-2"
        >
          {children}
        </a>
      );
    },
  };

  return (
    <div className="apidoc-markdown">
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </Markdown>
    </div>
  );
}
