import { useState } from "react";
import { glassInputClasses } from "../../constants/theme";

type Props = {
  endpoints: Record<string, string>;
  themeColor: string;
  onReplace: (endpoints: Record<string, string>) => void;
};

type Feedback = {
  type: "success" | "error";
  message: string;
};

function parseHostname(input: string): string {
  const value = input.trim();
  if (!value) throw new Error("请输入要替换的新域名");

  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : `https://${value}`);
    if (!url.hostname || url.username || url.password) throw new Error();
    return url.hostname.toLowerCase();
  } catch {
    throw new Error("域名格式不正确，请输入 gateway.example.com 或完整 URL");
  }
}

function replaceEndpointHostnames(endpoints: Record<string, string>, hostname: string): Record<string, string> {
  return Object.fromEntries(
    Object.entries(endpoints).map(([key, value]) => {
      let endpoint: URL;
      try {
        endpoint = new URL(value);
      } catch {
        throw new Error(`端点 ${key} 不是有效的完整 URL，无法批量替换`);
      }

      if (endpoint.protocol !== "http:" && endpoint.protocol !== "https:") {
        throw new Error(`端点 ${key} 不是 HTTP/HTTPS 地址，无法批量替换`);
      }

      endpoint.hostname = hostname;
      return [key, endpoint.toString()];
    }),
  );
}

/** 批量替换 API 端点域名，只改 hostname，保留各地址的协议、端口和路径。 */
export default function EndpointDomainReplaceForm({ endpoints, themeColor, onReplace }: Props) {
  const [domain, setDomain] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const endpointCount = Object.keys(endpoints).length;

  const handleReplace = () => {
    try {
      const hostname = parseHostname(domain);
      const nextEndpoints = replaceEndpointHostnames(endpoints, hostname);
      onReplace(nextEndpoints);
      setDomain(hostname);
      setFeedback({
        type: "success",
        message: `已替换 ${endpointCount} 个端点的域名，请点击“保存端点”提交。`,
      });
    } catch (error) {
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "域名替换失败",
      });
    }
  };

  return (
    <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/60 p-4 shadow-sm">
      <div className="mb-3">
        <p className="text-sm font-bold text-slate-800">一键替换端点域名</p>
        <p className="mt-1 text-xs font-medium leading-5 text-slate-500">
          支持输入域名或完整 URL；仅替换下方 {endpointCount} 个地址的域名，协议、端口和路径保持不变。
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={domain}
          onChange={(event) => {
            setDomain(event.target.value);
            setFeedback(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") handleReplace();
          }}
          className={`${glassInputClasses} font-mono text-[13px]`}
          placeholder="gateway.partialy.cn"
          aria-label="新端点域名"
        />
        <button
          type="button"
          onClick={handleReplace}
          disabled={!domain.trim() || endpointCount === 0}
          style={domain.trim() && endpointCount > 0 ? { backgroundColor: themeColor } : undefined}
          className="shrink-0 rounded-2xl px-5 py-3 text-sm font-bold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:brightness-95 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none disabled:hover:translate-y-0"
        >
          一键替换
        </button>
      </div>
      {feedback ? (
        <p
          className={`mt-3 text-xs font-semibold ${feedback.type === "success" ? "text-emerald-700" : "text-rose-600"}`}
          role={feedback.type === "error" ? "alert" : "status"}
        >
          {feedback.message}
        </p>
      ) : null}
    </div>
  );
}
