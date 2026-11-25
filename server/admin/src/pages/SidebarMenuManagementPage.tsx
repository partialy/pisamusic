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
import BuiltinItemEditModal from "../components/sidebarMenu/BuiltinItemEditModal";
import SidebarMenuItemModal from "../components/sidebarMenu/SidebarMenuItemModal";
import SidebarMenuPreview from "../components/sidebarMenu/SidebarMenuPreview";
import { glassCardClasses } from "../constants/theme";
import {
  SIDEBAR_BUILTIN_META,
  getSidebarAppActionLabel,
  type SidebarBuiltinItem,
  type SidebarListSection,
  type SidebarMenuConfig,
  type SidebarMenuItem,
  type SidebarSectionKind,
} from "../types/sidebarMenu";

function createDefaultBuiltinItems(): SidebarBuiltinItem[] {
  return SIDEBAR_BUILTIN_META.map((m) => ({
    key: m.key,
    enabled: true,
    name: "",
    iconType: "default",
    iconFileId: null,
    iconValue: "",
    iconUrl: "",
  }));
}

const EMPTY_CONFIG: SidebarMenuConfig = {
  builtinItems: createDefaultBuiltinItems(),
  listSections: [],
  gridSection: { enabled: false, position: "top", items: [] },
  updatedAt: 0,
};

function createSectionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `sec_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  }
  return `sec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function badgeLabel(item: SidebarMenuItem) {
  if (item.badgeType === "text") return <Tag color="blue">文字: {item.subtitleText}</Tag>;
  if (item.badgeType === "dot_once") return <Tag color="red">一次性红点 v{item.badgeVersion}</Tag>;
  if (item.badgeType === "dot_always") return <Tag color="volcano">常驻红点</Tag>;
  return <Tag>无角标</Tag>;
}

function openTypeLabel(item: SidebarMenuItem) {
  if (item.openType === "app_action") {
    return <Tag color="green">App功能: {getSidebarAppActionLabel(item.actionKey)}</Tag>;
  }
  return item.openType === "fullscreen_web" ? (
    <Tag color="purple">全屏网页</Tag>
  ) : (
    <Tag color="cyan">普通网页</Tag>
  );
}

