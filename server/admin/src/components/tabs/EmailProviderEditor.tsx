import { useState } from "react";
import {
  Button,
  Card,
  Input,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  DeleteOutlined,
  MailOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import type { EmailConfig, EmailProviderConfig } from "../../types/config";

const { Text } = Typography;

type Props = {
  email: EmailConfig;
  onChange: (next: EmailConfig) => void;
};

const PROVIDER_CODE_REGEX = /^[a-z][a-z0-9_-]*$/;

export function EmailProviderEditor({ email, onChange }: Props) {
  const [draftCode, setDraftCode] = useState("");
  const [draftName, setDraftName] = useState("");

  const updateProvider = (index: number, patch: Partial<EmailProviderConfig>) => {
    const providers = email.providers.map((item, i) => (i === index ? { ...item, ...patch } : item));
    const provider = providers.some((item) => item.code === email.provider) ? email.provider : providers[0]?.code ?? "";
    onChange({ ...email, provider, providers });
  };

  const addProvider = () => {
    const code = draftCode.trim();
    const name = draftName.trim();
    if (!PROVIDER_CODE_REGEX.test(code)) {
      window.alert("服务商代码必须以小写字母开头，且只能包含小写字母、数字、_、-");
      return;
    }
    if (!name) {
      window.alert("服务商显示名称不能为空");
      return;
    }
    if (email.providers.some((item) => item.code === code)) {
      window.alert("服务商代码已存在");
      return;
    }
    onChange({ ...email, providers: [...email.providers, { code, name }] });
    setDraftCode("");
    setDraftName("");
  };

  const removeProvider = (code: string) => {
    if (code === email.provider) return;
    const providers = email.providers.filter((item) => item.code !== code);
    onChange({ ...email, providers });
  };

  const columns: ColumnsType<EmailProviderConfig & { index: number }> = [
    {
      title: "服务商代码",
      dataIndex: "code",
      key: "code",
      width: 150,
      render: (code: string) => (
        <div className="flex items-center gap-2">
          <Text strong className="font-mono text-xs text-slate-800">
            {code}
          </Text>
          {code === email.provider && <Tag color="success">当前默认</Tag>}
        </div>
      ),
    },
    {
      title: "显示名称",
      dataIndex: "name",
      key: "name",
      render: (name: string, record) => (
        <Input
          size="small"
          value={name}
          onChange={(e) => updateProvider(record.index, { name: e.target.value })}
          placeholder="显示名称"
        />
      ),
    },
    {
      title: "操作",
      key: "actions",
      width: 80,
      align: "center",
      render: (_, record) => {
        const isSelected = record.code === email.provider;
        return (
          <Popconfirm
            title={`确认删除服务商 "${record.name}"？`}
            disabled={isSelected}
            onConfirm={() => removeProvider(record.code)}
            okText="确认删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button
              type="link"
              danger
              size="small"
              disabled={isSelected}
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        );
      },
    },
  ];

  const dataSource = email.providers.map((item, index) => ({
    ...item,
    index,
  }));

  return (
    <Card
      size="small"
      title={
        <Space>
          <MailOutlined className="text-blue-500" />
          <span className="text-xs font-bold text-slate-700">邮件服务商配置</span>
        </Space>
      }
      className="rounded-xl border border-slate-200 bg-slate-50/50"
    >
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            当前默认邮件服务商
          </label>
          <Select
            value={email.provider}
            onChange={(val) => onChange({ ...email, provider: val })}
            className="w-full"
            options={email.providers.map((item) => ({
              label: `${item.name} (${item.code})`,
              value: item.code,
            }))}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-700">
              服务商列表管理
            </span>
          </div>

          <Table
            rowKey="code"
            columns={columns}
            dataSource={dataSource}
            size="small"
            pagination={false}
            bordered
            className="mb-3"
          />

          <div className="flex gap-2">
            <Input
              size="small"
              value={draftCode}
              onChange={(e) => setDraftCode(e.target.value.trim())}
              placeholder="代码 (例如: resend)"
              className="font-mono text-xs w-36"
            />
            <Input
              size="small"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder="显示名称 (例如: Resend 邮件)"
              className="text-xs flex-1"
            />
            <Button
              type="primary"
              size="small"
              icon={<PlusOutlined />}
              onClick={addProvider}
            >
              添加
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
