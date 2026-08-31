import { useState } from "react";
import {
  Alert,
  Button,
  Card,
  Input,
  Space,
} from "antd";
import { SwapOutlined } from "@ant-design/icons";

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
export default function EndpointDomainReplaceForm({ endpoints, onReplace }: Props) {
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
        message: `已替换全部 ${endpointCount} 个端点的域名，请点击“保存端点”提交。`,
      });
    } catch (error) {
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "域名替换失败",
      });
    }
  };

  return (
    <Card
      size="small"
      title={
        <Space>
          <SwapOutlined className="text-emerald-600" />
          <span className="text-xs font-bold text-slate-700">一键替换所有端点域名</span>
        </Space>
      }
      className="rounded-xl border border-emerald-200 bg-emerald-50/50"
    >
      <div className="space-y-3">
        <p className="text-xs text-slate-500 leading-relaxed">
          支持输入域名或完整 URL；仅替换下方 {endpointCount} 个地址的 Hostname，协议、端口和路径保持不变。
        </p>

        <div className="flex gap-2">
          <Input
            value={domain}
            onChange={(event) => {
              setDomain(event.target.value);
              setFeedback(null);
            }}
            onPressEnter={handleReplace}
            placeholder="例如: gateway.partialy.cn"
            className="font-mono text-xs flex-1"
          />
          <Button
            type="primary"
            disabled={!domain.trim() || endpointCount === 0}
            onClick={handleReplace}
            className="!bg-emerald-600 hover:!bg-emerald-700"
          >
            一键替换
          </Button>
        </div>

        {feedback && (
          <Alert
            type={feedback.type}
            showIcon
            message={feedback.message}
            className="text-xs py-1.5"
          />
        )}
      </div>
    </Card>
  );
}
