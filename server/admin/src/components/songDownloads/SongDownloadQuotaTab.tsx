import { useCallback, useEffect, useState } from "react";
import { Button, Card, Col, Input, InputNumber, Row, Select, Space, Switch, Table, Tag, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { EditOutlined, ReloadOutlined, SaveOutlined, SearchOutlined } from "@ant-design/icons";
import {
  fetchDefaultDownloadQuota,
  fetchQuotaStates,
  fetchSubjectQuotaDetail,
  saveDefaultDownloadQuota,
} from "../../api/songDownloads";
import { glassCardClasses } from "../../constants/theme";
import type { AdminQuotaStateItem, QuotaDimensionSnapshot, QuotaLimits } from "../../types/songDownloads";
import QuotaOverrideModal from "./QuotaOverrideModal";

function formatDim(dim: QuotaDimensionSnapshot): string {
  if (dim.limit === null) return `已用 ${dim.used} / 不限`;
  return `余 ${dim.remaining} / ${dim.limit}（用 ${dim.used}）`;
}

export default function SongDownloadQuotaTab() {
  const [defaults, setDefaults] = useState<QuotaLimits>({
    daily: null,
    weekly: null,
    monthly: null,
    total: 999999,
  });
  const [savingDefaults, setSavingDefaults] = useState(false);

  const [subjectType, setSubjectType] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<AdminQuotaStateItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingRows, setLoadingRows] = useState(false);

  const [editing, setEditing] = useState<AdminQuotaStateItem | null>(null);
  const [lookupType, setLookupType] = useState<"user" | "device">("user");
  const [lookupKey, setLookupKey] = useState("");

  useEffect(() => {
    fetchDefaultDownloadQuota()
      .then(setDefaults)
      .catch((err) => message.error(err instanceof Error ? err.message : "读取默认配额失败"));
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
      setRows(res.items);
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

  const handleSaveDefaults = async () => {
    setSavingDefaults(true);
    try {
      const saved = await saveDefaultDownloadQuota(defaults);
      setDefaults(saved);
      message.success("全局默认下载配额已保存");
      void loadStates();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSavingDefaults(false);
    }
  };

  const handleLookup = async () => {
    const key = lookupKey.trim();
    if (!key) return message.warning("请输入账号 ID 或设备键（如 android:<id> / desktop:<id>）");
    try {
      const detail = await fetchSubjectQuotaDetail(lookupType, key);
      setEditing(detail);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "查询主体配额失败");
    }
  };

  const renderDefaultField = (key: keyof QuotaLimits, label: string, hint: string) => {
    const val = defaults[key];
    const unlimited = val === null;
    return (
      <Col xs={24} sm={12} lg={6} key={key}>
        <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="font-semibold text-sm text-slate-800">{label}</span>
            <Switch
              size="small"
              checked={!unlimited}
              checkedChildren="限制"
              unCheckedChildren="不限"
              onChange={(checked) =>
                setDefaults((prev) => ({
                  ...prev,
                  [key]: checked ? (key === "total" ? 999999 : 100) : null,
                }))
              }
            />
          </div>
          <div className="text-xs text-slate-400 mb-2">{hint}</div>
          <InputNumber
            min={0}
            max={100000000}
            precision={0}
            disabled={unlimited}
            value={unlimited ? undefined : val}
            placeholder="不限制"
            className="w-full"
            addonAfter="次"
            onChange={(n) =>
              setDefaults((prev) => ({
                ...prev,
                [key]: typeof n === "number" ? Math.max(0, Math.trunc(n)) : 0,
              }))
            }
          />
        </div>
      </Col>
    );
  };

  const columns: ColumnsType<AdminQuotaStateItem> = [
    {
      title: "主体",
      render: (_v, r) => (
        <div>
          <Space size={6}>
            <Tag color={r.subjectType === "user" ? "blue" : "purple"}>
              {r.subjectType === "user" ? "账号" : "设备"}
            </Tag>
            <span className="font-medium text-slate-800">{r.displayName}</span>
            {r.overrideEnabled && <Tag color="gold">独立覆盖</Tag>}
          </Space>
          <div className="font-mono text-xs text-slate-400 mt-0.5">{r.subjectKey}</div>
        </div>
      ),
    },
    { title: "每日", width: 170, render: (_v, r) => <span className="text-xs">{formatDim(r.daily)}</span> },
    { title: "每周", width: 170, render: (_v, r) => <span className="text-xs">{formatDim(r.weekly)}</span> },
    { title: "每月", width: 170, render: (_v, r) => <span className="text-xs">{formatDim(r.monthly)}</span> },
    { title: "总计", width: 170, render: (_v, r) => <span className="text-xs">{formatDim(r.total)}</span> },
    {
      title: "操作",
      width: 100,
      render: (_v, r) => (
        <Button size="small" icon={<EditOutlined />} onClick={() => setEditing(r)}>
          配置
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <Card
        className={glassCardClasses}
        title="全局默认下载配额策略"
        extra={
          <Space wrap>
            <Button
              size="small"
              onClick={() => setDefaults({ daily: 10, weekly: 30, monthly: 100, total: null })}
            >
              预设：仅限周期
            </Button>
            <Button
              size="small"
              onClick={() => setDefaults({ daily: null, weekly: null, monthly: null, total: 999999 })}
            >
              预设：仅限总数(999999)
            </Button>
            <Button
              size="small"
              onClick={() => setDefaults({ daily: null, weekly: null, monthly: null, total: null })}
            >
              预设：双不限
            </Button>
            <Button type="primary" icon={<SaveOutlined />} loading={savingDefaults} onClick={handleSaveDefaults}>
              保存默认策略
            </Button>
          </Space>
        }
      >
        <Row gutter={[12, 12]}>
          {renderDefaultField("daily", "每日上限", "北京时间 0 点刷新")}
          {renderDefaultField("weekly", "每周上限", "北京时间周一 0 点刷新")}
          {renderDefaultField("monthly", "每月上限", "北京时间 1 号 0 点刷新")}
          {renderDefaultField("total", "总次数上限", "累计总限额，不重置")}
        </Row>
      </Card>

      <Card
        className={glassCardClasses}
        title="用户 / 设备配额与用量明细"
        extra={
          <Space wrap>
            <Select
              size="small"
              value={lookupType}
              onChange={setLookupType}
              className="w-24"
              options={[
                { value: "user", label: "账号" },
                { value: "device", label: "设备" },
              ]}
            />
            <Input
              size="small"
              placeholder={lookupType === "user" ? "输入 userId 直接配置" : "输入 android:<id> 或 desktop:<id>"}
              value={lookupKey}
              onChange={(e) => setLookupKey(e.target.value)}
              className="w-56"
            />
            <Button size="small" onClick={handleLookup}>
              按 ID 配置
            </Button>
          </Space>
        }
      >
        <div className="mb-4 flex flex-wrap items-center gap-2">
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

        <Table
          rowKey={(r) => `${r.subjectType}:${r.subjectKey}`}
          loading={loadingRows}
          columns={columns}
          dataSource={rows}
          pagination={{
            current: page,
            pageSize: 20,
            total,
            onChange: setPage,
            showTotal: (t) => `共 ${t} 条`,
          }}
        />
      </Card>

      <QuotaOverrideModal
        open={Boolean(editing)}
        target={editing}
        onClose={() => setEditing(null)}
        onSaved={() => void loadStates()}
      />
    </div>
  );
}