function builtinIconLabel(item: SidebarBuiltinItem) {
  if (item.iconType === "default") return <Tag>默认图标</Tag>;
  if (item.iconType === "none") return <Tag>无图标</Tag>;
  if (item.iconType === "image") return <Tag color="geekblue">自定义图片</Tag>;
  if (item.iconType === "svg") return <Tag color="purple">自定义 SVG</Tag>;
  return <Tag color="cyan">预置: {item.iconValue}</Tag>;
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
  const [targetListSectionId, setTargetListSectionId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<SidebarMenuItem | null>(null);

  const [builtinModalOpen, setBuiltinModalOpen] = useState(false);
  const [editingBuiltin, setEditingBuiltin] = useState<SidebarBuiltinItem | null>(null);

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
        setConfig({
          builtinItems: data.builtinItems?.length ? data.builtinItems : createDefaultBuiltinItems(),
          listSections: data.listSections ?? [],
          gridSection: data.gridSection ?? { enabled: false, position: "top", items: [] },
          updatedAt: data.updatedAt ?? 0,
        });
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

  const updateListSections = (updater: (prev: SidebarListSection[]) => SidebarListSection[]) => {
    setDirty(true);
    setConfig((prev) => ({
      ...prev,
      listSections: updater(prev.listSections).map((sec, idx) => ({
        ...sec,
        sortOrder: idx,
        items: sec.items.map((item, itemIdx) => ({ ...item, sortOrder: itemIdx })),
      })),
    }));
  };

  const updateListSectionItems = (
    sectionId: string,
    updater: (prev: SidebarMenuItem[]) => SidebarMenuItem[],
  ) => {
    updateListSections((sections) =>
      sections.map((sec) => (sec.id === sectionId ? { ...sec, items: updater(sec.items) } : sec)),
    );
  };

  const updateGridItems = (updater: (prev: SidebarMenuItem[]) => SidebarMenuItem[]) => {
    setDirty(true);
    setConfig((prev) => ({
      ...prev,
      gridSection: {
        ...prev.gridSection,
        items: updater(prev.gridSection.items).map((item, idx) => ({
          ...item,
          sortOrder: idx,
        })),
      },
    }));
  };

  const moveListSection = (index: number, delta: -1 | 1) => {
    updateListSections((sections) => {
      const target = index + delta;
      if (target < 0 || target >= sections.length) return sections;
      const copy = [...sections];
      const [moved] = copy.splice(index, 1);
      copy.splice(target, 0, moved!);
      return copy;
    });
  };

  const moveItemInList = (
    items: SidebarMenuItem[],
    index: number,
    delta: -1 | 1,
  ): SidebarMenuItem[] => {
    const target = index + delta;
    if (target < 0 || target >= items.length) return items;
    const copy = [...items];
    const [moved] = copy.splice(index, 1);
    copy.splice(target, 0, moved!);
    return copy;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = await saveSidebarMenu({
        builtinItems: config.builtinItems,
        listSections: config.listSections.map((sec, idx) => ({
          ...sec,
          sortOrder: idx,
          items: sec.items.map((item, itemIdx) => ({ ...item, sortOrder: itemIdx })),
        })),
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

  const renderItemList = (
    section: SidebarSectionKind,
    items: SidebarMenuItem[],
    listSectionId: string | null,
  ) => {
    if (!items.length) {
      return <Empty description="暂无菜单项，点击右上方新增" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
    }
    const applyItemsUpdate = (updater: (prev: SidebarMenuItem[]) => SidebarMenuItem[]) => {
      if (section === "grid") {
        updateGridItems(updater);
      } else if (listSectionId) {
        updateListSectionItems(listSectionId, updater);
      }
    };

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
              <div className="truncate text-xs text-slate-500">
                {item.openType === "app_action"
                  ? `跳转 App 功能：${getSidebarAppActionLabel(item.actionKey)}`
                  : item.url}
              </div>
            </div>

            <Space size={4} wrap>
              <Switch
                size="small"
                checked={item.enabled}
                onChange={(checked) =>
                  applyItemsUpdate((prev) =>
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
                    applyItemsUpdate((prev) =>
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
                onClick={() => applyItemsUpdate((prev) => moveItemInList(prev, index, -1))}
              />
              <Button
                size="small"
                icon={<ArrowDownOutlined />}
                disabled={index === items.length - 1}
                onClick={() => applyItemsUpdate((prev) => moveItemInList(prev, index, 1))}
              />
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => {
                  setModalSection(section);
                  setTargetListSectionId(listSectionId);
                  setEditingItem(item);
                  setModalOpen(true);
                }}
              />
              <Popconfirm
                title="确认删除该菜单项？"
                onConfirm={() =>
                  applyItemsUpdate((prev) => prev.filter((p) => p.id !== item.id))
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

  const totalListItemsCount = config.listSections.reduce((sum, s) => sum + s.items.length, 0);

  return (
    <div className="space-y-4">
      {contextHolder}
      <Alert
        type={dirty ? "warning" : "info"}
        showIcon
        message={
          dirty
            ? "当前有未保存的修改，请点击「保存并发布」后客户端才会生效。"
            : "可管理内置固定项显隐与文案图标、动态横栏多区块及四宫格入口；支持网页链接与 App 原生功能跳转。"
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
                    label: `横栏区块 (${config.listSections.length} 块 / ${totalListItemsCount} 项)`,
                    children: (
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50/80 p-3">
                          <span className="text-xs text-slate-600">
                            支持按区块发布多个横栏分区（如「其他」「活动」「更多」）；有标题展示标题，留空展示分割线。
                          </span>
                          <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={() => {
                              updateListSections((prev) => [
                                ...prev,
                                {
                                  id: createSectionId(),
                                  enabled: true,
                                  sortOrder: prev.length,
                                  title: "",
                                  items: [],
                                },
                              ]);
                            }}
                          >
                            新增横栏区块
                          </Button>
                        </div>

                        {!config.listSections.length ? (
                          <Empty description="暂无横栏区块，点击右上方新增区块" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                        ) : (
                          <div className="space-y-4">
                            {config.listSections.map((sec, secIndex) => (
                              <div
                                key={sec.id}
                                className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-3"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <Space wrap className="flex-1 min-w-[220px]">
                                    <Tag color="blue">区块 #{secIndex + 1}</Tag>
                                    <Switch
                                      size="small"
                                      checked={sec.enabled}
                                      checkedChildren="启用"
                                      unCheckedChildren="停用"
                                      onChange={(checked) =>
                                        updateListSections((prev) =>
                                          prev.map((s) =>
                                            s.id === sec.id ? { ...s, enabled: checked } : s,
                                          ),
                                        )
                                      }
                                    />
                                    <Input
                                      size="small"
                                      style={{ width: 200 }}
                                      maxLength={20}
                                      placeholder="区块标题（留空显示分割线）"
                                      value={sec.title}
                                      onChange={(e) =>
                                        updateListSections((prev) =>
                                          prev.map((s) =>
                                            s.id === sec.id ? { ...s, title: e.target.value } : s,
                                          ),
                                        )
                                      }
                                    />
                                  </Space>

                                  <Space size={4} wrap>
                                    <Button
                                      size="small"
                                      icon={<ArrowUpOutlined />}
                                      disabled={secIndex === 0}
                                      onClick={() => moveListSection(secIndex, -1)}
                                    />
                                    <Button
                                      size="small"
                                      icon={<ArrowDownOutlined />}
                                      disabled={secIndex === config.listSections.length - 1}
                                      onClick={() => moveListSection(secIndex, 1)}
                                    />
                                    <Button
                                      size="small"
                                      type="primary"
                                      ghost
                                      icon={<PlusOutlined />}
                                      onClick={() => {
                                        setModalSection("list");
                                        setTargetListSectionId(sec.id);
                                        setEditingItem(null);
                                        setModalOpen(true);
                                      }}
                                    >
                                      新增入口
                                    </Button>
                                    <Popconfirm
                                      title="确认删除整个区块及其入口？"
                                      onConfirm={() =>
                                        updateListSections((prev) =>
                                          prev.filter((s) => s.id !== sec.id),
                                        )
                                      }
                                    >
                                      <Button size="small" danger icon={<DeleteOutlined />} />
                                    </Popconfirm>
                                  </Space>
                                </div>

                                {renderItemList("list", sec.items, sec.id)}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ),
                  },
                  {
                    key: "grid",
                    label: `四宫格入口 (${config.gridSection.items.length})`,
                    children: (
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50/80 p-3">
                          <Space wrap>
                            <span className="text-sm font-medium">启用四宫格：</span>
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
                              <Radio.Button value="top">顶部（内置列表上方）</Radio.Button>
                              <Radio.Button value="bottom">底部（列表最下方）</Radio.Button>
                            </Radio.Group>
                          </Space>
                          <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={() => {
                              setModalSection("grid");
                              setTargetListSectionId(null);
                              setEditingItem(null);
                              setModalOpen(true);
                            }}
                          >
                            新增四宫格入口
                          </Button>
                        </div>

                        {renderItemList("grid", config.gridSection.items, null)}
                      </div>
                    ),
                  },
                  {
                    key: "builtin",
                    label: "内置入口控制 (4)",
                    children: (
                      <div className="space-y-3">
                        <div className="rounded-xl bg-slate-50/80 p-3 text-xs text-slate-600">
                          客户端固定顺序写死为「导入歌单 → 链接导入 → 定时关闭 → 主题外观」，支持独立控制显示/隐藏、覆盖显示名称及自定义图标；客户端离线或本地模式时默认全部显示。
                        </div>
                        <div className="space-y-2">
                          {config.builtinItems.map((item, idx) => {
                            const meta = SIDEBAR_BUILTIN_META.find((m) => m.key === item.key);
                            const displayName = item.name.trim() || meta?.defaultName || item.key;
                            return (
                              <div
                                key={item.key}
                                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-white/70 px-3 py-2.5"
                              >
                                <div className="min-w-0 flex-1 space-y-1">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <Tag>{idx + 1}</Tag>
                                    <Typography.Text strong>{displayName}</Typography.Text>
                                    {item.name.trim() && (
                                      <Tag color="blue">已改名（原：{meta?.defaultName}）</Tag>
                                    )}
                                    {!item.enabled && <Tag color="default">已隐藏</Tag>}
                                    {builtinIconLabel(item)}
                                  </div>
                                  <div className="text-xs text-slate-500">{meta?.description}</div>
                                </div>
                                <Space>
                                  <Switch
                                    size="small"
                                    checked={item.enabled}
                                    checkedChildren="显示"
                                    unCheckedChildren="隐藏"
                                    onChange={(checked) => {
                                      setDirty(true);
                                      setConfig((prev) => ({
                                        ...prev,
                                        builtinItems: prev.builtinItems.map((b) =>
                                          b.key === item.key ? { ...b, enabled: checked } : b,
                                        ),
                                      }));
                                    }}
                                  />
                                  <Button
                                    size="small"
                                    icon={<EditOutlined />}
                                    onClick={() => {
                                      setEditingBuiltin(item);
                                      setBuiltinModalOpen(true);
                                    }}
                                  >
                                    名称与图标
                                  </Button>
                                </Space>
                              </div>
                            );
                          })}
                        </div>
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
          const apply = (prev: SidebarMenuItem[]) => {
            const exists = prev.some((i) => i.id === submitted.id);
            if (exists) {
              return prev.map((i) => (i.id === submitted.id ? submitted : i));
            }
            return [...prev, { ...submitted, sortOrder: prev.length }];
          };
          if (modalSection === "grid") {
            updateGridItems(apply);
          } else if (targetListSectionId) {
            updateListSectionItems(targetListSectionId, apply);
          }
          setModalOpen(false);
        }}
      />

      <BuiltinItemEditModal
        open={builtinModalOpen}
        item={editingBuiltin}
        onCancel={() => setBuiltinModalOpen(false)}
        onSubmit={(updated) => {
          setDirty(true);
          setConfig((prev) => ({
            ...prev,
            builtinItems: prev.builtinItems.map((b) => (b.key === updated.key ? updated : b)),
          }));
          setBuiltinModalOpen(false);
        }}
      />
    </div>
  );
}
