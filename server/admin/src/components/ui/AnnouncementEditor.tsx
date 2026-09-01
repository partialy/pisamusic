import { useRef, useState } from "react";
import { Button, Card, ColorPicker, Input, Select, Space, Switch, Tag, Typography, message } from "antd";
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  FileImageOutlined,
  LinkOutlined,
  PlusOutlined,
  CopyOutlined,
  BoldOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { uploadAnnouncementImage } from "../../api/client";
import type {
  AnnouncementAction,
  AnnouncementBlock,
  AnnouncementColor,
  AnnouncementColorPreset,
  AnnouncementContent,
  AnnouncementHighlightBlock,
  AnnouncementTextBlock,
} from "../../types/config";

const { Text } = Typography;

type Props = {
  announcementId: string;
  value: AnnouncementContent;
  onChange: (value: AnnouncementContent) => void;
};

const colors: Array<{ label: string; value: AnnouncementColorPreset; hex: string }> = [
  { label: "中性", value: "neutral", hex: "#475569" },
  { label: "主题", value: "primary", hex: "#4f46e5" },
  { label: "提示", value: "info", hex: "#0284c7" },
  { label: "成功", value: "success", hex: "#059669" },
  { label: "警告", value: "warning", hex: "#d97706" },
  { label: "危险", value: "danger", hex: "#e11d48" },
];

function colorHex(color: AnnouncementColor): string {
  return color.startsWith("#") ? color : colors.find((item) => item.value === color)?.hex ?? "#0284c7";
}

function createTextBlock(): AnnouncementTextBlock {
  return { type: "text", text: "" };
}

function createHighlightBlock(): AnnouncementHighlightBlock {
  return { type: "highlight", color: "info", text: "", action: { type: "none" } };
}

function cloneBlocks(value: AnnouncementContent): AnnouncementBlock[] {
  return value.blocks.map((block) => ({ ...block, ...(block.type === "highlight" ? { action: { ...block.action } } : {}) }));
}

function actionLabel(action: AnnouncementAction): string {
  if (action.type === "none") return "无动作";
  if (action.type === "copy") return "复制";
  if (action.type === "url") return `跳转 URL（${action.openMode === "app" ? "应用内" : "浏览器"}）`;
  return "打开内置协议";
}

function withActionLabel(action: AnnouncementAction, label: string): AnnouncementAction {
  return action.type === "none" ? action : { ...action, label };
}

function withActionValue(action: AnnouncementAction, value: string): AnnouncementAction {
  if (action.type === "copy" || action.type === "protocol") return { ...action, value };
  return action;
}

function withActionUrl(action: AnnouncementAction, url: string): AnnouncementAction {
  return action.type === "url" ? { ...action, url } : action;
}

function withActionOpenMode(action: AnnouncementAction, openMode: "app" | "browser"): AnnouncementAction {
  return action.type === "url" ? { ...action, openMode } : action;
}

