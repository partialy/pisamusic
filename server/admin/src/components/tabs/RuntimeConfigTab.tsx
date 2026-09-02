import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Col,
  Empty,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Spin,
  Switch,
  Tag,
  Tooltip,
  message,
} from "antd";
import {
  FilterOutlined,
  ReloadOutlined,
  RollbackOutlined,
  SaveOutlined,
  SearchOutlined,
  SlidersOutlined,
  UndoOutlined,
} from "@ant-design/icons";
import { fetchRuntimeConfig, updateRuntimeConfig } from "../../api/client";
import { glassCardClasses, glassInputClasses } from "../../constants/theme";
import type { RuntimeConfigChange, RuntimeConfigGroup, RuntimeConfigItem } from "../../types/runtimeConfig";

function formatHumanReadableHint(value: any, unit?: string): string {
  if (typeof value !== "number") return "";

  if (unit === "秒") {
    if (value >= 86400 && value % 86400 === 0) return `(${value / 86400} 天)`;
    if (value >= 3600 && value % 3600 === 0) return `(${value / 3600} 小时)`;
    if (value >= 60 && value % 60 === 0) return `(${value / 60} 分钟)`;
  }
  if (unit === "毫秒") {
    if (value >= 86400000 && value % 86400000 === 0) return `(${value / 86400000} 天)`;
    if (value >= 3600000 && value % 3600000 === 0) return `(${value / 3600000} 小时)`;
    if (value >= 60000 && value % 60000 === 0) return `(${value / 60000} 分钟)`;
    if (value >= 1000 && value % 1000 === 0) return `(${value / 1000} 秒)`;
  }
  if (unit === "字节") {
    if (value >= 1073741824 && value % 1073741824 === 0) return `(${value / 1073741824} GB)`;
    if (value >= 1048576 && value % 1048576 === 0) return `(${value / 1048576} MB)`;
    if (value >= 1024 && value % 1024 === 0) return `(${value / 1024} KB)`;
  }
  return "";
}

function areValuesEqual(a: any, b: any): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }
  return a === b;
}

const GROUP_ORDER: { group: RuntimeConfigGroup; label: string; icon: string }[] = [
  { group: "download_security", label: "下载安全", icon: "🛡️" },
  { group: "download_rate_limit", label: "下载限流", icon: "⚡" },
  { group: "bot_blocking", label: "爬虫拦截", icon: "🤖" },
  { group: "auth", label: "认证与会话", icon: "🔐" },
  { group: "verification", label: "验证码", icon: "🔑" },
  { group: "storage", label: "七牛与存储", icon: "☁️" },
  { group: "analytics", label: "统计与留存", icon: "📊" },
  { group: "sync", label: "数据同步", icon: "🔄" },
  { group: "listening", label: "听歌上报", icon: "🎧" },
  { group: "listen_together", label: "一起听", icon: "👥" },
  { group: "fault_reports", label: "故障上报", icon: "🐛" },
  { group: "feedback", label: "用户反馈", icon: "💬" },
  { group: "shares", label: "分享数据", icon: "🔗" },
  { group: "announcement", label: "公告管理", icon: "📢" },
  { group: "http", label: "HTTP限制", icon: "🌐" },
  { group: "encryption", label: "加密安全", icon: "🔒" },
];

