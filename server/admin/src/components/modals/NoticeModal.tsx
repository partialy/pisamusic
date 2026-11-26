import { useState } from "react";
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  Modal,
  Switch,
  Tag,
  Typography,
} from "antd";
import { NotificationOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { MODAL_BODY_SCROLL_CLASS, MODAL_WIDTH } from "../../constants/theme";
import { ModalTitle } from "../ui/ModalTitle";
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
  const parsedTime = editing.time ? dayjs(editing.time) : null;
  const datePickerValue = parsedTime && parsedTime.isValid() ? parsedTime : null;

  return (
    <Modal
      open
      centered
      title={
        <ModalTitle
          icon={<NotificationOutlined className="text-indigo-500" />}
          title={isNew ? "发布新公告" : "编辑公告"}
          extra={<Tag className="!mr-0">V{editing.announcementVersion ?? 1}</Tag>}
          idText={!isNew ? editing.id : undefined}
        />
      }
      width={MODAL_WIDTH.xl}
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
      <Form layout="vertical" component={false}>
        <fieldset disabled={saving} className={`min-w-0 ${MODAL_BODY_SCROLL_CLASS}`}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Form.Item label="发布人 (Publisher)" className="!mb-0">
              <Input
                value={editing.publisher}
                onChange={(e) => onChange({ ...editing, publisher: e.target.value })}
                placeholder="例如: 官方运营团队"
              />
            </Form.Item>

            <Form.Item label="展示时间 (Time)" className="!mb-0">
              <DatePicker
                showTime={{ format: "HH:mm" }}
                format="YYYY-MM-DD HH:mm"
                value={datePickerValue}
                onChange={(val) =>
                  onChange({ ...editing, time: val ? val.format("YYYY-MM-DD HH:mm") : "" })
                }
                className="w-full font-mono"
                placeholder="选择展示时间"
              />
            </Form.Item>
          </div>

          <Form.Item label="确认按钮文案" className="!mb-0">
            <Input
              value={editing.confirmText}
              onChange={(e) => onChange({ ...editing, confirmText: e.target.value })}
              placeholder="例如: 知道了 / 我已了解"
            />
          </Form.Item>

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
      </Form>
    </Modal>
  );
}
