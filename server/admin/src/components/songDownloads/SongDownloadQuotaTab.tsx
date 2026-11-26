import { useCallback, useEffect, useState } from "react";
import { Button, Card, Input, Select, Space, Table, Tag, Tooltip, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import {
  fetchQuotaStates,
  fetchSubjectQuotaDetail,
  fetchTierPolicies,
  saveTierPolicies,
} from "../../api/songDownloads";
import { adminCardClasses } from "../../constants/theme";
import type {
  AdminQuotaStateItem,
  AdminTierPoliciesPayload,
  QuotaDimensionSnapshot,
  QuotaTargetRef,
  SongDownloadTierSource,
} from "../../types/songDownloads";
import QuotaOverrideModal from "./QuotaOverrideModal";
import QuotaTargetPickerModal from "./QuotaTargetPickerModal";
import TierPoliciesSection from "./TierPoliciesSection";

function formatDim(dim: QuotaDimensionSnapshot): string {
  if (dim.limit === null) return `已用 ${dim.used} / 不限`;
  return `余 ${dim.remaining} / ${dim.limit}（用 ${dim.used}）`;
}

function toTargetRef(item: AdminQuotaStateItem): QuotaTargetRef {
  return {
    subjectType: item.subjectType,
    subjectKey: item.subjectKey,
    displayName: item.displayName,
    secondaryLabel: item.secondaryLabel,
  };
}

const TIER_BADGE_MAP: Record<SongDownloadTierSource, { label: string; color: string }> = {
  override: { label: "独立覆盖", color: "gold" },
  vip: { label: "VIP档", color: "magenta" },
  standard: { label: "大众档", color: "blue" },
  guest: { label: "游客档", color: "default" },
};

const DEFAULT_TIER_POLICIES: AdminTierPoliciesPayload = {
  guest: { daily: 2, weekly: 10, monthly: 30, total: 30 },
  standard: { daily: 10, weekly: 100, monthly: 1000, total: null },
  registerGiftExtraCount: 10,
  vipTiers: [{ level: 1, name: "VIP 1档", daily: null, weekly: null, monthly: null, total: null }],
};

export default function SongDownloadQuotaTab() {
  const [policies, setPolicies] = useState<AdminTierPoliciesPayload>(DEFAULT_TIER_POLICIES);
  const [savingPolicies, setSavingPolicies] = useState(false);

  const [subjectType, setSubjectType] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<AdminQuotaStateItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingRows, setLoadingRows] = useState(false);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedTableTargets, setSelectedTableTargets] = useState<Map<string, QuotaTargetRef>>(new Map());
  const [editingSingle, setEditingSingle] = useState<AdminQuotaStateItem | null>(null);
  const [editingBatch, setEditingBatch] = useState<QuotaTargetRef[]>([]);
  const [openingDetail, setOpeningDetail] = useState(false);

  useEffect(() => {
    fetchTierPolicies()
      .then(setPolicies)
      .catch((err) => message.error(err instanceof Error ? err.message : "读取档位策略失败"));
  }, []);

  const loadStates = useCallback(async () => {
    setLoadingRows(true);
    try {
      const res = await fetchQuotaStates({
        subjectType,
        keyword: keyword.trim() || undefined,
        offset: (page - 1) * 20,
        limit: 20,
      });
      setRows(res.list);
      setTotal(res.total);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "加载配额列表失败");
    } finally {
      setLoadingRows(false);
    }
  }, [subjectType, keyword, page]);

  useEffect(() => {
    void loadStates();
  }, [loadStates]);

  const handleSavePolicies = async () => {
    setSavingPolicies(true);
    try {
      const saved = await saveTierPolicies(policies);
      setPolicies(saved);
      message.success("四档下载配额策略已保存");
      void loadStates();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSavingPolicies(false);
    }
  };

  const openConfigForTargets = async (targets: QuotaTargetRef[]) => {
    if (targets.length === 0) return;
    if (targets.length === 1) {
      const only = targets[0]!;
      setOpeningDetail(true);
      try {
        const detail = await fetchSubjectQuotaDetail(only.subjectType, only.subjectKey);
        setEditingBatch([]);
        setEditingSingle(detail);
      } catch (err) {
        message.error(err instanceof Error ? err.message : "读取主体配额失败");
      } finally {
        setOpeningDetail(false);
      }
      return;
    }
    setEditingSingle(null);
    setEditingBatch(targets);
  };

  const handlePickerConfirm = async (targets: QuotaTargetRef[]) => {
    setPickerOpen(false);
    await openConfigForTargets(targets);
  };

  const columns: ColumnsType<AdminQuotaStateItem> = [
    {
      title: "主体",
      render: (_v, r) => {
        const badge = r.tierSource ? TIER_BADGE_MAP[r.tierSource] : null;
        return (
          <div>
            <Space size={6}>
              <Tag color={r.subjectType === "user" ? "blue" : "purple"}>
                {r.subjectType === "user" ? "账号" : "设备"}
              </Tag>
              <span className="font-medium text-slate-800">{r.displayName}</span>
              {badge && <Tag color={badge.color}>{badge.label}</Tag>}
            </Space>
            <div className="font-mono text-xs text-slate-400 mt-0.5">{r.subjectKey}</div>
          </div>
        );
      },
    },
    {
      title: "额外次数",
      width: 100,
      render: (_v, r) => (
        <span className="text-xs font-medium text-emerald-600">{r.extraRemaining ?? 0}</span>
      ),
    },
    { title: "每日", width: 160, render: (_v, r) => <span className="text-xs">{formatDim(r.daily)}</span> },
    { title: "每周", width: 160, render: (_v, r) => <span className="text-xs">{formatDim(r.weekly)}</span> },
    { title: "每月", width: 160, render: (_v, r) => <span className="text-xs">{formatDim(r.monthly)}</span> },
    { title: "总计", width: 160, render: (_v, r) => <span className="text-xs">{formatDim(r.total)}</span> },
    {
      title: "操作",
      width: 72,
      fixed: "right",
      align: "center",
      render: (_v, r) => (
        <Tooltip title="配置下载配额">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingBatch([]);
              setEditingSingle(r);
            }}
          />
        </Tooltip>
      ),
    },
  ];

  const selectedCount = selectedTableTargets.size;

  return (
    <div className="space-y-4">
      <TierPoliciesSection
        policies={policies}
        saving={savingPolicies}
        onChange={setPolicies}
        onSave={() => void handleSavePolicies()}
      />

      <Card
        bordered={false}
        className={adminCardClasses}
        title="用户 / 设备配额与用量明细"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            loading={openingDetail}
            onClick={() => setPickerOpen(true)}
          >
            选择用户 / 设备配置
          </Button>
        }
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              allowClear
              placeholder="搜索用户名 / 邮箱 / 设备名 / ID"
              prefix={<SearchOutlined />}
              value={keyword}
              onChange={(e) => {
                setPage(1);
                setKeyword(e.target.value);
              }}
              className="w-64"
            />
            <Select
              value={subjectType}
              onChange={(v) => {
                setPage(1);
                setSubjectType(v);
              }}
              className="w-28"
              options={[
                { value: "all", label: "全部主体" },
                { value: "user", label: "账号" },
                { value: "device", label: "游客设备" },
              ]}
            />
            <Button icon={<ReloadOutlined />} onClick={() => void loadStates()} loading={loadingRows}>
              刷新
            </Button>
          </div>

          {selectedCount > 0 && (
            <Space>
              <Button size="small" onClick={() => setSelectedTableTargets(new Map())}>
                取消勾选
              </Button>
              <Button
                type="primary"
                size="small"
                loading={openingDetail}
                onClick={() => void openConfigForTargets([...selectedTableTargets.values()])}
              >
                批量配置已选 ({selectedCount})
              </Button>
            </Space>
          )}
        </div>

        <Table
          rowKey={(r) => `${r.subjectType}:${r.subjectKey}`}
          size="middle"
          bordered
          scroll={{ x: 1100 }}
          loading={loadingRows}
          columns={columns}
          dataSource={rows}
          rowSelection={{
            selectedRowKeys: rows
              .map((r) => `${r.subjectType}:${r.subjectKey}`)
              .filter((k) => selectedTableTargets.has(k)),
            onSelect: (record, selected) => {
              const key = `${record.subjectType}:${record.subjectKey}`;
              setSelectedTableTargets((prev) => {
                const next = new Map(prev);
                if (selected) next.set(key, toTargetRef(record));
                else next.delete(key);
                return next;
              });
            },
            onSelectAll: (selected) => {
              setSelectedTableTargets((prev) => {
                const next = new Map(prev);
                for (const row of rows) {
                  const key = `${row.subjectType}:${row.subjectKey}`;
                  if (selected) next.set(key, toTargetRef(row));
                  else next.delete(key);
                }
                return next;
              });
            },
          }}
          pagination={{
            current: page,
            pageSize: 20,
            total,
            onChange: setPage,
            showTotal: (t) => `共 ${t} 条`,
          }}
        />
      </Card>

      <QuotaTargetPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onConfirm={(targets) => void handlePickerConfirm(targets)}
      />

      <QuotaOverrideModal
        open={Boolean(editingSingle) || editingBatch.length > 1}
        target={editingSingle}
        batchTargets={editingBatch}
        onClose={() => {
          setEditingSingle(null);
          setEditingBatch([]);
        }}
        onSaved={() => {
          setSelectedTableTargets(new Map());
          void loadStates();
        }}
      />
    </div>
  );
}
