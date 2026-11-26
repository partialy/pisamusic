import { useMemo, useRef, useState } from "react";
import {
  Alert,
  Avatar,
  Button,
  Card,
  Empty,
  Form,
  Image,
  Input,
  Popover,
  Radio,
  Select,
  Space,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  CheckCircleFilled,
  DeleteOutlined,
  ExclamationCircleFilled,
  FileTextOutlined,
  PictureOutlined,
  PlusOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import type { CloudMusicBatchDraftItem } from "../../types/cloudMusic";
import { detectLyricsFormat } from "../../utils/cloudMusicLyrics";
import { parseDurationStrToMs } from "../../utils/cloudMusicAudioParser";

const { Text } = Typography;

type Props = {
  items: CloudMusicBatchDraftItem[];
  selectedId: string;
  onSelectId: (id: string) => void;
  onUpdateItem: (id: string, updater: (prev: CloudMusicBatchDraftItem) => CloudMusicBatchDraftItem) => void;
  onUpdateAll: (updater: (prev: CloudMusicBatchDraftItem) => CloudMusicBatchDraftItem) => void;
  onRemoveItem: (id: string) => void;
  onAppendFiles: (files: File[]) => void;
  parsingMore: boolean;
};

function formatFileSize(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return "-";
  const mb = size / 1024 / 1024;
  if (mb >= 1) return `${mb.toFixed(mb >= 10 ? 1 : 2)} MB`;
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

export function isDraftItemValid(item: CloudMusicBatchDraftItem): boolean {
  return Boolean(item.title.trim() && item.artist.trim() && item.durationMs > 0);
}

function coverSourceTag(source: CloudMusicBatchDraftItem["coverSource"]) {
  switch (source) {
    case "embedded":
      return <Tag color="cyan">音频内嵌封面</Tag>;
    case "matched":
      return <Tag color="blue">同名配对封面</Tag>;
    case "manual":
      return <Tag color="purple">手动选择封面</Tag>;
    default:
      return <Tag color="default">默认封面 (未设置)</Tag>;
  }
}

function lyricsSourceTag(source: CloudMusicBatchDraftItem["lyricsSource"], hasText: boolean) {
  if (!hasText) return <Tag color="default">暂无歌词</Tag>;
  switch (source) {
    case "embedded":
      return <Tag color="cyan">音频内嵌歌词</Tag>;
    case "matched":
      return <Tag color="blue">同名配对歌词</Tag>;
    case "manual":
      return <Tag color="purple">手动上传/编辑</Tag>;
    default:
      return <Tag color="green">已设置歌词</Tag>;
  }
}

export default function CloudMusicBatchEditorStep({
  items,
  selectedId,
  onSelectId,
  onUpdateItem,
  onUpdateAll,
  onRemoveItem,
  onAppendFiles,
  parsingMore,
}: Props) {
  const appendInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const lyricsInputRef = useRef<HTMLInputElement>(null);
  const [batchArtist, setBatchArtist] = useState("");
  const [batchAlbum, setBatchAlbum] = useState("");
  const [batchStatus, setBatchStatus] = useState<"active" | "disabled" | "offline">("active");

  const currentItem = useMemo(
    () => items.find((item) => item.id === selectedId) ?? items[0] ?? null,
    [items, selectedId],
  );

  const handleCoverFileSelect = (file: File) => {
    if (!currentItem) return;
    const previewUrl = URL.createObjectURL(file);
    onUpdateItem(currentItem.id, (prev) => {
      if (prev.coverPreviewUrl) {
        URL.revokeObjectURL(prev.coverPreviewUrl);
      }
      return {
        ...prev,
        coverFile: file,
        coverPreviewUrl: previewUrl,
        coverSource: "manual",
      };
    });
  };

  const handleClearCover = () => {
    if (!currentItem) return;
    onUpdateItem(currentItem.id, (prev) => {
      if (prev.coverPreviewUrl) {
        URL.revokeObjectURL(prev.coverPreviewUrl);
      }
      return {
        ...prev,
        coverFile: null,
        coverPreviewUrl: null,
        coverSource: "none",
      };
    });
  };

  const handleLyricsFileSelect = async (file: File) => {
    if (!currentItem) return;
    try {
      const text = (await file.text()).replace(/^\uFEFF/, "").trim();
      const ext = detectLyricsFormat(text);
      onUpdateItem(currentItem.id, (prev) => ({
        ...prev,
        lyricsText: text,
        lyricsFormat: ext,
        lyricsFileName: file.name,
        lyricsSource: "manual",
      }));
    } catch {
      // 忽略读取异常
    }
  };

  const batchPopoverContent = (
    <div className="w-80 space-y-3 p-1">
      <div className="text-xs font-bold text-slate-700">
        一键填充至当前列表全部 {items.length} 首曲目
      </div>
      <div>
        <label className="block text-[11px] text-slate-500 mb-1">统一歌手名称</label>
        <Space.Compact className="w-full">
          <Input
            size="small"
            placeholder="输入歌手名..."
            value={batchArtist}
            onChange={(e) => setBatchArtist(e.target.value)}
          />
          <Button
            size="small"
            type="primary"
            disabled={!batchArtist.trim()}
            onClick={() => {
              const val = batchArtist.trim();
              if (!val) return;
              onUpdateAll((prev) => ({ ...prev, artist: val }));
            }}
          >
            应用
          </Button>
        </Space.Compact>
      </div>

      <div>
        <label className="block text-[11px] text-slate-500 mb-1">统一专辑名称</label>
        <Space.Compact className="w-full">
          <Input
            size="small"
            placeholder="输入专辑名..."
            value={batchAlbum}
            onChange={(e) => setBatchAlbum(e.target.value)}
          />
          <Button
            size="small"
            type="primary"
            disabled={!batchAlbum.trim()}
            onClick={() => {
              const val = batchAlbum.trim();
              onUpdateAll((prev) => ({ ...prev, album: val }));
            }}
          >
            应用
          </Button>
        </Space.Compact>
      </div>

      <div>
        <label className="block text-[11px] text-slate-500 mb-1">统一发布状态</label>
        <Space.Compact className="w-full">
          <Select
            size="small"
            value={batchStatus}
            onChange={(val) => setBatchStatus(val)}
            className="flex-1"
            options={[
              { label: "可用 (active)", value: "active" },
              { label: "禁用 (disabled)", value: "disabled" },
              { label: "下架 (offline)", value: "offline" },
            ]}
          />
          <Button
            size="small"
            type="primary"
            onClick={() => {
              onUpdateAll((prev) => ({ ...prev, status: batchStatus }));
            }}
          >
            应用
          </Button>
        </Space.Compact>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Top Batch Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/90 px-3.5 py-2.5">
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <span className="font-bold text-slate-800">
            已解析 {items.length} 首曲目
          </span>
          <span className="text-slate-300">|</span>
          <span>点击左侧曲目可逐项微调封面、歌词与元数据</span>
        </div>

        <Space size={8}>
          <Popover
            content={batchPopoverContent}
            trigger="click"
            placement="bottomRight"
          >
            <Button icon={<ThunderboltOutlined />}>
              批量填充歌手/专辑/状态
            </Button>
          </Popover>

          <Button
            type="primary"
            ghost
            icon={<PlusOutlined />}
            loading={parsingMore}
            onClick={() => appendInputRef.current?.click()}
          >
            {parsingMore ? "解析中..." : "继续添加文件"}
          </Button>
          <input
            ref={appendInputRef}
            type="file"
            multiple
            disabled={parsingMore}
            accept="audio/*,.mp3,.flac,.m4a,.ogg,.wav,.aac,.ape,.opus,image/*,.jpg,.jpeg,.png,.webp,.lrc,.txt"
            className="hidden"
            onChange={(e) => {
              const fileList = e.currentTarget.files;
              if (fileList && fileList.length > 0) {
                onAppendFiles(Array.from(fileList));
                e.currentTarget.value = "";
              }
            }}
          />
        </Space>
      </div>

      {/* Master-Detail Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[470px] max-h-[calc(85vh-220px)]">
        {/* Left List */}
        <div className="lg:col-span-4 flex flex-col rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-200/80 bg-white/80 flex items-center justify-between text-xs font-bold text-slate-700">
            <span>待上传列表 ({items.length})</span>
            <span className="text-[11px] font-normal text-slate-400">
              有效 {items.filter(isDraftItemValid).length}/{items.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-200/60">
            {items.map((item, index) => {
              const active = currentItem?.id === item.id;
              const valid = isDraftItemValid(item);
              const hasLyrics = Boolean(item.lyricsText.trim());
              return (
                <div
                  key={item.id}
                  onClick={() => onSelectId(item.id)}
                  className={`group flex items-center gap-2.5 px-3 py-2.5 cursor-pointer transition-colors ${
                    active
                      ? "bg-blue-50/90 border-l-4 border-l-blue-500"
                      : "hover:bg-white/80 border-l-4 border-l-transparent"
                  }`}
                >
                  <span className="text-[11px] font-mono text-slate-400 w-4 shrink-0">
                    {index + 1}
                  </span>

                  {item.coverPreviewUrl ? (
                    <img
                      src={item.coverPreviewUrl}
                      alt={item.title}
                      className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0 bg-slate-100"
                    />
                  ) : (
                    <Avatar
                      shape="square"
                      size={40}
                      icon={<PictureOutlined />}
                      className="bg-slate-200/70 text-slate-400 rounded-lg shrink-0"
                    />
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <Text
                        strong
                        ellipsis
                        className={`text-xs block ${active ? "text-blue-700" : "text-slate-800"}`}
                      >
                        {item.title || "未填写歌名"}
                      </Text>
                      {valid ? (
                        <CheckCircleFilled className="text-emerald-500 text-xs shrink-0" />
                      ) : (
                        <Tooltip title="歌名、歌手或时长未填写完整">
                          <ExclamationCircleFilled className="text-red-500 text-xs shrink-0" />
                        </Tooltip>
                      )}
                    </div>

                    <Text type="secondary" ellipsis className="text-[11px] block text-slate-500">
                      {item.artist || "未填写歌手"} · {item.durationStr || "00:00"}
                    </Text>

                    <div className="flex items-center gap-1 mt-1">
                      {item.coverFile && (
                        <span className="inline-block rounded bg-purple-100 px-1.5 py-0.5 text-[10px] text-purple-700 font-medium">
                          封面
                        </span>
                      )}
                      {hasLyrics && (
                        <span className="inline-block rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-700 font-medium">
                          {item.lyricsFormat.toUpperCase()}歌词
                        </span>
                      )}
                      {item.status !== "active" && (
                        <span className="inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700 font-medium">
                          {item.status}
                        </span>
                      )}
                    </div>
                  </div>

                  <Tooltip title="从列表中移除">
                    <Button
                      type="text"
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      className="opacity-60 group-hover:opacity-100 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveItem(item.id);
                      }}
                    />
                  </Tooltip>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Detail Editor */}
        <div className="lg:col-span-8 rounded-xl border border-slate-200 bg-white p-4 overflow-y-auto space-y-4">
          {!currentItem ? (
            <Empty description="请在左侧选择一首曲目" className="py-16" />
          ) : (
            <>
              {/* Audio File Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div className="min-w-0">
                  <Text strong className="text-xs text-slate-700 block truncate" title={currentItem.audioFile.name}>
                    原文件：{currentItem.audioFile.name}
                  </Text>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <Tag color="geekblue" className="!mr-0 text-[10px] font-mono">
                      {(currentItem.specs.format || "AUDIO").toUpperCase()}
                    </Tag>
                    <Tag className="!mr-0 text-[10px] font-mono">
                      {formatFileSize(currentItem.audioFile.size)}
                    </Tag>
                    {currentItem.specs.bitrate ? (
                      <Tag className="!mr-0 text-[10px] font-mono">
                        {Math.round(currentItem.specs.bitrate / 1000)} kbps
                      </Tag>
                    ) : null}
                    {currentItem.specs.sampleRate ? (
                      <Tag className="!mr-0 text-[10px] font-mono">
                        {currentItem.specs.sampleRate} Hz
                      </Tag>
                    ) : null}
                  </div>
                </div>
              </div>

              {currentItem.parseWarning && (
                <Alert
                  type="warning"
                  showIcon
                  message={currentItem.parseWarning}
                  className="text-xs py-1.5"
                />
              )}

              {/* Metadata Form Fields */}
              <Form layout="vertical" component={false}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Form.Item label="歌名 (Title)" required className="!mb-0">
                    <Input
                      value={currentItem.title}
                      status={!currentItem.title.trim() ? "error" : undefined}
                      placeholder="请输入歌名"
                      onChange={(e) => {
                        const val = e.target.value;
                        onUpdateItem(currentItem.id, (prev) => ({ ...prev, title: val }));
                      }}
                    />
                  </Form.Item>

                  <Form.Item label="歌手 (Artist)" required className="!mb-0">
                    <Input
                      value={currentItem.artist}
                      status={!currentItem.artist.trim() ? "error" : undefined}
                      placeholder="请输入歌手"
                      onChange={(e) => {
                        const val = e.target.value;
                        onUpdateItem(currentItem.id, (prev) => ({ ...prev, artist: val }));
                      }}
                    />
                  </Form.Item>

                  <Form.Item label="专辑 (Album)" className="!mb-0">
                    <Input
                      value={currentItem.album}
                      placeholder="选填，例如：叶惠美"
                      onChange={(e) => {
                        const val = e.target.value;
                        onUpdateItem(currentItem.id, (prev) => ({ ...prev, album: val }));
                      }}
                    />
                  </Form.Item>

                  <Form.Item label="时长 (mm:ss)" required className="!mb-0">
                    <Input
                      value={currentItem.durationStr}
                      status={currentItem.durationMs <= 0 ? "error" : undefined}
                      placeholder="例如 04:29"
                      className="font-mono"
                      onChange={(e) => {
                        const str = e.target.value;
                        const ms = parseDurationStrToMs(str);
                        onUpdateItem(currentItem.id, (prev) => ({
                          ...prev,
                          durationStr: str,
                          durationMs: ms,
                        }));
                      }}
                    />
                  </Form.Item>

                  <Form.Item label="入库后状态" className="!mb-0">
                    <Radio.Group
                      value={currentItem.status}
                      optionType="button"
                      onChange={(e) => {
                        const val = e.target.value;
                        onUpdateItem(currentItem.id, (prev) => ({ ...prev, status: val }));
                      }}
                    >
                      <Radio.Button value="active">可用 (active)</Radio.Button>
                      <Radio.Button value="disabled">禁用 (disabled)</Radio.Button>
                      <Radio.Button value="offline">下架 (offline)</Radio.Button>
                    </Radio.Group>
                  </Form.Item>

                  <Form.Item label="状态备注说明 (可选)" className="!mb-0">
                    <Input
                      value={currentItem.statusReason}
                      placeholder="选填状态原因"
                      onChange={(e) => {
                        const val = e.target.value;
                        onUpdateItem(currentItem.id, (prev) => ({ ...prev, statusReason: val }));
                      }}
                    />
                  </Form.Item>
                </div>
              </Form>

              {/* Cover Setting */}
              <Card
                size="small"
                className="bg-slate-50/70 border-slate-200 rounded-xl"
                title={<span className="text-xs font-bold text-slate-700">封面设置</span>}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {currentItem.coverPreviewUrl ? (
                      <Image
                        width={56}
                        height={56}
                        src={currentItem.coverPreviewUrl}
                        className="rounded-lg object-cover border border-slate-300 shadow-2xs"
                        alt={currentItem.title}
                      />
                    ) : (
                      <Avatar
                        shape="square"
                        size={56}
                        icon={<PictureOutlined />}
                        className="bg-slate-200/80 text-slate-400 rounded-lg"
                      />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        {coverSourceTag(currentItem.coverSource)}
                      </div>
                      <Text type="secondary" className="block text-[11px] mt-1">
                        {currentItem.coverFile
                          ? `${currentItem.coverFile.name} (${formatFileSize(currentItem.coverFile.size)})`
                          : "未设置封面时，客户端将展示默认云盘音乐封面"}
                      </Text>
                    </div>
                  </div>

                  <Space size={8}>
                    {currentItem.coverFile && (
                      <Button danger onClick={handleClearCover}>
                        清除封面
                      </Button>
                    )}
                    <Button
                      type="primary"
                      icon={<PictureOutlined />}
                      onClick={() => coverInputRef.current?.click()}
                    >
                      {currentItem.coverFile ? "更换封面" : "选择图片"}
                    </Button>
                    <input
                      ref={coverInputRef}
                      type="file"
                      accept="image/*,.jpg,.jpeg,.png,.webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.currentTarget.files?.[0];
                        if (file) {
                          handleCoverFileSelect(file);
                          e.currentTarget.value = "";
                        }
                      }}
                    />
                  </Space>
                </div>
              </Card>

              {/* Lyrics Setting */}
              <Card
                size="small"
                className="bg-slate-50/70 border-slate-200 rounded-xl"
                title={
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-700">歌词设置</span>
                      {lyricsSourceTag(currentItem.lyricsSource, Boolean(currentItem.lyricsText.trim()))}
                    </div>
                    <Space size={8}>
                      <Tag color={detectLyricsFormat(currentItem.lyricsText) === "lrc" ? "green" : "default"}>
                        {detectLyricsFormat(currentItem.lyricsText) === "lrc" ? "同步歌词 · LRC" : "纯文本 · 无时间轴"}
                      </Tag>

                      {currentItem.lyricsText.trim() && (
                        <Button
                          danger
                          onClick={() => {
                            onUpdateItem(currentItem.id, (prev) => ({
                              ...prev,
                              lyricsText: "",
                              lyricsSource: "none",
                            }));
                          }}
                        >
                          清空歌词
                        </Button>
                      )}

                      <Button
                        type="primary"
                        icon={<FileTextOutlined />}
                        onClick={() => lyricsInputRef.current?.click()}
                      >
                        导入歌词文件
                      </Button>
                      <input
                        ref={lyricsInputRef}
                        type="file"
                        accept=".lrc,.txt"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.currentTarget.files?.[0];
                          if (file) {
                            void handleLyricsFileSelect(file);
                            e.currentTarget.value = "";
                          }
                        }}
                      />
                    </Space>
                  </div>
                }
              >
                {currentItem.lyricsText.trim() && detectLyricsFormat(currentItem.lyricsText) === "txt" && (
                  <Alert type="info" showIcon message="原歌词没有时间轴，将按纯文本保存；不会自动生成时间戳。" className="mb-2" />
                )}
                <Input.TextArea
                  rows={5}
                  value={currentItem.lyricsText}
                  placeholder="已自动读取音频内嵌歌词；也可在此直接粘贴或编辑 LRC / TXT 歌词内容..."
                  className="font-mono text-xs"
                  onChange={(e) => {
                    const text = e.target.value;
                    onUpdateItem(currentItem.id, (prev) => ({
                      ...prev,
                      lyricsText: text,
                      lyricsFormat: detectLyricsFormat(text),
                      lyricsSource: text.trim()
                        ? prev.lyricsSource === "none"
                          ? "manual"
                          : prev.lyricsSource
                        : "none",
                    }));
                  }}
                />
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
