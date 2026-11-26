import { useRef, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Form,
  Image,
  Input,
  Modal,
  Radio,
  Space,
  Tag,
  Typography,
} from "antd";
import {
  CustomerServiceOutlined,
  EditOutlined,
  FileTextOutlined,
  PictureOutlined,
} from "@ant-design/icons";
import { MODAL_BODY_SCROLL_CLASS, MODAL_WIDTH } from "../../constants/theme";
import { ModalTitle } from "../ui/ModalTitle";
import {
  completeCloudMusicAsset,
  removeCloudMusicManualCover,
  reserveCloudMusicAsset,
  saveCloudMusic,
} from "../../api/cloudMusic";
import { uploadFileToQiniu } from "../../api/client";
import type { CloudMusicAdminSaveInput, CloudMusicTrack } from "../../types/cloudMusic";
import CloudMusicLyricsModal from "./CloudMusicLyricsModal";

const { Text } = Typography;

type Props = {
  track: CloudMusicTrack;
  themeColor: string;
  onClose: () => void;
  onSaved: (track: CloudMusicTrack) => void;
};

function formatMsToTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function parseTimeToMs(str: string): number {
  const parts = str.trim().split(":");
  if (parts.length === 2) {
    const m = parseInt(parts[0], 10);
    const s = parseInt(parts[1], 10);
    if (!isNaN(m) && !isNaN(s) && m >= 0 && s >= 0 && s < 60) {
      return (m * 60 + s) * 1000;
    }
  }
  if (parts.length === 3) {
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const s = parseInt(parts[2], 10);
    if (!isNaN(h) && !isNaN(m) && !isNaN(s) && h >= 0 && m >= 0 && m < 60 && s >= 0 && s < 60) {
      return (h * 3600 + m * 60 + s) * 1000;
    }
  }
  const numeric = parseInt(str, 10);
  return !isNaN(numeric) && numeric >= 0 ? numeric : 0;
}

