import { useState } from "react";
import { Input, Segmented, Typography } from "antd";
import { CodeOutlined, EyeOutlined } from "@ant-design/icons";

const { Text } = Typography;

type Props = {
  value: string;
  onChange: (v: string) => void;
  label: string;
  themeColor: string;
};

export function HtmlEditor({ value, onChange, label }: Props) {
  const [mode, setMode] = useState<"code" | "preview">("code");

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Text strong className="text-xs text-slate-700">
          {label}
        </Text>
        <Segmented
          size="small"
          value={mode}
          onChange={(val) => setMode(val as "code" | "preview")}
          options={[
            { label: "HTML 源码", value: "code", icon: <CodeOutlined /> },
            { label: "实时预览", value: "preview", icon: <EyeOutlined /> },
          ]}
        />
      </div>

      {mode === "preview" ? (
        <div
          className="w-full min-h-[160px] max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-700 shadow-2xs leading-relaxed"
          dangerouslySetInnerHTML={{
            __html: value || '<span class="text-slate-400">暂无内容</span>',
          }}
        />
      ) : (
        <Input.TextArea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={6}
          placeholder="请输入 HTML 内容..."
          className="font-mono text-xs"
        />
      )}
    </div>
  );
}