export function AnnouncementEditor({ announcementId, value, onChange }: Props) {
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const inputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const updateBlocks = (blocks: AnnouncementBlock[]) => onChange({ schemaVersion: 1, blocks });
  const updateBlock = (index: number, block: AnnouncementBlock) => {
    const blocks = cloneBlocks(value);
    blocks[index] = block;
    updateBlocks(blocks);
  };

  const removeBlock = (index: number) => {
    if (value.blocks.length <= 1) {
      message.warning("公告至少保留一个内容块");
      return;
    }
    updateBlocks(value.blocks.filter((_, current) => current !== index));
  };
  const moveBlock = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= value.blocks.length) return;
    const blocks = cloneBlocks(value);
    [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
    updateBlocks(blocks);
  };

  const addBlock = (block: AnnouncementBlock) => updateBlocks([...cloneBlocks(value), block]);

  const uploadImage = async (index: number, file: File) => {
    setUploadingIndex(index);
    try {
      const uploaded = await uploadAnnouncementImage(file, announcementId, (progress) => {
        const input = inputRefs.current[index];
        if (input) input.dataset.progress = String(progress);
      });
      updateBlock(index, { type: "image", fileId: uploaded.fileId, alt: file.name, url: uploaded.url });
      message.success("公告图片上传成功");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "公告图片上传失败");
    } finally {
      setUploadingIndex(null);
      const input = inputRefs.current[index];
      if (input) input.value = "";
    }
  };

  const updateHighlight = (index: number, changes: Partial<AnnouncementHighlightBlock>) => {
    const current = value.blocks[index];
    if (current?.type !== "highlight") return;
    updateBlock(index, { ...current, ...changes });
  };

  const updateAction = (index: number, action: AnnouncementAction) => updateHighlight(index, { action });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Text strong className="text-xs text-slate-700">公告内容</Text>
          <div className="text-[11px] text-slate-400">仅支持文字、换行、图片和可操作高亮块，不支持 HTML。</div>
        </div>
        <Space size={6} wrap>
          <Button size="small" icon={<PlusOutlined />} onClick={() => addBlock(createTextBlock())}>文字</Button>
          <Button size="small" icon={<FileImageOutlined />} onClick={() => addBlock({ type: "image", fileId: "", alt: "" })}>图片</Button>
          <Button size="small" icon={<ThunderboltOutlined />} onClick={() => addBlock(createHighlightBlock())}>高亮块</Button>
        </Space>
      </div>

      {value.blocks.map((block, index) => (
        <Card key={`${index}-${block.type}`} size="small" className="rounded-xl border-slate-200" title={<Space size={6}><Tag color={block.type === "text" ? "blue" : block.type === "image" ? "purple" : "orange"}>{block.type === "text" ? "文字" : block.type === "image" ? "图片" : "高亮"}</Tag><span className="text-xs text-slate-500">内容块 #{index + 1}</span></Space>} extra={<Space size={2}>
          <Button type="text" size="small" icon={<ArrowUpOutlined />} disabled={index === 0} onClick={() => moveBlock(index, -1)} />
          <Button type="text" size="small" icon={<ArrowDownOutlined />} disabled={index === value.blocks.length - 1} onClick={() => moveBlock(index, 1)} />
          <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeBlock(index)} />
        </Space>}>
          {block.type === "text" && (
              <div className="space-y-2">
                <Input.TextArea rows={4} value={block.text} onChange={(event) => updateBlock(index, { ...block, text: event.target.value })} placeholder="请输入公告文字，直接回车换行；预览中会与高亮内容连续排版" />
                <Space size={8}>
                  <BoldOutlined className="text-slate-500" />
                  <span className="text-xs text-slate-600">加粗</span>
                  <Switch size="small" checked={Boolean(block.bold)} onChange={(bold) => updateBlock(index, { ...block, bold })} />
                </Space>
              </div>
          )}

          {block.type === "image" && (
            <div className="space-y-2">
              {block.url ? <img src={block.url} alt={block.alt || "公告图片"} className="max-h-56 max-w-full rounded-lg border border-slate-200 object-contain" /> : <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-xs text-slate-400">请选择图片上传</div>}
              <Space wrap>
                <Button size="small" loading={uploadingIndex === index} onClick={() => inputRefs.current[index]?.click()}>选择图片</Button>
                <Input size="small" value={block.alt} onChange={(event) => updateBlock(index, { ...block, alt: event.target.value })} placeholder="图片说明（可选）" className="w-56" />
                <input ref={(element) => { inputRefs.current[index] = element; }} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadImage(index, file); }} />
              </Space>
              {block.fileId && <div className="text-[11px] text-slate-400">文件记录：{block.fileId}</div>}
            </div>
          )}

          {block.type === "highlight" && (
            <div className="space-y-2">
              <Input.TextArea rows={2} value={block.text} onChange={(event) => updateHighlight(index, { text: event.target.value })} placeholder="高亮块显示文字，支持换行" />
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <Space.Compact block>
                  <Select className="min-w-28" value={colors.some((item) => item.value === block.color) ? block.color : undefined} placeholder="快捷颜色" options={colors.map(({ label, value }) => ({ label, value }))} onChange={(color: AnnouncementColor) => updateHighlight(index, { color })} />
                  <ColorPicker value={colorHex(block.color)} presets={[{ label: "快捷颜色", colors: colors.map((item) => item.hex) }]} showText onChange={(color) => updateHighlight(index, { color: color.toHexString() })} />
                </Space.Compact>
                <Select value={block.action.type} options={[{ label: "无动作", value: "none" }, { label: "复制", value: "copy" }, { label: "跳转 HTTPS", value: "url" }, { label: "打开内置协议", value: "protocol" }]} onChange={(type: AnnouncementAction["type"]) => {
                  if (type === "none") updateAction(index, { type });
                  if (type === "copy") updateAction(index, { type, label: "复制", value: "" });
                  if (type === "url") updateAction(index, { type, label: "打开", url: "https://", openMode: "app" });
                  if (type === "protocol") updateAction(index, { type, label: "打开", value: "pisamusic://" });
                }} />
              </div>
              {block.action.type !== "none" && <Input value={block.action.label} prefix={block.action.type === "copy" ? <CopyOutlined /> : <LinkOutlined />} onChange={(event) => updateAction(index, withActionLabel(block.action, event.target.value))} placeholder="点击动作显示文本" />}
              {block.action.type === "copy" && <Input.TextArea rows={2} value={block.action.value} onChange={(event) => updateAction(index, withActionValue(block.action, event.target.value))} placeholder="点击后复制的内容" />}
              {block.action.type === "url" && <><Input value={block.action.url} onChange={(event) => updateAction(index, withActionUrl(block.action, event.target.value))} placeholder="仅支持 https://" /><Select value={block.action.openMode} options={[{ label: "应用内打开", value: "app" }, { label: "浏览器打开", value: "browser" }]} onChange={(openMode: "app" | "browser") => updateAction(index, withActionOpenMode(block.action, openMode))} /></>}
              {block.action.type === "protocol" && <Input value={block.action.value} onChange={(event) => updateAction(index, withActionValue(block.action, event.target.value))} placeholder="例如 pisamusic://scan?..." />}
              <div className="text-[11px] text-slate-400">当前动作：{actionLabel(block.action)}</div>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
