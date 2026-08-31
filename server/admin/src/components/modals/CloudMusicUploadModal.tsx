import { useState } from "react";
import {
  Alert,
  Button,
  Card,
  Modal,
  Progress,
  Space,
  Tag,
  Typography,
} from "antd";
import {
  CustomerServiceOutlined,
  FileTextOutlined,
  PictureOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { createCloudMusicUploadSession, uploadCloudMusicSession } from "../../api/cloudMusic";
import type { CloudMusicTrack } from "../../types/cloudMusic";

const { Text } = Typography;

type Props = {
  themeColor: string;
  onClose: () => void;
  onSuccess: (track: CloudMusicTrack) => void;
};

export default function CloudMusicUploadModal({ onClose, onSuccess }: Props) {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [lyricsFile, setLyricsFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [phase, setPhase] = useState<"reserving" | "audio" | "cover" | "lyrics" | "processing" | "">("");
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState("");

  const handleStartUpload = async () => {
    if (!audioFile) {
      setError("请选择音频文件");
      return;
    }
    setError("");
    setUploading(true);
    setPhase("reserving");
    setPercent(0);

    try {
      const session = await createCloudMusicUploadSession({
        audio: audioFile,
        cover: coverFile || undefined,
        lyrics: lyricsFile || undefined,
      });

      const track = await uploadCloudMusicSession(
        session,
        {
          audio: audioFile,
          cover: coverFile || undefined,
          lyrics: lyricsFile || undefined,
        },
        (progress) => {
          setPhase(progress.phase);
          setPercent(progress.percent);
        }
      );

      onSuccess(track);
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
      setUploading(false);
      setPhase("");
    }
  };

  const getPhaseText = () => {
    switch (phase) {
      case "reserving":
        return "正在创建上传会话...";
      case "audio":
        return `正在上传音频文件 (${percent}%)...`;
      case "cover":
        return `正在上传封面图片 (${percent}%)...`;
      case "lyrics":
        return `正在上传歌词文件 (${percent}%)...`;
      case "processing":
        return "正在解析音频元数据与提取封面...";
      default:
        return "";
    }
  };

  return (
    <Modal
      open
      centered
      title={
        <Space align="center" size={8}>
          <UploadOutlined className="text-blue-500 text-lg" />
          <span className="text-base font-bold text-slate-800">上传网盘音乐</span>
        </Space>
      }
      width={640}
      onCancel={uploading ? undefined : onClose}
      footer={[
        <Button key="close" disabled={uploading} onClick={onClose}>
          取消
        </Button>,
        <Button
          key="upload"
          type="primary"
          loading={uploading}
          disabled={!audioFile}
          onClick={handleStartUpload}
        >
          {uploading ? "正在处理中..." : "开始上传"}
        </Button>,
      ]}
      destroyOnClose
    >
      <div className="space-y-4 pt-2 max-h-[calc(85vh-120px)] overflow-y-auto pr-1">
        {error && <Alert type="error" showIcon message={error} />}

        {/* Audio File Selection */}
        <Card size="small" className="bg-slate-50/80 border-slate-200 rounded-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CustomerServiceOutlined className="text-blue-500 text-xl" />
              <div>
                <div className="flex items-center gap-2">
                  <Text strong className="text-xs text-slate-800">
                    音频文件
                  </Text>
                  <Tag color="error" className="!mr-0 text-[10px]">
                    必需
                  </Tag>
                </div>
                <Text type="secondary" className="block text-[11px]">
                  {audioFile ? audioFile.name : "支持 MP3, FLAC, M4A, OGG, WAV 等主流格式"}
                </Text>
              </div>
            </div>

            <label className="relative cursor-pointer rounded-lg bg-blue-500 hover:bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-2xs transition-all">
              {audioFile ? "重新选择" : "选择音频"}
              <input
                type="file"
                accept="audio/*,.mp3,.flac,.m4a,.ogg,.wav,.aac,.ape,.opus"
                disabled={uploading}
                className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                onChange={(e) => {
                  const file = e.currentTarget.files?.[0];
                  if (file) {
                    setAudioFile(file);
                    setError("");
                  }
                }}
              />
            </label>
          </div>
        </Card>

        {/* Cover File Selection */}
        <Card size="small" className="bg-slate-50/80 border-slate-200 rounded-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <PictureOutlined className="text-purple-500 text-xl" />
              <div>
                <div className="flex items-center gap-2">
                  <Text strong className="text-xs text-slate-800">
                    封面图片
                  </Text>
                  <Tag color="default" className="!mr-0 text-[10px]">
                    可选
                  </Tag>
                </div>
                <Text type="secondary" className="block text-[11px]">
                  {coverFile ? coverFile.name : "留空将自动从音频 ID3 标签提取内嵌封面"}
                </Text>
              </div>
            </div>

            <label className="relative cursor-pointer rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-1.5 text-xs font-bold shadow-2xs transition-all">
              {coverFile ? "重新选择" : "选择图片"}
              <input
                type="file"
                accept="image/*,.jpg,.jpeg,.png,.webp"
                disabled={uploading}
                className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                onChange={(e) => {
                  const file = e.currentTarget.files?.[0];
                  if (file) setCoverFile(file);
                }}
              />
            </label>
          </div>
        </Card>

        {/* Lyrics File Selection */}
        <Card size="small" className="bg-slate-50/80 border-slate-200 rounded-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileTextOutlined className="text-emerald-500 text-xl" />
              <div>
                <div className="flex items-center gap-2">
                  <Text strong className="text-xs text-slate-800">
                    歌词文件
                  </Text>
                  <Tag color="default" className="!mr-0 text-[10px]">
                    可选
                  </Tag>
                </div>
                <Text type="secondary" className="block text-[11px]">
                  {lyricsFile ? lyricsFile.name : "支持 .lrc 或 .txt 格式同步歌词"}
                </Text>
              </div>
            </div>

            <label className="relative cursor-pointer rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-1.5 text-xs font-bold shadow-2xs transition-all">
              {lyricsFile ? "重新选择" : "选择歌词"}
              <input
                type="file"
                accept=".lrc,.txt"
                disabled={uploading}
                className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                onChange={(e) => {
                  const file = e.currentTarget.files?.[0];
                  if (file) setLyricsFile(file);
                }}
              />
            </label>
          </div>
        </Card>

        {/* Upload progress indicator */}
        {uploading && (
          <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-blue-800">
              <span>{getPhaseText()}</span>
              <span>{percent}%</span>
            </div>
            <Progress
              percent={percent}
              status={phase === "processing" ? "active" : undefined}
              size="small"
            />
          </div>
        )}
      </div>
    </Modal>
  );
}
