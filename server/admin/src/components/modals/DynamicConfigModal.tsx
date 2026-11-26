import {
  Alert,
  Button,
  Form,
  Input,
  Modal,
  Select,
  Tag,
} from "antd";
import {
  CodeOutlined,
  EyeOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { MODAL_BODY_SCROLL_CLASS, MODAL_WIDTH } from "../../constants/theme";
import { ModalTitle } from "../ui/ModalTitle";
import type { DynamicConfigItem, DynamicConfigType } from "../../types/config";

type Props = {
  editing: DynamicConfigItem;
  isNew: boolean;
  themeColor: string;
  saving: boolean;
  onClose: () => void;
  onChange: (next: DynamicConfigItem) => void;
  onSave: () => void;
};

const TYPE_OPTIONS: Array<{ value: DynamicConfigType; label: string; hint: string }> = [
  { value: "string", label: "字符串 (string)", hint: "通用纯文本配置" },
  { value: "number", label: "数字 (number)", hint: "保存为文本，服务端校验为有限数值" },
  { value: "url", label: "URL 链接 (url)", hint: "仅允许完整的 http/https 链接" },
  { value: "html", label: "HTML 片段 (html)", hint: "富文本片段，支持样式与标签渲染" },
];

export default function DynamicConfigModal({
  editing,
  isNew,
  saving,
  onClose,
  onChange,
  onSave,
}: Props) {
  const selectedTypeOption = TYPE_OPTIONS.find((option) => option.value === editing.type);
  const contentPlaceholder =
    editing.type === "url"
      ? "https://example.com/path"
      : editing.type === "number"
        ? "例如：123 或 3.14"
        : editing.type === "html"
          ? "<div>可插入 HTML 标签与内容</div>"
          : "请输入配置内容";

  return (
    <Modal
      open
      centered
      title={
        <ModalTitle
          icon={<SettingOutlined className="text-blue-500" />}
          title={isNew ? "新增动态配置" : "编辑动态配置"}
          extra={!isNew ? <Tag color="blue" className="!mr-0">{editing.id}</Tag> : null}
        />
      }
      width={MODAL_WIDTH.lg}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button
          key="save"
          type="primary"
          loading={saving}
          onClick={onSave}
        >
          保存配置
        </Button>,
      ]}
      destroyOnClose
    >
      <Form layout="vertical" component={false}>
        <div className={MODAL_BODY_SCROLL_CLASS}>
          <Form.Item
            label="配置 ID"
            required
            extra="仅支持英文字母、数字、点号、下划线和短横线；创建后 ID 不允许修改。"
            className="!mb-0"
          >
            <Input
              value={editing.id}
              disabled={!isNew}
              onChange={(e) => onChange({ ...editing, id: e.target.value })}
              placeholder="例如: homepage_notice 或 listen_together_max_people"
              className="font-mono text-xs"
            />
          </Form.Item>

          <div>
            <Form.Item label="配置类型" className="!mb-0">
              <Select
                value={editing.type}
                onChange={(val) => onChange({ ...editing, type: val })}
                className="w-full"
                options={TYPE_OPTIONS.map((item) => ({
                  label: item.label,
                  value: item.value,
                }))}
              />
            </Form.Item>
            {selectedTypeOption && (
              <Alert
                type="info"
                showIcon
                message={selectedTypeOption.hint}
                className="mt-2"
              />
            )}
          </div>

          {editing.type === "html" ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Form.Item
                label={
                  <span>
                    <CodeOutlined className="mr-1 text-slate-500" />
                    HTML 源码
                  </span>
                }
                className="!mb-0"
              >
                <Input.TextArea
                  rows={12}
                  value={editing.content}
                  onChange={(e) => onChange({ ...editing, content: e.target.value })}
                  placeholder={contentPlaceholder}
                  className="font-mono text-xs"
                />
              </Form.Item>

              <Form.Item
                label={
                  <span>
                    <EyeOutlined className="mr-1 text-blue-500" />
                    实时渲染预览
                  </span>
                }
                className="!mb-0"
              >
                <div className="h-[254px] overflow-y-auto rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-700 leading-relaxed shadow-2xs">
                  {editing.content.trim() ? (
                    <div dangerouslySetInnerHTML={{ __html: editing.content }} />
                  ) : (
                    <span className="text-slate-400">输入 HTML 后会在这里实时预览</span>
                  )}
                </div>
              </Form.Item>
            </div>
          ) : (
            <Form.Item label="配置内容" className="!mb-0">
              <Input.TextArea
                rows={6}
                value={editing.content}
                onChange={(e) => onChange({ ...editing, content: e.target.value })}
                placeholder={contentPlaceholder}
                className="font-mono text-xs"
              />
            </Form.Item>
          )}
        </div>
      </Form>
    </Modal>
  );
}
