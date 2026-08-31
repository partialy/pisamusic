import { useMemo, useState } from "react";
import {
  Button,
  Card,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import type { DynamicConfigItem, DynamicConfigType } from "../../types/config";

const { Text } = Typography;

type Props = {
  items: DynamicConfigItem[];
  themeColor: string;
  loading: boolean;
  onCreate: () => void;
  onEdit: (item: DynamicConfigItem) => void;
  onDelete: (item: DynamicConfigItem) => void;
};

function typeTag(type: DynamicConfigType) {
  switch (type) {
    case "html":
      return <Tag color="orange">HTML 片段</Tag>;
    case "number":
      return <Tag color="blue">数字</Tag>;
    case "url":
      return <Tag color="green">URL 链接</Tag>;
    default:
      return <Tag color="geekblue">字符串</Tag>;
  }
}

export default function DynamicConfigTab({
  items,
  themeColor: _,
  loading,
  onCreate,
  onEdit,
  onDelete,
}: Props) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [previewHtmlItem, setPreviewHtmlItem] = useState<DynamicConfigItem | null>(null);

  const filteredItems = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchKeyword = !keyword || item.id.toLowerCase().includes(keyword) || (item.content || "").toLowerCase().includes(keyword);
      const matchType = typeFilter === "all" || item.type === typeFilter;
      return matchKeyword && matchType;
    });
  }, [items, query, typeFilter]);

  const columns: ColumnsType<DynamicConfigItem> = [
    {
      title: "配置 ID",
      dataIndex: "id",
      key: "id",
      width: 220,
      render: (id: string) => (
        <Tooltip title={`公开读取接口: /api/config/get?id=${id}`}>
          <Text copyable={{ text: id }} strong className="font-mono text-xs text-slate-800">
            {id}
          </Text>
        </Tooltip>
      ),
    },
    {
      title: "配置类型",
      dataIndex: "type",
      key: "type",
      width: 120,
      align: "center",
      render: (type: DynamicConfigType) => typeTag(type),
    },
    {
      title: "配置内容",
      dataIndex: "content",
      key: "content",
      render: (content: string, record) => (
        <Tooltip title={content}>
          <div className="font-mono text-xs text-slate-600 truncate max-w-[500px]">
            {record.type === "url" ? (
              <a href={content} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                {content}
              </a>
            ) : (
              content || <span className="text-slate-400">(空内容)</span>
            )}
          </div>
        </Tooltip>
      ),
    },
    {
      title: "操作",
      key: "actions",
      fixed: "right",
      width: 180,
      render: (_, record) => (
        <Space size={4}>
          {record.type === "html" && (
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => setPreviewHtmlItem(record)}
            >
              预览
            </Button>
          )}

          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => onEdit(record)}
          >
            编辑
          </Button>

          <Popconfirm
            title={`确认删除配置 "${record.id}"？`}
            description="删除后，客户端请求此 ID 将不再返回该配置内容。"
            onConfirm={() => onDelete(record)}
            okText="确认删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button type="link" danger size="small" icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-4 animate-fade-in-up">
      <Card
        bordered={false}
        className="shadow-sm rounded-2xl"
        title={
          <div>
            <span className="text-lg font-bold text-slate-800">动态配置管理</span>
            <span className="ml-2 text-xs font-normal text-slate-500">
              公开读取接口：<code className="text-slate-600 font-mono">GET /api/config/get?id=xxx</code>
            </span>
          </div>
        }
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={onCreate}
          >
            新增配置
          </Button>
        }
      >
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Input
            placeholder="搜索配置 ID 或内容..."
            prefix={<SearchOutlined className="text-slate-400" />}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            allowClear
            className="w-full sm:w-72"
          />

          <Select
            value={typeFilter}
            onChange={(val) => setTypeFilter(val)}
            className="w-36"
            options={[
              { label: "全部类型", value: "all" },
              { label: "字符串 (string)", value: "string" },
              { label: "数字 (number)", value: "number" },
              { label: "URL 链接 (url)", value: "url" },
              { label: "HTML 片段 (html)", value: "html" },
            ]}
          />

          <Button onClick={() => { setQuery(""); setTypeFilter("all"); }}>
            重置
          </Button>
        </div>

        <Table<DynamicConfigItem>
          rowKey="id"
          columns={columns}
          dataSource={filteredItems}
          loading={loading}
          size="middle"
          scroll={{ x: 900 }}
          bordered
          pagination={{
            pageSize: 15,
            showTotal: (t) => `共 ${t} 项配置`,
            showQuickJumper: true,
          }}
        />
      </Card>

      {/* HTML Preview Modal */}
      {previewHtmlItem && (
        <Modal
          open
          centered
          title={
            <Space>
              <EyeOutlined className="text-blue-500" />
              <span>HTML 实时预览</span>
              <Tag color="orange">{previewHtmlItem.id}</Tag>
            </Space>
          }
          width={760}
          onCancel={() => setPreviewHtmlItem(null)}
          footer={[
            <Button key="close" type="primary" onClick={() => setPreviewHtmlItem(null)}>
              关闭预览
            </Button>,
          ]}
          destroyOnClose
        >
          <div className="max-h-[60vh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-700 shadow-2xs leading-relaxed">
            <div
              dangerouslySetInnerHTML={{
                __html: previewHtmlItem.content || '<span class="text-slate-400">暂无内容</span>',
              }}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
