import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Input,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  ReloadOutlined,
  SearchOutlined,
  StopOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import {
  batchDeleteRedemptionCodes,
  batchUpdateRedemptionCodeStatus,
  deleteRedemptionCode,
  fetchRedemptionCodes,
  toggleRedemptionCodeStatus,
  type RedemptionBatchSummary,
  type RedemptionCodeItem,
  type RedemptionRewardType,
} from "../../api/redemptionCodes";

const { Text } = Typography;

function formatTs(ts: number | null | undefined): string {
  if (!ts || ts <= 0) return "-";
  return dayjs(ts).format("YYYY-MM-DD HH:mm");
}

export function renderRedemptionRewardTag(
  rewardType: RedemptionRewardType,
  rewardAmount: number,
  vipLevel: number,
) {
  if (rewardType === "vip") {
    return (
      <Tag color="gold">
        VIP {rewardAmount} 天 · Lv{vipLevel}
      </Tag>
    );
  }
  return <Tag color="green">额外下载 +{rewardAmount} 次</Tag>;
}

type Props = {
  mode: "batch" | "all";
  batch?: RedemptionBatchSummary | null;
  externalSearchKeyword?: string;
  refreshSignal?: number;
  onDataMutated?: () => void;
  onLocateBatch?: (batchId: string) => void;
  onOpenRenameBatch?: (batch: RedemptionBatchSummary) => void;
};

