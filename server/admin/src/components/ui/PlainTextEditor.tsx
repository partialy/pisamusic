import { useState } from "react";
import { Input, Segmented, Typography } from "antd";
import { CodeOutlined, EyeOutlined } from "@ant-design/icons";

const { Text } = Typography;

type Props = {
  value: string;
  onChange: (value: string) => void;
  label: string;
};

export function PlainTextEditor({ value, onChange, label }: Props) {
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
          onChange={(next) => setMode(next as "code" | "preview")}
          options={[
            { label: "纯文本编辑", value: "code", icon: <CodeOutlined /> },
            { label: "实时预览", value: "preview", icon: <EyeOutlined /> },
          ]}
        />
      </div>

      {mode === "preview" ? (
        <div className="w-full min-h-[240px] max-h-96 overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-2xs leading-relaxed">
          {value || <span className="text-slate-400">暂无内容</span>}
        </div>
      ) : (
        <Input.TextArea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={12}
          placeholder="请输入纯文本内容，支持换行..."
          className="font-mono text-xs"
        />
      )}
    </div>
  );
}
