import {
  Button,
  Card,
  Input,
  Modal,
  Space,
  Switch,
  Typography,
} from "antd";
import { NotificationOutlined } from "@ant-design/icons";
import type { Announcement } from "../../types/config";
import { AnnouncementEditor } from "../ui/AnnouncementEditor";

const { Text } = Typography;

type Props = {
  editing: Announcement;
  isNew: boolean;
  themeColor: string;
  onClose: () => void;
  onChange: (next: Announcement) => void;
  onSave: () => void;
};

export default function NoticeModal({
  editing,
  isNew,
  themeColor: _,
  onClose,
  onChange,
  onSave,
}: Props) {
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
          {!isNew && (
            <span className="font-mono text-xs text-slate-400">({editing.id})</span>
          )}
        </Space>
      }
      width={900}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button key="save" type="primary" onClick={onSave}>
          保存公告
        </Button>,
      ]}
      destroyOnClose
    >
      <div className="space-y-4 pt-2 max-h-[calc(85vh-120px)] overflow-y-auto pr-1">
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

            <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
              <div>
                <Text strong className="text-xs text-slate-700 block">
                  展示前往外部链接按钮
                </Text>
                <span className="text-[11px] text-slate-400">
                  弹窗额外提供前往跳转按钮
                </span>
              </div>
              <Switch
                checked={editing.showGotoButton}
                onChange={(val) => onChange({ ...editing, showGotoButton: val })}
              />
            </div>

            {editing.showGotoButton && (
              <div className="pt-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  前往跳转地址 (URL)
                </label>
                <Input
                  value={editing.gotoUrl ?? ""}
                  onChange={(e) => onChange({ ...editing, gotoUrl: e.target.value })}
                  placeholder="https://example.com"
                  className="font-mono"
                />
              </div>
            )}
          </div>
        </Card>

        <AnnouncementEditor
          announcementId={editing.id}
          value={editing.content}
          onChange={(content) => onChange({ ...editing, content })}
        />
      </div>
    </Modal>
  );
}