export default function RedemptionCodeTable({
  mode,
  batch,
  externalSearchKeyword,
  refreshSignal = 0,
  onDataMutated,
  onLocateBatch,
  onOpenRenameBatch,
}: Props) {
  const [rows, setRows] = useState<RedemptionCodeItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const [keyword, setKeyword] = useState("");
  const [rewardType, setRewardType] = useState<string>("all");
  const [enabledFilter, setEnabledFilter] = useState<string>("all");
  const [usageStatus, setUsageStatus] = useState<string>("all");

  const [selectedMap, setSelectedMap] = useState<Map<string, RedemptionCodeItem>>(new Map());
  const [batchOperating, setBatchOperating] = useState(false);

  const batchId = mode === "batch" ? batch?.batchId : undefined;

  useEffect(() => {
    setPage(1);
    setSelectedMap(new Map());
  }, [batchId, mode]);

  useEffect(() => {
    if (mode === "batch" && externalSearchKeyword !== undefined) {
      setPage(1);
      setKeyword(externalSearchKeyword);
    }
  }, [externalSearchKeyword, mode]);

  const loadRows = useCallback(async () => {
    if (mode === "batch" && !batchId) {
      setRows([]);
      setTotal(0);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchRedemptionCodes({
        batchId,
        keyword: keyword.trim() || undefined,
        rewardType: mode === "all" && rewardType !== "all" ? rewardType : undefined,
        enabled: enabledFilter === "all" ? undefined : enabledFilter,
        usageStatus: usageStatus === "all" ? undefined : usageStatus,
        offset: (page - 1) * 20,
        limit: 20,
      });
      setRows(data.list);
      setTotal(data.total);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "加载兑换码明细失败");
    } finally {
      setLoading(false);
    }
  }, [batchId, enabledFilter, keyword, mode, page, rewardType, usageStatus]);

  useEffect(() => {
    void loadRows();
  }, [loadRows, refreshSignal]);

  const selectedItems = useMemo(() => [...selectedMap.values()], [selectedMap]);
  const selectedIds = useMemo(() => selectedItems.map((i) => i.id), [selectedItems]);
  const selectedUnusedCount = useMemo(
    () => selectedItems.filter((i) => i.usedCount === 0).length,
    [selectedItems],
  );
  const selectedMutableCount = useMemo(
    () => selectedItems.filter((i) => i.usedCount < i.maxUses).length,
    [selectedItems],
  );

  const handleToggleSingle = async (item: RedemptionCodeItem, enabled: boolean) => {
    try {
      await toggleRedemptionCodeStatus(item.id, enabled);
      setRows((prev) => prev.map((r) => (r.id === item.id ? { ...r, enabled } : r)));
      message.success(enabled ? "已启用兑换码" : "已停用兑换码");
      onDataMutated?.();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "更新状态失败");
    }
  };

  const handleDeleteSingle = async (item: RedemptionCodeItem) => {
    try {
      await deleteRedemptionCode(item.id);
      message.success("已删除兑换码");
      setSelectedMap((prev) => {
        const next = new Map(prev);
        next.delete(item.id);
        return next;
      });
      await loadRows();
      onDataMutated?.();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "删除失败");
    }
  };

  const handleBatchStatus = async (enabled: boolean, onlyUnused = false) => {
    if (selectedIds.length === 0) return;
    setBatchOperating(true);
    try {
      const res = await batchUpdateRedemptionCodeStatus({
        ids: selectedIds,
        enabled,
        onlyUnused,
      });
      const skipTip = res.skippedUsedCount > 0 ? `（跳过 ${res.skippedUsedCount} 条已使用记录）` : "";
      message.success(`已${enabled ? "启用" : "停用"} ${res.updatedCount} 条兑换码${skipTip}`);
      setSelectedMap(new Map());
      await loadRows();
      onDataMutated?.();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "批量操作失败");
    } finally {
      setBatchOperating(false);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0 || selectedUnusedCount === 0) return;
    setBatchOperating(true);
    try {
      const res = await batchDeleteRedemptionCodes({
        ids: selectedIds,
        onlyUnused: selectedUnusedCount < selectedIds.length,
      });
      const skipTip = res.skippedUsedCount > 0 ? `，保留 ${res.skippedUsedCount} 条已使用审计记录` : "";
      message.success(`已删除 ${res.deletedCount} 条未使用兑换码${skipTip}`);
      setSelectedMap(new Map());
      await loadRows();
      onDataMutated?.();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "批量删除失败");
    } finally {
      setBatchOperating(false);
    }
  };

  const handleBatchScopeAction = async (type: "disable_unused" | "delete_unused") => {
    if (!batchId) return;
    setBatchOperating(true);
    try {
      if (type === "disable_unused") {
        const res = await batchUpdateRedemptionCodeStatus({
          batchId,
          enabled: false,
          onlyUnused: true,
        });
        message.success(`已停用本批次 ${res.updatedCount} 条未使用兑换码`);
      } else {
        const res = await batchDeleteRedemptionCodes({
          batchId,
          onlyUnused: true,
        });
        const skipTip = res.skippedUsedCount > 0 ? `，保留 ${res.skippedUsedCount} 条已使用记录` : "";
        message.success(`已清理本批次 ${res.deletedCount} 条未使用兑换码${skipTip}`);
      }
      setSelectedMap(new Map());
      await loadRows();
      onDataMutated?.();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "整批操作失败");
    } finally {
      setBatchOperating(false);
    }
  };

  const handleCopyCurrentPage = async () => {
    if (rows.length === 0) return;
    try {
      await navigator.clipboard.writeText(rows.map((r) => r.code).join("\n"));
      message.success(`已复制当前页 ${rows.length} 个兑换码`);
    } catch {
      message.error("复制失败，请手动复制");
    }
  };

  const columns: ColumnsType<RedemptionCodeItem> = [
    {
      title: "兑换码",
      dataIndex: "code",
      width: 190,
      render: (code: string) => (
        <Text code copyable={{ text: code }}>
          {code}
        </Text>
      ),
    },
    ...(mode === "all"
      ? [
          {
            title: "所属批次",
            width: 170,
            render: (_v: unknown, row: RedemptionCodeItem) => (
              <div>
                <div className="text-xs font-medium text-slate-800 truncate max-w-[155px]">
                  {row.batchName || `批次 ${row.batchId.slice(0, 6)}`}
                </div>
                {onLocateBatch ? (
                  <button
                    type="button"
                    className="text-[11px] text-blue-600 hover:underline font-mono"
                    onClick={() => onLocateBatch(row.batchId)}
                  >
                    定位批次 {row.batchId.slice(0, 8)}
                  </button>
                ) : (
                  <div className="text-[11px] text-slate-400 font-mono">{row.batchId.slice(0, 8)}</div>
                )}
              </div>
            ),
          },
          {
            title: "奖励内容",
            width: 155,
            render: (_v: unknown, row: RedemptionCodeItem) =>
              renderRedemptionRewardTag(row.rewardType, row.rewardAmount, row.vipLevel),
          },
        ]
      : []),
    {
      title: "核销进度",
      width: 110,
      render: (_v, row) => {
        const exhausted = row.usedCount >= row.maxUses;
        const partialUsed = row.usedCount > 0 && !exhausted;
        return (
          <Space size={4}>
            <span className="font-mono text-xs">
              {row.usedCount}/{row.maxUses}
            </span>
            {exhausted && <Tag color="default">已核销</Tag>}
            {partialUsed && <Tag color="processing">进行中</Tag>}
          </Space>
        );
      },
    },
    {
      title: "状态",
      width: 85,
      render: (_v, row) => {
        const locked = row.usedCount >= row.maxUses;
        return (
          <Tooltip title={locked ? "已核销完成，不可更改状态" : undefined}>
            <Switch
              size="small"
              checked={row.enabled}
              disabled={locked}
              onChange={(checked) => void handleToggleSingle(row, checked)}
            />
          </Tooltip>
        );
      },
    },
    {
      title: "过期时间",
      width: 140,
      render: (_v, row) => (
        <span className="text-xs text-slate-600">
          {row.expiresAt ? formatTs(row.expiresAt) : "不过期"}
        </span>
      ),
    },
    ...(mode === "all"
      ? [
          {
            title: "备注",
            dataIndex: "remark",
            render: (v: string) => <span className="text-xs text-slate-500">{v || "-"}</span>,
          },
        ]
      : []),
    {
      title: "操作",
      width: 72,
      render: (_v, row) => {
        const hasUsed = row.usedCount > 0;
        if (hasUsed) {
          return (
            <Tooltip title="已使用过的兑换码保留核销审计，不允许删除">
              <Button size="small" type="text" danger icon={<DeleteOutlined />} disabled />
            </Tooltip>
          );
        }
        return (
          <Popconfirm
            title="确认删除该未使用的兑换码？"
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
            onConfirm={() => void handleDeleteSingle(row)}
          >
            <Button size="small" type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        );
      },
    },
  ];

  if (mode === "batch" && !batch) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-400">
        请在左侧选择一个批次查看或管理兑换码
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {mode === "batch" && batch && (
        <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-sm text-slate-800">
                {batch.batchName || `未命名批次 (${batch.batchId.slice(0, 6)})`}
              </span>
              {renderRedemptionRewardTag(batch.rewardType, batch.rewardAmount, batch.vipLevel)}
              <Tag color={batch.isSharedMode ? "purple" : "blue"}>
                {batch.isSharedMode ? "通用口令" : "唯一批量码"}
              </Tag>
              {onOpenRenameBatch && (
                <Button
                  size="small"
                  type="link"
                  icon={<EditOutlined />}
                  onClick={() => onOpenRenameBatch(batch)}
                  className="!px-1"
                >
                  命名/改名
                </Button>
              )}
            </div>
            <div className="text-xs text-slate-500 flex flex-wrap gap-x-3 gap-y-1">
              <span>批次 ID: <span className="font-mono">{batch.batchId}</span></span>
              <span>已核销: {batch.usedCodeCount}/{batch.totalCount} 码（{batch.totalUsedCount}/{batch.totalMaxUses} 次）</span>
              {batch.remark && <span>备注: {batch.remark}</span>}
            </div>
          </div>

          <Space wrap size={6}>
            <Popconfirm
              title={`停用本批次全部未使用的兑换码（共 ${batch.totalCount - batch.usedCodeCount} 条未使用中当前可用 ${batch.unusedEnabledCount} 条）？`}
              okText="确认停用"
              cancelText="取消"
              disabled={batch.unusedEnabledCount === 0}
              onConfirm={() => void handleBatchScopeAction("disable_unused")}
            >
              <Button
                size="small"
                icon={<StopOutlined />}
                loading={batchOperating}
                disabled={batch.unusedEnabledCount === 0}
              >
                停用本批未使用
              </Button>
            </Popconfirm>
            <Popconfirm
              title={
                batch.usedCodeCount > 0
                  ? `仅删除本批 ${batch.totalCount - batch.usedCodeCount} 条未使用码（保留 ${batch.usedCodeCount} 条已使用码用于审计）？`
                  : `确认删除本批次全部 ${batch.totalCount} 条未使用的兑换码？`
              }
              okText="确认清理"
              cancelText="取消"
              okButtonProps={{ danger: true }}
              disabled={batch.totalCount - batch.usedCodeCount === 0}
              onConfirm={() => void handleBatchScopeAction("delete_unused")}
            >
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                loading={batchOperating}
                disabled={batch.totalCount - batch.usedCodeCount === 0}
              >
                清理本批未使用
              </Button>
            </Popconfirm>
          </Space>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            allowClear
            placeholder={mode === "all" ? "搜兑换码 / 批次名 / 批次ID / 备注" : "搜当前批次内兑换码"}
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={(e) => {
              setPage(1);
              setKeyword(e.target.value);
            }}
            className={mode === "all" ? "w-64" : "w-52"}
          />
          {mode === "all" && (
            <Select
              value={rewardType}
              onChange={(v) => {
                setPage(1);
                setRewardType(v);
              }}
              className="w-32"
              options={[
                { value: "all", label: "全部奖励" },
                { value: "extra_downloads", label: "额外次数" },
                { value: "vip", label: "VIP 时长" },
              ]}
            />
          )}
          <Select
            value={enabledFilter}
            onChange={(v) => {
              setPage(1);
              setEnabledFilter(v);
            }}
            className="w-28"
            options={[
              { value: "all", label: "全部状态" },
              { value: "true", label: "已启用" },
              { value: "false", label: "已停用" },
            ]}
          />
          <Select
            value={usageStatus}
            onChange={(v) => {
              setPage(1);
              setUsageStatus(v);
            }}
            className="w-28"
            options={[
              { value: "all", label: "全部核销" },
              { value: "unused", label: "未使用" },
              { value: "used", label: "已使用" },
            ]}
          />
          <Button icon={<ReloadOutlined />} loading={loading} onClick={() => void loadRows()}>
            刷新
          </Button>
          <Button icon={<CopyOutlined />} disabled={rows.length === 0} onClick={() => void handleCopyCurrentPage()}>
            复制本页
          </Button>
        </div>
      </div>

      {selectedItems.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-blue-50/70 px-3 py-2 text-xs">
          <span className="text-slate-700">
            已选中 <strong>{selectedItems.length}</strong> 条（未使用{" "}
            <strong className="text-emerald-700">{selectedUnusedCount}</strong> 条）
            {selectedUnusedCount < selectedItems.length && (
              <span className="ml-2 text-amber-600">已使用兑换码不可删除，仅支持操作未使用或未核销完记录</span>
            )}
          </span>
          <Space wrap size={6}>
            <Button size="small" onClick={() => setSelectedMap(new Map())}>
              取消勾选
            </Button>
            <Button
              size="small"
              icon={<CheckCircleOutlined />}
              loading={batchOperating}
              disabled={selectedMutableCount === 0}
              onClick={() => void handleBatchStatus(true, selectedMutableCount < selectedItems.length)}
            >
              批量启用
            </Button>
            <Button
              size="small"
              icon={<StopOutlined />}
              loading={batchOperating}
              disabled={selectedUnusedCount === 0 && selectedMutableCount === 0}
              onClick={() =>
                void handleBatchStatus(
                  false,
                  selectedUnusedCount > 0 && selectedUnusedCount < selectedItems.length,
                )
              }
            >
              批量停用
            </Button>
            <Popconfirm
              title={
                selectedUnusedCount < selectedItems.length
                  ? `所选包含 ${selectedItems.length - selectedUnusedCount} 条已使用码（保留审计不删），确认仅删除 ${selectedUnusedCount} 条未使用码？`
                  : `确认永久删除已选中的 ${selectedUnusedCount} 条未使用兑换码？`
              }
              okText="确认删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
              disabled={selectedUnusedCount === 0}
              onConfirm={() => void handleBatchDelete()}
            >
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                loading={batchOperating}
                disabled={selectedUnusedCount === 0}
              >
                批量删除{selectedUnusedCount > 0 ? ` (${selectedUnusedCount})` : ""}
              </Button>
            </Popconfirm>
          </Space>
        </div>
      )}

      <Table
        rowKey="id"
        size="small"
        loading={loading}
        columns={columns}
        dataSource={rows}
        scroll={{ x: mode === "all" ? 960 : 620 }}
        rowSelection={{
          selectedRowKeys: selectedIds,
          onSelect: (record, selected) => {
            setSelectedMap((prev) => {
              const next = new Map(prev);
              if (selected) next.set(record.id, record);
              else next.delete(record.id);
              return next;
            });
          },
          onSelectAll: (selected) => {
            setSelectedMap((prev) => {
              const next = new Map(prev);
              for (const row of rows) {
                if (selected) next.set(row.id, row);
                else next.delete(row.id);
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
          showSizeChanger: false,
          showTotal: (t) => `共 ${t} 条`,
        }}
      />
    </div>
  );
}
