import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Input,
  Popconfirm,
  Radio,
  Row,
  Space,
  Spin,
  Switch,
  Tabs,
  Tag,
  Typography,
  message,
} from "antd";
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  RedoOutlined,
  ReloadOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import { fetchSidebarMenu, saveSidebarMenu } from "../api/sidebarMenu";
import SidebarMenuItemModal from "../components/sidebarMenu/SidebarMenuItemModal";
import SidebarMenuPreview from "../components/sidebarMenu/SidebarMenuPreview";
import { glassCardClasses } from "../constants/theme";
import type {
  SidebarMenuConfig,
  SidebarMenuItem,
  SidebarSectionKind,
} from "../types/sidebarMenu";

const EMPTY_CONFIG: SidebarMenuConfig = {
  listSection: { enabled: false, title: "其他", items: [] },
  gridSection: { enabled: false, position: "top", items: [] },
  updatedAt: 0,
};

function badgeLabel(item: SidebarMenuItem) {
  if (item.badgeType === "text") return <Tag color="blue">文字: {item.subtitleText}</Tag>;
  if (item.badgeType === "dot_once") return <Tag color="red">一次性红点 v{item.badgeVersion}</Tag>;
  if (item.badgeType === "dot_always") return <Tag color="volcano">常驻红点</Tag>;
  return <Tag>无角标</Tag>;
}

function openTypeLabel(item: SidebarMenuItem) {
  return item.openType === "fullscreen_web" ? (
    <Tag color="purple">全屏网页</Tag>
  ) : (
    <Tag color="cyan">普通网页</Tag>
  );
}

