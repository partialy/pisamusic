import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Radio,
  Row,
  Segmented,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  CopyOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import {
  createRedemptionCodesBatch,
  fetchRedemptionBatches,
  fetchRedemptionLogs,
  renameRedemptionBatch,
  type RedemptionBatchSummary,
  type RedemptionCodeItem,
  type RedemptionLogItem,
  type RedemptionRewardType,
} from "../api/redemptionCodes";
import { fetchTierPolicies } from "../api/songDownloads";
import type { VipTierConfig } from "../types/songDownloads";
import { glassCardClasses } from "../constants/theme";
import RedemptionCodeTable, { renderRedemptionRewardTag } from "../components/redemption/RedemptionCodeTable";

const { Text } = Typography;

function formatTs(ts: number | null | undefined): string {
  if (!ts || ts <= 0) return "-";
  return dayjs(ts).format("YYYY-MM-DD HH:mm");
}

export default function RedemptionCodesPage() {
  const [activeTab, setActiveTab] = useState("codes");
  const [viewMode, setViewMode] = useState<"batch" | "all">("batch");
  const [refreshSignal, setRefreshSignal] = useState(0);

  // 左侧：批次聚合列表状态
  const [batches, setBatches] = useState<RedemptionBatchSummary[]>([]);
  const [batchesTotal, setBatchesTotal] = useState(0);
  const [batchesPage, setBatchesPage] = useState(1);
  const [batchesLoading, setBatchesLoading] = useState(false);
  const [batchKeyword, setBatchKeyword] = useState("");
  const [batchRewardType, setBatchRewardType] = useState<string>("all");
  const [selectedBatch, setSelectedBatch] = useState<RedemptionBatchSummary | null>(null);
  const [pendingSelectBatchId, setPendingSelectBatchId] = useState<string | null>(null);

  // 批次重命名弹窗
  const [renamingBatch, setRenamingBatch] = useState<RedemptionBatchSummary | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const [renamingSaving, setRenamingSaving] = useState(false);

  // 兑换记录状态
  const [logs, setLogs] = useState<RedemptionLogItem[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsPage, setLogsPage] = useState(1);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logKeyword, setLogKeyword] = useState("");
  const [logUserId, setLogUserId] = useState("");

  // 生成弹窗与结果
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [vipTiers, setVipTiers] = useState<VipTierConfig[]>([
    { level: 1, name: "VIP 1档", daily: null, weekly: null, monthly: null, total: null },
  ]);
  const [generatedResult, setGeneratedResult] = useState<{
    batchId: string;
    batchName: string;
    items: RedemptionCodeItem[];
  } | null>(null);

  const [form] = Form.useForm<{
    mode: "single_batch" | "shared";
    batchName: string;
    count: number;
    prefix: string;
    customCode: string;
    rewardType: RedemptionRewardType;
    rewardAmount: number;
    vipLevel: number;
    maxUses: number;
    expiresAt: dayjs.Dayjs | null;
    remark: string;
  }>();

  const watchMode = Form.useWatch("mode", form) ?? "single_batch";
  const watchRewardType = Form.useWatch("rewardType", form) ?? "extra_downloads";

  const loadBatches = useCallback(async () => {
    setBatchesLoading(true);
    try {
      const data = await fetchRedemptionBatches({
        keyword: batchKeyword.trim() || undefined,
        rewardType: batchRewardType === "all" ? undefined : batchRewardType,
        offset: (batchesPage - 1) * 15,
        limit: 15,
      });
      setBatches(data.list);
      setBatchesTotal(data.total);
      setSelectedBatch((prev) => {
        if (pendingSelectBatchId) {
          const hit = data.list.find((b) => b.batchId === pendingSelectBatchId);
          if (hit) return hit;
        }
        if (prev) {
          const refreshed = data.list.find((b) => b.batchId === prev.batchId);
          if (refreshed) return refreshed;
        }
        return data.list[0] ?? null;
      });
      if (pendingSelectBatchId) {
        setPendingSelectBatchId(null);
      }
    } catch (err) {
      message.error(err instanceof Error ? err.message : "加载批次列表失败");
    } finally {
      setBatchesLoading(false);
    }
  }, [batchKeyword, batchRewardType, batchesPage, pendingSelectBatchId]);

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const data = await fetchRedemptionLogs({
        keyword: logKeyword.trim() || undefined,
        userId: logUserId.trim() || undefined,
        offset: (logsPage - 1) * 20,
        limit: 20,
      });
      setLogs(data.list);
      setLogsTotal(data.total);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "加载兑换记录失败");
    } finally {
      setLogsLoading(false);
    }
  }, [logKeyword, logUserId, logsPage]);

  useEffect(() => {
    if (viewMode === "batch") {
      void loadBatches();
    }
  }, [loadBatches, viewMode, refreshSignal]);

  useEffect(() => {
    if (activeTab === "logs") {
      void loadLogs();
    }
  }, [activeTab, loadLogs]);

  const openCreateModal = () => {
    form.setFieldsValue({
      mode: "single_batch",
      batchName: "",
      count: 10,
      prefix: "PM",
      customCode: "",
      rewardType: "extra_downloads",
      rewardAmount: 20,
      vipLevel: 1,
      maxUses: 100,
      expiresAt: null,
      remark: "",
    });
    setCreateOpen(true);
    fetchTierPolicies()
      .then((res) => {
        if (res.vipTiers.length > 0) setVipTiers(res.vipTiers);
      })
      .catch(() => undefined);
  };

  const handleCreateSubmit = async () => {
    const values = await form.validateFields();
    setCreating(true);
    try {
      const res = await createRedemptionCodesBatch({
        mode: values.mode,
        batchName: values.batchName?.trim() || undefined,
        count: values.mode === "single_batch" ? values.count : 1,
        prefix: values.prefix?.trim() || undefined,
        customCode: values.mode === "shared" ? values.customCode?.trim() || undefined : undefined,
        rewardType: values.rewardType,
        rewardAmount: values.rewardAmount,
        vipLevel: values.rewardType === "vip" ? values.vipLevel : 1,
        maxUses: values.mode === "shared" ? values.maxUses : 1,
        expiresAt: values.expiresAt ? values.expiresAt.valueOf() : null,
        remark: values.remark?.trim() || "",
      });
      message.success(`成功生成 ${res.items.length} 个兑换码`);
      setCreateOpen(false);
      setGeneratedResult(res);
      setPendingSelectBatchId(res.batchId);
      setBatchesPage(1);
      setRefreshSignal((s) => s + 1);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "生成兑换码失败");
    } finally {
      setCreating(false);
    }
  };

  const handleRenameSubmit = async () => {
    if (!renamingBatch) return;
    const clean = renameInput.trim();
    if (!clean) {
      message.warning("请输入批次名称");
      return;
    }
    setRenamingSaving(true);
    try {
      const updated = await renameRedemptionBatch(renamingBatch.batchId, clean);
      message.success("批次名称已更新");
      setRenamingBatch(null);
      setSelectedBatch((prev) =>
        prev && prev.batchId === updated.batchId ? { ...prev, batchName: updated.batchName } : prev,
      );
      setRefreshSignal((s) => s + 1);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "重命名失败");
    } finally {
      setRenamingSaving(false);
    }
  };

  const handleCopyText = async (text: string, tip: string) => {
    try {
      await navigator.clipboard.writeText(text);
      message.success(tip);
    } catch {
      message.error("复制失败，请手动复制");
    }
  };

  const handleLocateBatch = (batchId: string) => {
    setBatchKeyword(batchId);
    setBatchesPage(1);
    setPendingSelectBatchId(batchId);
    setViewMode("batch");
  };

  const batchColumns: ColumnsType<RedemptionBatchSummary> = [
    {
      title: "批次名称 / 奖励",
      render: (_v, row) => (
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-1">
            <span className="font-semibold text-sm text-slate-800 truncate max-w-[180px]">
              {row.batchName || `未命名批次 (${row.batchId.slice(0, 6)})`}
            </span>
            <Button
              size="small"
              type="text"
              icon={<EditOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                setRenamingBatch(row);
                setRenameInput(row.batchName);
              }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {renderRedemptionRewardTag(row.rewardType, row.rewardAmount, row.vipLevel)}
            <Tag color={row.isSharedMode ? "purple" : "blue"} className="!mr-0">
              {row.isSharedMode ? "通用码" : `${row.totalCount} 码`}
            </Tag>
          </div>
          <div className="text-[11px] text-slate-400">
            核销 {row.totalUsedCount}/{row.totalMaxUses} 次 · 启用 {row.enabledCount}/{row.totalCount} ·{" "}
            {formatTs(row.createdAt)}
          </div>
        </div>
      ),
    },
  ];

  const logColumns: ColumnsType<RedemptionLogItem> = [
    {
      title: "兑换码",
      dataIndex: "code",
      width: 180,
      render: (code: string) => <Text code>{code}</Text>,
    },
    {
      title: "用户",
      render: (_v, row) => (
        <div>
          <div className="text-sm font-medium text-slate-800">{row.username || row.userId}</div>
          <div className="text-xs text-slate-400">{row.userEmail || row.userId}</div>
        </div>
      ),
    },
    {
      title: "兑换奖励",
      width: 170,
      render: (_v, row) => renderRedemptionRewardTag(row.rewardType, row.rewardAmount, row.vipLevel),
    },
    {
      title: "兑换时间",
      width: 160,
      render: (_v, row) => <span className="text-xs text-slate-500">{formatTs(row.createdAt)}</span>,
    },
  ];

  // 若在左侧批次搜索框输入了类似兑换码的关键词（不含空格且 >=4 位），自动同步给右侧便于直查定位
  const looksLikeCodeQuery = batchKeyword.trim().length >= 4 && !/\s/.test(batchKeyword.trim())
    ? batchKeyword.trim()
    : "";

  return (
    <div className="space-y-4">
      <Card className={glassCardClasses}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: "codes",
              label: "兑换码管理",
              children: (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Segmented
                      value={viewMode}
                      onChange={(val) => setViewMode(val as "batch" | "all")}
                      options={[
                        { label: "按批次管理（推荐）", value: "batch" },
                        { label: "全部兑换码（按码直查）", value: "all" },
                      ]}
                    />
                    <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
                      生成兑换码
                    </Button>
                  </div>

                  {viewMode === "batch" ? (
                    <Row gutter={[16, 16]}>
                      <Col xs={24} lg={9} xl={8}>
                        <div className="space-y-3 rounded-xl border border-slate-100 bg-white/70 p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Input
                              allowClear
                              placeholder="搜批次名 / 兑换码定位批次 / 备注"
                              prefix={<SearchOutlined />}
                              value={batchKeyword}
                              onChange={(e) => {
                                setBatchesPage(1);
                                setBatchKeyword(e.target.value);
                              }}
                              className="flex-1 min-w-[180px]"
                            />
                            <Select
                              value={batchRewardType}
                              onChange={(v) => {
                                setBatchesPage(1);
                                setBatchRewardType(v);
                              }}
                              className="w-28"
                              options={[
                                { value: "all", label: "全部奖励" },
                                { value: "extra_downloads", label: "额外次数" },
                                { value: "vip", label: "VIP 时长" },
                              ]}
                            />
                            <Button
                              icon={<ReloadOutlined />}
                              loading={batchesLoading}
                              onClick={() => void loadBatches()}
                            />
                          </div>

                          <Table
                            rowKey="batchId"
                            size="small"
                            showHeader={false}
                            loading={batchesLoading}
                            columns={batchColumns}
                            dataSource={batches}
                            onRow={(record) => ({
                              onClick: () => setSelectedBatch(record),
                              className: `cursor-pointer ${
                                selectedBatch?.batchId === record.batchId ? "bg-blue-50/90" : ""
                              }`,
                            })}
                            pagination={{
                              current: batchesPage,
                              pageSize: 15,
                              total: batchesTotal,
                              size: "small",
                              onChange: setBatchesPage,
                              showSizeChanger: false,
                              showTotal: (t) => `${t} 批`,
                            }}
                          />
                        </div>
                      </Col>

                      <Col xs={24} lg={15} xl={16}>
                        <RedemptionCodeTable
                          mode="batch"
                          batch={selectedBatch}
                          externalSearchKeyword={looksLikeCodeQuery}
                          refreshSignal={refreshSignal}
                          onDataMutated={() => setRefreshSignal((s) => s + 1)}
                          onOpenRenameBatch={(b) => {
                            setRenamingBatch(b);
                            setRenameInput(b.batchName);
                          }}
                        />
                      </Col>
                    </Row>
                  ) : (
                    <RedemptionCodeTable
                      mode="all"
                      refreshSignal={refreshSignal}
                      onDataMutated={() => setRefreshSignal((s) => s + 1)}
                      onLocateBatch={handleLocateBatch}
                    />
                  )}
                </div>
              ),
            },
            {
              key: "logs",
              label: "兑换记录",
              children: (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      allowClear
                      placeholder="搜索兑换码 / 用户名 / 邮箱"
                      prefix={<SearchOutlined />}
                      value={logKeyword}
                      onChange={(e) => {
                        setLogsPage(1);
                        setLogKeyword(e.target.value);
                      }}
                      className="w-64"
                    />
                    <Input
                      allowClear
                      placeholder="按用户 ID 精确过滤"
                      value={logUserId}
                      onChange={(e) => {
                        setLogsPage(1);
                        setLogUserId(e.target.value);
                      }}
                      className="w-52"
                    />
                    <Button icon={<ReloadOutlined />} loading={logsLoading} onClick={() => void loadLogs()}>
                      刷新
                    </Button>
                  </div>
                  <Table
                    rowKey="id"
                    loading={logsLoading}
                    columns={logColumns}
                    dataSource={logs}
                    scroll={{ x: 700 }}
                    pagination={{
                      current: logsPage,
                      pageSize: 20,
                      total: logsTotal,
                      onChange: setLogsPage,
                      showTotal: (t) => `共 ${t} 条`,
                    }}
                  />
                </div>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        open={createOpen}
        title="生成兑换码"
        onCancel={() => setCreateOpen(false)}
        onOk={() => void handleCreateSubmit()}
        confirmLoading={creating}
        okText="立即生成"
        cancelText="取消"
        width={540}
      >
        <Form form={form} layout="vertical" className="pt-2">
          <Form.Item name="batchName" label="批次名称（强烈建议填写，方便后续按批查找）">
            <Input maxLength={80} placeholder="如：开服福利 / 群活动补发" />
          </Form.Item>

          <Form.Item name="mode" label="生成模式">
            <Radio.Group optionType="button" buttonStyle="solid">
              <Radio.Button value="single_batch">批量唯一码（一码一用）</Radio.Button>
              <Radio.Button value="shared">通用口令码（多人可领，每人限 1 次）</Radio.Button>
            </Radio.Group>
          </Form.Item>

          {watchMode === "single_batch" ? (
            <div className="grid grid-cols-2 gap-3">
              <Form.Item
                name="count"
                label="生成数量"
                rules={[{ required: true, message: "请输入数量" }]}
              >
                <InputNumber min={1} max={500} precision={0} className="w-full" />
              </Form.Item>
              <Form.Item name="prefix" label="兑换码前缀（可选）">
                <Input maxLength={12} placeholder="如 PM" />
              </Form.Item>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Form.Item
                name="customCode"
                label="自定义兑换码"
                rules={[{ required: true, message: "请输入自定义口令码" }]}
              >
                <Input maxLength={32} placeholder="如 PISAVIP2026" />
              </Form.Item>
              <Form.Item
                name="maxUses"
                label="总可兑换次数上限"
                rules={[{ required: true, message: "请输入上限" }]}
              >
                <InputNumber min={1} max={10000000} precision={0} className="w-full" />
              </Form.Item>
            </div>
          )}

          <Form.Item name="rewardType" label="奖励类型">
            <Radio.Group>
              <Radio value="extra_downloads">额外下载次数（永久有效）</Radio>
              <Radio value="vip">VIP 时长（叠加大/升档）</Radio>
            </Radio.Group>
          </Form.Item>

          <div className="grid grid-cols-2 gap-3">
            <Form.Item
              name="rewardAmount"
              label={watchRewardType === "vip" ? "赠送 VIP 天数" : "赠送下载次数"}
              rules={[{ required: true, message: "请输入数值" }]}
            >
              <InputNumber
                min={1}
                max={watchRewardType === "vip" ? 36500 : 1000000}
                precision={0}
                addonAfter={watchRewardType === "vip" ? "天" : "次"}
                className="w-full"
              />
            </Form.Item>

            {watchRewardType === "vip" && (
              <Form.Item
                name="vipLevel"
                label="赋予 VIP 档位（隐藏）"
                rules={[{ required: true, message: "请选择档位" }]}
              >
                <Select
                  options={vipTiers.map((t) => ({
                    value: t.level,
                    label: `Lv${t.level} · ${t.name}`,
                  }))}
                />
              </Form.Item>
            )}
          </div>

          <Form.Item name="expiresAt" label="兑换码截止时间（留空则不过期）">
            <DatePicker showTime className="w-full" placeholder="选择过期时间（可选）" />
          </Form.Item>

          <Form.Item name="remark" label="备注说明">
            <Input maxLength={120} placeholder="补充说明（可选）" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={Boolean(renamingBatch)}
        title="修改批次名称"
        onCancel={() => setRenamingBatch(null)}
        onOk={() => void handleRenameSubmit()}
        confirmLoading={renamingSaving}
        okText="保存"
        cancelText="取消"
        width={420}
      >
        <div className="space-y-2 pt-2">
          <div className="text-xs text-slate-400 font-mono">
            批次 ID: {renamingBatch?.batchId}
          </div>
          <Input
            maxLength={80}
            value={renameInput}
            onChange={(e) => setRenameInput(e.target.value)}
            placeholder="请输入新的批次名称，如：开服福利"
            onPressEnter={() => void handleRenameSubmit()}
          />
        </div>
      </Modal>

      <Modal
        open={Boolean(generatedResult)}
        title={`已生成 ${generatedResult?.items.length ?? 0} 个兑换码${
          generatedResult?.batchName ? `（${generatedResult.batchName}）` : ""
        }`}
        onCancel={() => setGeneratedResult(null)}
        footer={[
          <Button
            key="copy"
            type="primary"
            icon={<CopyOutlined />}
            onClick={() =>
              void handleCopyText(
                generatedResult?.items.map((c) => c.code).join("\n") ?? "",
                "已复制全部兑换码",
              )
            }
          >
            复制全部
          </Button>,
          <Button key="close" onClick={() => setGeneratedResult(null)}>
            关闭
          </Button>,
        ]}
      >
        <Space direction="vertical" className="w-full" size={8}>
          <div className="text-xs text-slate-500 font-mono">批次 ID: {generatedResult?.batchId}</div>
          <Input.TextArea
            readOnly
            rows={Math.min(12, Math.max(4, generatedResult?.items.length ?? 4))}
            value={generatedResult?.items.map((c) => c.code).join("\n") ?? ""}
            className="font-mono text-xs"
          />
        </Space>
      </Modal>
    </div>
  );
}
