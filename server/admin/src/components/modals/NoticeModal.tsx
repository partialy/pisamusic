import { useState } from "react";
import {
  Alert,
  Button,
  Card,
  Input,
  Modal,
  Space,
  Switch,
  Tag,
  Typography,
} from "antd";
import { NotificationOutlined } from "@ant-design/icons";
import type { Announcement, AnnouncementContent, ReleaseConfig } from "../../types/config";
import { AnnouncementDeliveryFields, AnnouncementGotoFields } from "../announcements/AnnouncementDeliveryFields";
import { AnnouncementEditor } from "../ui/AnnouncementEditor";

const { Text } = Typography;

type Props = {
  editing: Announcement;
  isNew: boolean;
  releases: ReleaseConfig;
  saving: boolean;
  error?: string;
  onClose: () => void;
  onChange: (next: Announcement) => void;
  onContentChange: (update: (content: AnnouncementContent) => AnnouncementContent) => void;
  onSave: () => void;
};

export default function NoticeModal({
  editing,
  isNew,
  releases,
  saving,
  error,
  onClose,
  onChange,
  onContentChange,
  onSave,
}: Props) {
  const [uploading, setUploading] = useState(false);
  const busy = saving || uploading;
  return (
    <Modal
      open
      centered
      title={
        <Space>
          <NotificationOutlined className="text-indigo-500" />
          <span className="font-bold text-slate-800">
            {isNew ? "发布新公告" : "编辑公告"}
          </span>
          <Tag>V{editing.announcementVersion ?? 1}</Tag>
          {!isNew && (
            <span className="font-mono text-xs text-slate-400">({editing.id})</span>
          )}
        </Space>
      }
      width={900}
      onCancel={busy ? undefined : onClose}
      closable={!busy}
      maskClosable={!busy}
      keyboard={!busy}
      footer={[
        <Button key="cancel" disabled={busy} onClick={onClose}>
          取消
        </Button>,
        <Button key="save" type="primary" disabled={uploading} loading={saving} onClick={onSave}>
          保存公告
        </Button>,
      ]}
      destroyOnClose
    >
      {error && <Alert className="mb-3" type="error" showIcon message={error} />}
      <fieldset disabled={saving} className="min-w-0 space-y-4 pt-2 max-h-[calc(85vh-120px)] overflow-y-auto pr-1">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              发布人 (Publisher)
            </label>
            <Input
              value={editing.publisher}
              onChange={(e) => onChange({ ...editing, publisher: e.target.value })}
              placeholder="例如: 官方运营团队"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              展示时间 (Time)
            </label>
            <input
              type="datetime-local"
              value={editing.time.replace(" ", "T")}
              onChange={(e) => onChange({ ...editing, time: e.target.value.replace("T", " ") })}
              className="h-8 w-full rounded-md border border-slate-200 bg-white px-3 font-mono text-xs text-slate-800 cursor-pointer"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            确认按钮文案
          </label>
          <Input
            value={editing.confirmText}
            onChange={(e) => onChange({ ...editing, confirmText: e.target.value })}
            placeholder="例如: 知道了 / 我已了解"
          />
        </div>

        <Card size="small" className="bg-slate-50/50 rounded-xl border border-slate-200">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Text strong className="text-xs text-slate-700 block">
                  启用公告
                </Text>
                <span className="text-[11px] text-slate-400">
                  关闭后客户端不会拉取该公告
                </span>
              </div>
              <Switch
                checked={editing.enabled !== false}
                onChange={(val) => onChange({ ...editing, enabled: val })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Text strong className="text-xs text-slate-700 block">
                  每次都展示
                </Text>
                <span className="text-[11px] text-slate-400">
                  开启后不依赖客户端已读状态，每次进入均会弹窗
                </span>
              </div>
              <Switch
                checked={Boolean(editing.showEveryTime)}
                onChange={(val) => onChange({ ...editing, showEveryTime: val })}
              />
            </div>

            <AnnouncementGotoFields announcement={editing} onChange={onChange} />
          </div>
        </Card>

        <AnnouncementDeliveryFields announcement={editing} releases={releases} onChange={onChange} />

        <AnnouncementEditor
          announcementId={editing.id}
          value={editing.content}
          onChange={onContentChange}
          onUploadStateChange={setUploading}
        />
      </fieldset>
    </Modal>
  );
}
