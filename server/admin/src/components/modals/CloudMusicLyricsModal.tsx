import { useEffect, useState } from "react";
import { Alert, Button, Input, Modal, Space, Spin, Tag, Typography } from "antd";
import { FileTextOutlined } from "@ant-design/icons";
import { MODAL_BODY_SCROLL_CLASS, MODAL_WIDTH } from "../../constants/theme";
import { ModalTitle } from "../ui/ModalTitle";
import { fetchCloudMusicLyricsText } from "../../api/cloudMusic";
import type { CloudMusicLyricsText } from "../../types/cloudMusic";
import { detectLyricsFormat } from "../../utils/cloudMusicLyrics";

export default function CloudMusicLyricsModal({ uuid, onClose }: { uuid: string; onClose: () => void }) {
  const [data, setData] = useState<CloudMusicLyricsText | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setData(null);
    fetchCloudMusicLyricsText(uuid).then((result) => {
      if (active) setData(result);
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : "读取歌词原文失败");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [uuid, attempt]);
  const timed = data && (detectLyricsFormat(data.text) === "lrc" || /^\s*\[\d+,\d+\][<(]\d+,\d+,\d+[>)]/m.test(data.text));
  return (
    <Modal
      open
      centered
      destroyOnClose
      title={<ModalTitle icon={<FileTextOutlined className="text-emerald-500" />} title="歌词原文" idText={uuid} />}
      width={MODAL_WIDTH.lg}
      onCancel={onClose}
      footer={[<Button key="close" type="primary" onClick={onClose}>关闭</Button>]}
    >
      <div className={MODAL_BODY_SCROLL_CLASS}>
        {loading && <div className="py-8 text-center"><Spin tip="读取歌词原文..." /></div>}
        {error && <Alert type="error" showIcon message={error} action={<Button size="small" onClick={() => setAttempt((value) => value + 1)}>重试</Button>} />}
        {data && <Space direction="vertical" className="w-full" size={12}>
          <Space wrap>
            <Typography.Text>{data.fileName}</Typography.Text>
            <Tag color={timed ? "green" : "default"}>{timed ? "同步歌词" : "纯文本 · 无时间轴"}</Tag>
            <Typography.Text copyable={{ text: data.text }}>复制原文</Typography.Text>
          </Space>
          {!timed && <Alert type="info" showIcon message="当前文件没有可识别的时间轴，保留纯文本展示。" />}
          <Input.TextArea aria-label="歌词原文（只读）" readOnly value={data.text} rows={18} className="font-mono text-xs" />
        </Space>}
      </div>
    </Modal>
  );
}