export default function RuntimeConfigTab({ themeColor }: { themeColor: string }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<RuntimeConfigItem[]>([]);
  const [snapshot, setSnapshot] = useState<Record<string, any>>({});
  const [draftValues, setDraftValues] = useState<Record<string, any>>({});
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [keyword, setKeyword] = useState<string>("");

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchRuntimeConfig();
      setItems(res.items);
      setSnapshot(res.snapshot);
      // 初始化编辑草稿
      const drafts: Record<string, any> = {};
      for (const item of res.items) {
        drafts[item.key] = res.snapshot[item.key] ?? item.value;
      }
      setDraftValues(drafts);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "加载配置失败";
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  // 计算脏检查数据
  const { dirtyKeys, dirtyCount } = useMemo(() => {
    const list: string[] = [];
    for (const item of items) {
      const current = draftValues[item.key];
      const orig = snapshot[item.key] ?? item.value;
      if (!areValuesEqual(current, orig)) {
        list.push(item.key);
      }
    }
    return { dirtyKeys: new Set(list), dirtyCount: list.length };
  }, [items, draftValues, snapshot]);

  const handleFieldChange = (key: string, val: any) => {
    setDraftValues((prev) => ({ ...prev, [key]: val }));
  };

  const handleResetFieldToDefault = (item: RuntimeConfigItem) => {
    setDraftValues((prev) => ({ ...prev, [item.key]: item.defaultValue }));
  };

  const handleDiscardChanges = () => {
    Modal.confirm({
      title: "确认放弃所有未保存修改？",
      content: `当前共有 ${dirtyCount} 项配置已被修改，放弃后将恢复为服务器当前值。`,
      okText: "放弃修改",
      okType: "danger",
      cancelText: "取消",
      onOk: () => {
        const drafts: Record<string, any> = {};
        for (const item of items) {
          drafts[item.key] = snapshot[item.key] ?? item.value;
        }
        setDraftValues(drafts);
      },
    });
  };

  const handleSave = async () => {
    if (dirtyCount === 0) {
      message.info("暂无任何修改");
      return;
    }

    const changes: RuntimeConfigChange[] = [];
    for (const key of dirtyKeys) {
      changes.push({ key, value: draftValues[key] });
    }

    setSaving(true);
    try {
      const res = await updateRuntimeConfig(changes);
      setItems(res.items);
      setSnapshot(res.snapshot);
      const drafts: Record<string, any> = {};
      for (const item of res.items) {
        drafts[item.key] = res.snapshot[item.key] ?? item.value;
      }
      setDraftValues(drafts);
      message.success("运行时策略已更新并即时生效，无需重启服务！");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "保存配置失败";
      message.error(msg);
    } finally {
      setSaving(false);
    }
  };

  // 过滤后的项目
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (selectedGroup !== "all" && item.group !== selectedGroup) return false;
      if (keyword.trim()) {
        const kw = keyword.trim().toLowerCase();
        const matchLabel = item.label.toLowerCase().includes(kw);
        const matchKey = item.key.toLowerCase().includes(kw);
        const matchDesc = (item.description || "").toLowerCase().includes(kw);
        if (!matchLabel && !matchKey && !matchDesc) return false;
      }
      return true;
    });
  }, [items, selectedGroup, keyword]);

  // 按组组织分组
  const groupedSections = useMemo(() => {
    const map = new Map<string, RuntimeConfigItem[]>();
    for (const item of filteredItems) {
      const list = map.get(item.group) || [];
      list.push(item);
      map.set(item.group, list);
    }
    return GROUP_ORDER.filter((g) => map.has(g.group)).map((g) => ({
      ...g,
      items: map.get(g.group) || [],
    }));
  }, [filteredItems]);

  return (
    <div className="space-y-4">
      {/* 顶部总览与操作栏 */}
      <div className={glassCardClasses}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-sm"
              style={{ backgroundColor: themeColor }}
            >
              <SlidersOutlined className="text-xl" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-slate-800">运行时策略管理</span>
                <Tag color="blue" className="!mr-0 font-medium">
                  共 {items.length} 项
                </Tag>
                {dirtyCount > 0 && (
                  <Badge count={`${dirtyCount} 项已修改待保存`} style={{ backgroundColor: "#faad14" }} />
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                策略参数保存后立即在服务端内存中热生效，并持久化到 SQLite 数据库，无需重启服务。
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              icon={<ReloadOutlined spin={loading} />}
              onClick={() => void loadData()}
              disabled={loading || saving}
            >
              刷新
            </Button>
            {dirtyCount > 0 && (
              <Button
                icon={<RollbackOutlined />}
                onClick={handleDiscardChanges}
                disabled={saving}
              >
                放弃修改
              </Button>
            )}
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSave}
              loading={saving}
              disabled={loading || dirtyCount === 0}
              style={dirtyCount > 0 ? { backgroundColor: themeColor } : undefined}
            >
              保存全部修改 ({dirtyCount})
            </Button>
          </div>
        </div>

        {/* 筛选与搜索工具条 */}
        <div className="mt-4 pt-3 border-t border-slate-200/80 flex flex-col sm:flex-row items-center gap-3">
          <div className="w-full sm:w-64">
            <Select
              className="w-full"
              value={selectedGroup}
              onChange={setSelectedGroup}
              prefix={<FilterOutlined className="text-slate-400" />}
              options={[
                { value: "all", label: `全部策略分组 (${items.length})` },
                ...GROUP_ORDER.map((g) => ({
                  value: g.group,
                  label: `${g.icon} ${g.label} (${items.filter((i) => i.group === g.group).length})`,
                })),
              ]}
            />
          </div>

          <div className="w-full sm:flex-1">
            <Input
              placeholder="搜索配置名称、Key 或说明关键词..."
              prefix={<SearchOutlined className="text-slate-400" />}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              allowClear
              className={glassInputClasses}
            />
          </div>
        </div>
      </div>

      {/* 配置分组卡片渲染 */}
      <Spin spinning={loading}>
        {groupedSections.length === 0 ? (
          <div className={`${glassCardClasses} py-12 text-center`}>
            <Empty description="没有匹配的策略配置项" />
          </div>
        ) : (
          <div className="space-y-4">
            {groupedSections.map((section) => (
              <Card
                key={section.group}
                title={
                  <div className="flex items-center gap-2">
                    <span>{section.icon}</span>
                    <span className="font-bold text-slate-800">{section.label}</span>
                    <Tag className="!mr-0 text-xs text-slate-500 bg-slate-100 border-slate-200 font-mono">
                      {section.items.length} 项
                    </Tag>
                  </div>
                }
                className="shadow-sm rounded-2xl border border-white/80 bg-white/70 backdrop-blur-xl overflow-hidden"
              >
                <div className="divide-y divide-slate-100">
                  {section.items.map((item) => {
                    const isDirty = dirtyKeys.has(item.key);
                    const val = draftValues[item.key] ?? item.value;
                    const orig = snapshot[item.key] ?? item.value;
                    const isDefault = areValuesEqual(val, item.defaultValue);
                    const hint = formatHumanReadableHint(val, item.unit);

                    return (
                      <div
                        key={item.key}
                        className={`py-3.5 px-2 transition-colors duration-200 ${
                          isDirty ? "bg-amber-50/50 rounded-xl" : ""
                        }`}
                      >
                        <Row gutter={[16, 8]} align="middle">
                          {/* 左侧说明与 Key */}
                          <Col xs={24} md={10} lg={11}>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-sm text-slate-800">
                                  {item.label}
                                </span>
                                {isDirty && (
                                  <Tag color="warning" className="!mr-0 text-xs">
                                    已修改
                                  </Tag>
                                )}
                                {!item.adminEditable && (
                                  <Tag color="default" className="!mr-0 text-xs">
                                    系统只读
                                  </Tag>
                                )}
                              </div>
                              <div className="font-mono text-xs text-slate-400 select-all">
                                {item.key}
                              </div>
                              {item.description && (
                                <p className="text-xs text-slate-500 leading-relaxed">
                                  {item.description}
                                </p>
                              )}
                            </div>
                          </Col>

                          {/* 中间编辑控件 */}
                          <Col xs={24} md={10} lg={9}>
                            <div className="space-y-1">
                              {item.type === "number" && (
                                <div className="flex items-center gap-2">
                                  <InputNumber
                                    value={val}
                                    onChange={(n) => handleFieldChange(item.key, n)}
                                    min={item.min}
                                    max={item.max}
                                    disabled={!item.adminEditable || saving}
                                    className="w-48"
                                    addonAfter={item.unit}
                                  />
                                  {hint && (
                                    <span className="text-xs text-slate-500 font-medium">
                                      {hint}
                                    </span>
                                  )}
                                </div>
                              )}

                              {item.type === "string[]" && (
                                <Select
                                  mode="tags"
                                  value={Array.isArray(val) ? val : []}
                                  onChange={(arr) => handleFieldChange(item.key, arr)}
                                  placeholder="输入后回车添加项"
                                  className="w-full"
                                  disabled={!item.adminEditable || saving}
                                />
                              )}

                              {item.type === "boolean" && (
                                <Switch
                                  checked={Boolean(val)}
                                  onChange={(b) => handleFieldChange(item.key, b)}
                                  disabled={!item.adminEditable || saving}
                                  checkedChildren="开启"
                                  unCheckedChildren="关闭"
                                />
                              )}

                              {item.type === "string" && (
                                <Input
                                  value={String(val ?? "")}
                                  onChange={(e) => handleFieldChange(item.key, e.target.value)}
                                  disabled={!item.adminEditable || saving}
                                  className="w-full max-w-md"
                                />
                              )}

                              {/* 默认值对比说明 */}
                              <div className="text-[11px] text-slate-400 flex items-center gap-2">
                                <span>
                                  默认值:{" "}
                                  <span className="font-mono font-medium">
                                    {Array.isArray(item.defaultValue)
                                      ? `[ ${item.defaultValue.join(", ")} ]`
                                      : String(item.defaultValue)}
                                  </span>
                                  {item.unit ? ` ${item.unit}` : ""}
                                </span>
                                {item.min !== undefined && item.max !== undefined && (
                                  <span>(范围: {item.min} ~ {item.max})</span>
                                )}
                              </div>
                            </div>
                          </Col>

                          {/* 右侧动作 */}
                          <Col xs={24} md={4} lg={4} className="text-right">
                            <Space size="small">
                              {!isDefault && item.adminEditable && (
                                <Tooltip title="恢复为系统内置默认值">
                                  <Button
                                    size="small"
                                    type="text"
                                    icon={<UndoOutlined />}
                                    onClick={() => handleResetFieldToDefault(item)}
                                    disabled={saving}
                                    className="text-xs text-slate-500 hover:text-blue-500"
                                  >
                                    默认值
                                  </Button>
                                </Tooltip>
                              )}
                              {isDirty && (
                                <Tooltip title="撤销本次未保存的修改">
                                  <Button
                                    size="small"
                                    type="text"
                                    onClick={() => handleFieldChange(item.key, orig)}
                                    disabled={saving}
                                    className="text-xs text-amber-600"
                                  >
                                    撤销
                                  </Button>
                                </Tooltip>
                              )}
                            </Space>
                          </Col>
                        </Row>
                      </div>
                    );
                  })}
                </div>
              </Card>
            ))}
          </div>
        )}
      </Spin>
    </div>
  );
}