export default function CloudMusicEditModal({
  track: initialTrack,
  onClose,
  onSaved,
}: Props) {
  const coverInputRef = useRef<HTMLInputElement>(null);
  const lyricsInputRef = useRef<HTMLInputElement>(null);
  const [track, setTrack] = useState<CloudMusicTrack>(initialTrack);
  const [title, setTitle] = useState(track.title || "");
  const [artist, setArtist] = useState(track.artist || "");
  const [album, setAlbum] = useState(track.album || "");
  const [durationStr, setDurationStr] = useState(formatMsToTime(track.durationMs));
  const [status, setStatus] = useState<"active" | "disabled" | "offline">(
    track.status === "disabled" ? "disabled" : track.status === "offline" ? "offline" : "active"
  );
  const [statusReason, setStatusReason] = useState(track.statusReason || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [coverUpdating, setCoverUpdating] = useState(false);
  const [lyricsUpdating, setLyricsUpdating] = useState(false);
  const [viewingLyrics, setViewingLyrics] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) {
      setError("歌名不能为空");
      return;
    }
    if (!artist.trim()) {
      setError("歌手不能为空");
      return;
    }
    const durationMs = parseTimeToMs(durationStr);
    if (durationMs <= 0) {
      setError("时长格式不正确 (例如 03:45)");
      return;
    }

    setError("");
    setSaving(true);
    try {
      const payload: CloudMusicAdminSaveInput = {
        title: title.trim(),
        artist: artist.trim(),
        album: album.trim(),
        durationMs,
        status,
        statusReason: statusReason.trim(),
      };
      const updated = await saveCloudMusic(track.uuid, payload);
      onSaved(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
      setSaving(false);
    }
  };

  const handleRemoveCover = async () => {
    if (coverUpdating) return;
    setCoverUpdating(true);
    try {
      const updated = await removeCloudMusicManualCover(track.uuid);
      setTrack(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除手动封面失败");
    } finally {
      setCoverUpdating(false);
    }
  };

  const handleUploadCover = async (file: File) => {
    if (coverUpdating) return;
    setCoverUpdating(true);
    setError("");
    try {
      const ticket = await reserveCloudMusicAsset(track.uuid, file, "cover-uploaded");

      await uploadFileToQiniu(file, {
        uploadToken: ticket.uploadToken,
        uploadUrl: ticket.uploadUrl,
        key: ticket.key,
        bucket: "",
        domain: "",
        cdnDomain: "",
        downloadUrl: "",
        expiresAt: 0,
      });

      const updated = await completeCloudMusicAsset(track.uuid, "cover-uploaded");
      setTrack(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传封面失败");
    } finally {
      setCoverUpdating(false);
    }
  };

  const handleUploadLyrics = async (file: File) => {
    if (lyricsUpdating) return;
    setLyricsUpdating(true);
    setError("");
    try {
      const ticket = await reserveCloudMusicAsset(track.uuid, file, "lyrics");

      await uploadFileToQiniu(file, {
        uploadToken: ticket.uploadToken,
        uploadUrl: ticket.uploadUrl,
        key: ticket.key,
        bucket: "",
        domain: "",
        cdnDomain: "",
        downloadUrl: "",
        expiresAt: 0,
      });

      const updated = await completeCloudMusicAsset(track.uuid, "lyrics");
      setTrack(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传歌词失败");
    } finally {
      setLyricsUpdating(false);
    }
  };

  return (
    <>
    <Modal
      open
      centered
      title={
        <ModalTitle
          icon={<EditOutlined className="text-blue-500" />}
          title="编辑网盘歌曲元数据"
          idText={track.uuid}
        />
      }
      width={MODAL_WIDTH.lg}
      onCancel={onClose}
      onOk={handleSave}
      confirmLoading={saving}
      okText="保存修改"
      cancelText="取消"
      destroyOnClose
    >
      <Form layout="vertical" component={false}>
        <div className={MODAL_BODY_SCROLL_CLASS}>
          {error && <Alert type="error" showIcon message={error} />}

          {/* Basic Metadata */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Form.Item label="歌名 (Title)" required className="!mb-0">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例如: 晴天"
              />
            </Form.Item>

            <Form.Item label="歌手 (Artist)" required className="!mb-0">
              <Input
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                placeholder="例如: 周杰伦"
              />
            </Form.Item>

            <Form.Item label="专辑 (Album)" className="!mb-0">
              <Input
                value={album}
                onChange={(e) => setAlbum(e.target.value)}
                placeholder="例如: 叶惠美"
              />
            </Form.Item>

            <Form.Item label="时长 (Duration)" required className="!mb-0">
              <Input
                value={durationStr}
                onChange={(e) => setDurationStr(e.target.value)}
                placeholder="mm:ss，例如 04:29"
                className="font-mono"
              />
            </Form.Item>
          </div>

          {/* Status & Reason */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
            <Form.Item label="业务可用状态" className="!mb-0">
              <Radio.Group
                value={status}
                optionType="button"
                onChange={(e) => setStatus(e.target.value)}
                className="w-full flex"
              >
                <Radio.Button value="active" className="flex-1 text-center">
                  <span className="text-emerald-700 font-bold">可用 (active)</span>
                </Radio.Button>
                <Radio.Button value="disabled" className="flex-1 text-center">
                  <span className="text-amber-700 font-bold">禁用 (disabled)</span>
                </Radio.Button>
                <Radio.Button value="offline" className="flex-1 text-center">
                  <span className="text-slate-600 font-bold">下架 (offline)</span>
                </Radio.Button>
              </Radio.Group>
            </Form.Item>

            <Form.Item label="状态调整原因说明 (可选)" className="!mb-0">
              <Input
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                placeholder="例如: 版权受限，暂时关闭播放"
              />
            </Form.Item>
          </div>

          {/* Cover Management */}
          <Card size="small" className="bg-slate-50/80 border-slate-200 rounded-xl" title={<span className="text-xs font-bold">封面图片管理</span>}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Image
                  width={56}
                  height={56}
                  src={track.cover?.url}
                  className="rounded-lg object-cover bg-slate-200 shrink-0 border border-slate-300 shadow-2xs"
                  alt={track.title}
                />
                <div>
                  <Tag color={track.cover?.source === "uploaded" ? "purple" : "cyan"}>
                    {track.cover?.source === "uploaded" ? "手动上传封面" : "音频内嵌封面"}
                  </Tag>
                  <Text type="secondary" className="block text-xs mt-1">
                    支持更换为自定义封面图片
                  </Text>
                </div>
              </div>

              <Space>
                {track.cover?.source === "uploaded" && (
                  <Button
                    danger
                    loading={coverUpdating}
                    onClick={handleRemoveCover}
                  >
                    恢复内嵌封面
                  </Button>
                )}
                <Button
                  type="primary"
                  icon={<PictureOutlined />}
                  loading={coverUpdating}
                  onClick={() => coverInputRef.current?.click()}
                >
                  上传新封面
                </Button>
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  disabled={coverUpdating}
                  className="hidden"
                  onChange={(e) => {
                    const file = e.currentTarget.files?.[0];
                    if (file) {
                      void handleUploadCover(file);
                      e.currentTarget.value = "";
                    }
                  }}
                />
              </Space>
            </div>
          </Card>

          {/* Lyrics Management */}
          <Card size="small" className="bg-slate-50/80 border-slate-200 rounded-xl" title={<span className="text-xs font-bold">歌词资产管理</span>}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <CustomerServiceOutlined className="text-emerald-500 text-2xl" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800">
                      {track.lyrics ? `已绑定 ${track.lyrics.format.toUpperCase()} 歌词` : "暂无歌词"}
                    </span>
                    {track.lyrics && <Tag color="success">就绪</Tag>}
                  </div>
                  <Text type="secondary" className="block text-xs mt-1">
                    支持上传 .lrc 同步歌词或 .txt 纯文本歌词
                  </Text>
                </div>
              </div>

              <Space wrap>
                {track.lyrics && (
                  <Button disabled={lyricsUpdating} onClick={() => setViewingLyrics(true)}>
                    查看歌词原文
                  </Button>
                )}
                <Button
                  type="primary"
                  icon={<FileTextOutlined />}
                  loading={lyricsUpdating}
                  onClick={() => lyricsInputRef.current?.click()}
                >
                  {track.lyrics ? "更换歌词" : "上传歌词"}
                </Button>
                <input
                  ref={lyricsInputRef}
                  type="file"
                  accept=".lrc,.txt"
                  disabled={lyricsUpdating}
                  className="hidden"
                  onChange={(e) => {
                    const file = e.currentTarget.files?.[0];
                    if (file) {
                      void handleUploadLyrics(file);
                      e.currentTarget.value = "";
                    }
                  }}
                />
              </Space>
            </div>
          </Card>

          {/* Technical Info */}
          <Descriptions
            bordered
            size="small"
            column={3}
            className="bg-slate-50/50 rounded-xl overflow-hidden"
          >
            <Descriptions.Item label="格式">
              <Tag color="geekblue">{track.format?.toUpperCase() || "-"}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="比特率">
              {track.bitrate ? `${Math.round(track.bitrate / 1000)} kbps` : "-"}
            </Descriptions.Item>
            <Descriptions.Item label="采样率">
              {track.sampleRate ? `${track.sampleRate} Hz` : "-"}
            </Descriptions.Item>
            <Descriptions.Item label="所有者" span={3}>
              {track.owner?.displayName} {track.owner?.userId ? `(ID: ${track.owner.userId})` : ""}
            </Descriptions.Item>
          </Descriptions>
        </div>
      </Form>
    </Modal>
    {viewingLyrics && <CloudMusicLyricsModal uuid={track.uuid} onClose={() => setViewingLyrics(false)} />}
    </>
  );
}