export default function SidebarMenuManagementPage() {
  const [config, setConfig] = useState<SidebarMenuConfig>(EMPTY_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [reloadTick, setReloadTick] = useState(0);
  const [dirty, setDirty] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalSection, setModalSection] = useState<SidebarSectionKind>("list");
  const [editingItem, setEditingItem] = useState<SidebarMenuItem | null>(null);

  const mounted = useRef(true);
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetchSidebarMenu(controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setConfig(data);
        setDirty(false);
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted) {
          setError(e instanceof Error ? e.message : "加载侧栏菜单配置失败");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [reloadTick]);

  const updateItems = (section: SidebarSectionKind, updater: (prev: SidebarMenuItem[]) => SidebarMenuItem[]) => {
    setDirty(true);
    setConfig((prev) => {
      const key = section === "list" ? "listSection" : "gridSection";
      const nextItems = updater(prev[key].items).map((item, idx) => ({
        ...item,
        sortOrder: idx,
      }));
      return {
        ...prev,
        [key]: {
          ...prev[key],
          items: nextItems,
        },
      };
    });
  };

  const handleMove = (section: SidebarSectionKind, index: number, delta: -1 | 1) => {
    updateItems(section, (items) => {
      const target = index + delta;
      if (target < 0 || target >= items.length) return items;
      const copy = [...items];
      const [moved] = copy.splice(index, 1);
      copy.splice(target, 0, moved!);
      return copy;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = await saveSidebarMenu({
        listSection: {
          ...config.listSection,
          items: config.listSection.items.map((item, idx) => ({ ...item, sortOrder: idx })),
        },
        gridSection: {
          ...config.gridSection,
          items: config.gridSection.items.map((item, idx) => ({ ...item, sortOrder: idx })),
        },
      });
      if (!mounted.current) return;
      setConfig(saved);
      setDirty(false);
      void messageApi.success("侧栏菜单配置已保存并发布");
    } catch (e) {
      if (mounted.current) {
        void messageApi.error(e instanceof Error ? e.message : "保存失败");
      }
    } finally {
      if (mounted.current) setSaving(false);
    }
  };

  const renderItemList = (section: SidebarSectionKind, items: SidebarMenuItem[]) => {
    if (!items.length) {
      return <Empty description="暂无菜单项，点击右上方新增" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
    }
    return (
      <div className="space-y-2">
        {items.map((item, index) => (
          <div
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-white/70 px-3 py-2.5"
          >
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <Typography.Text strong className="truncate max-w-[180px]">
                  {item.name}
                </Typography.Text>
                {!item.enabled && <Tag>已停用</Tag>}
                {openTypeLabel(item)}
                {badgeLabel(item)}
              </div>
              <div className="truncate text-xs text-slate-500">{item.url}</div>
            </div>

            <Space size={4} wrap>
              <Switch
                size="small"
                checked={item.enabled}
                onChange={(checked) =>
                  updateItems(section, (prev) =>
                    prev.map((p) => (p.id === item.id ? { ...p, enabled: checked } : p)),
                  )
                }
              />
              {item.badgeType === "dot_once" && (
                <Button
                  size="small"
                  icon={<RedoOutlined />}
                  title="递增红点版本，使客户端重新展示一次红点"
                  onClick={() =>
                    updateItems(section, (prev) =>
                      prev.map((p) =>
                        p.id === item.id ? { ...p, badgeVersion: p.badgeVersion + 1 } : p,
                      ),
                    )
                  }
                >
                  重置红点
                </Button>
              )}
              <Button
                size="small"
                icon={<ArrowUpOutlined />}
                disabled={index === 0}
                onClick={() => handleMove(section, index, -1)}
              />
              <Button
                size="small"
                icon={<ArrowDownOutlined />}
                disabled={index === items.length - 1}
                onClick={() => handleMove(section, index, 1)}
              />
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => {
                  setModalSection(section);
                  setEditingItem(item);
                  setModalOpen(true);
                }}
              />
              <Popconfirm
                title="确认删除该菜单项？"
                onConfirm={() =>
                  updateItems(section, (prev) => prev.filter((p) => p.id !== item.id))
                }
              >
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </Space>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {contextHolder}
      <Alert
        type={dirty ? "warning" : "info"}
        showIcon
        message={
          dirty
            ? "当前有未保存的修改，请点击「保存并发布」后客户端才会生效。"
            : "此处配置的【横栏入口】与【九宫格入口】将在手机端侧栏动态下发展示；未启用或无内容时不展示。"
        }
        action={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              disabled={loading || saving}
              onClick={() => setReloadTick((v) => v + 1)}
            >
              重新拉取
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={saving}
              disabled={loading}
              onClick={() => void handleSave()}
            >
              保存并发布
            </Button>
          </Space>
        }
      />

      {error && (
        <Alert
          type="error"
          showIcon
          message={error}
          action={<Button onClick={() => setReloadTick((v) => v + 1)}>重试</Button>}
        />
      )}

      <Spin spinning={loading}>
        <Row gutter={[16, 16]}>
          <Col xs={24} xl={15}>
            <Card className={glassCardClasses}>
              <Tabs
                items={[
                  {
                    key: "list",
                    label: `横栏入口 (${config.listSection.items.length})`,
                    children: (
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50/80 p-3">
                          <Space>
                            <span className="text-sm font-medium">启用横栏入口：</span>
                            <Switch
                              checked={config.listSection.enabled}
                              onChange={(checked) => {
                                setDirty(true);
                                setConfig((prev) => ({
                                  ...prev,
                                  listSection: { ...prev.listSection, enabled: checked },
                                }));
                              }}
                            />
                          </Space>
                          <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={() => {
                              setModalSection("list");
                              setEditingItem(null);
                              setModalOpen(true);
                            }}
                          >
                            新增横栏入口
                          </Button>
                        </div>

                        <div>
                          <div className="mb-1 text-xs text-slate-500">
                            分段小字标题（显示在现有列表最底部、新增横栏上方；留空则不显示小字）
                          </div>
                          <Input
                            maxLength={20}
                            showCount
                            placeholder="例如：其他（留空不显示）"
                            value={config.listSection.title}
                            onChange={(e) => {
                              setDirty(true);
                              setConfig((prev) => ({
                                ...prev,
                                listSection: { ...prev.listSection, title: e.target.value },
                              }));
                            }}
                          />
                        </div>

                        {renderItemList("list", config.listSection.items)}
                      </div>
                    ),
                  },
                  {
                    key: "grid",
                    label: `九宫格入口 (${config.gridSection.items.length})`,
                    children: (
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50/80 p-3">
                          <Space wrap>
                            <span className="text-sm font-medium">启用九宫格：</span>
                            <Switch
                              checked={config.gridSection.enabled}
                              onChange={(checked) => {
                                setDirty(true);
                                setConfig((prev) => ({
                                  ...prev,
                                  gridSection: { ...prev.gridSection, enabled: checked },
                                }));
                              }}
                            />
                            <span className="ml-2 text-sm font-medium">展示位置：</span>
                            <Radio.Group
                              size="small"
                              value={config.gridSection.position}
                              onChange={(e) => {
                                setDirty(true);
                                setConfig((prev) => ({
                                  ...prev,
                                  gridSection: {
                                    ...prev.gridSection,
                                    position: e.target.value,
                                  },
                                }));
                              }}
                            >
                              <Radio.Button value="top">顶部（已有列表上方）</Radio.Button>
                              <Radio.Button value="bottom">底部（已有列表下方）</Radio.Button>
                            </Radio.Group>
                          </Space>
                          <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={() => {
                              setModalSection("grid");
                              setEditingItem(null);
                              setModalOpen(true);
                            }}
                          >
                            新增九宫格入口
                          </Button>
                        </div>

                        {renderItemList("grid", config.gridSection.items)}
                      </div>
                    ),
                  },
                ]}
              />
            </Card>
          </Col>

          <Col xs={24} xl={9}>
            <SidebarMenuPreview config={config} />
          </Col>
        </Row>
      </Spin>

      <SidebarMenuItemModal
        open={modalOpen}
        section={modalSection}
        initialItem={editingItem}
        onCancel={() => setModalOpen(false)}
        onSubmit={(submitted) => {
          updateItems(modalSection, (prev) => {
            const exists = prev.some((i) => i.id === submitted.id);
            if (exists) {
              return prev.map((i) => (i.id === submitted.id ? submitted : i));
            }
            return [...prev, { ...submitted, sortOrder: prev.length }];
          });
          setModalOpen(false);
        }}
      />
    </div>
  );
}
