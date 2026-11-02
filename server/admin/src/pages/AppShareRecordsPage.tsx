import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button, Card, Col, DatePicker, Input, Modal, Row, Select, Space, Statistic, Switch, Table, Tag, Typography, message } from "antd";
import { DownloadOutlined, ReloadOutlined } from "@ant-design/icons";
import { exportShareRecords, fetchShareRecords, invalidateShareRecord } from "../api/appShareRecords";
import type { ShareFilter, ShareRecord, ShareRecordPage } from "../types/appShareRecords";
import ShareRecordDetail, { shareTime } from "../components/appShare/ShareRecordDetail";
import ShareTrendTable from "../components/appShare/ShareTrendTable";
import { glassCardClasses } from "../constants/theme";

export default function AppShareRecordsPage() {
  const [filter, setFilter] = useState<ShareFilter>({ valid: "all", timeField: "createdAt", sort: "createdAt" });
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<ShareRecordPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [revision, setRevision] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const [messageApi, messageHolder] = message.useMessage();
  const [modal, modalHolder] = Modal.useModal();
  const updateFilter = (values: Partial<ShareFilter>) => { setFilter(v => ({ ...v, ...values })); setOffset(0); };
  const load = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController(); controllerRef.current = controller;
    setLoading(true); setError("");
    try {
      const value = await fetchShareRecords(filter, offset, controller.signal);
      if (!controller.signal.aborted) setData(value);
    } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "加载分享记录失败"); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }, [filter, offset]);
  useEffect(() => { void load(); return () => controllerRef.current?.abort(); }, [load, revision]);
  useEffect(() => {
    if (!autoRefresh) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const reset = () => {
      if (timer) clearInterval(timer);
      if (!document.hidden) timer = setInterval(() => setRevision(v => v + 1), 30000);
    };
    reset(); document.addEventListener("visibilitychange", reset);
    return () => { if (timer) clearInterval(timer); document.removeEventListener("visibilitychange", reset); };
  }, [autoRefresh]);
  const invalidate = (record: ShareRecord) => modal.confirm({
    title: "标记推广链接失效", okText: "确认失效", cancelText: "取消", okButtonProps: { danger: true },
    content: <div className="space-y-2"><p>{record.userName || "游客"} · {record.deviceName || record.deviceKind} · {record.code}</p><p>旧链接停止产生推广统计，历史数据保留且无法恢复。同一身份再次分享会创建新短码。</p></div>,
    onOk: async () => {
      try { await invalidateShareRecord(record.id); setRevision(v => v + 1); void messageApi.success("链接已失效"); }
      catch (e) { void messageApi.error(e instanceof Error ? e.message : "操作失败"); throw e; }
    },
  });
  const summary = data?.summary;
  return <div className="space-y-4">
    {messageHolder}{modalHolder}
    <Alert showIcon type="info" message="访问仅统计 /app-share/ 的有效页面上报；UV 为按北京时间去重的累计日 UV。下载为安装包跳转触发次数，不代表安装、注册或成功邀请。" />
    <Card className={glassCardClasses}>
      <Space wrap className="w-full">
        <Input.Search allowClear placeholder="短码 / 用户名 / 账号 ID / 设备 ID" style={{ width: 270, maxWidth: "100%" }} onSearch={keyword => updateFilter({ keyword })} />
        <Select aria-label="有效状态" value={filter.valid} style={{ width: 120 }} onChange={valid => updateFilter({ valid })} options={[{ value: "all", label: "全部状态" }, { value: "true", label: "有效" }, { value: "false", label: "已失效" }]} />
        <Select aria-label="时间维度" value={filter.timeField} style={{ width: 140 }} onChange={timeField => updateFilter({ timeField })} options={[{ value: "createdAt", label: "首次创建时间" }, { value: "lastVisitAt", label: "最近访问时间" }, { value: "lastDownloadAt", label: "最近下载时间" }]} />
        <DatePicker.RangePicker showTime placeholder={["开始时间", "结束时间"]} onChange={range => updateFilter({ from: range?.[0]?.valueOf(), to: range?.[1]?.valueOf() })} />
        <Select aria-label="排序" value={filter.sort} style={{ width: 145 }} onChange={sort => updateFilter({ sort })} options={[{ value: "createdAt", label: "创建时间倒序" }, { value: "visitCount", label: "访问数倒序" }, { value: "downloadCount", label: "下载触发倒序" }, { value: "lastActiveAt", label: "最近活跃倒序" }]} />
        <Button icon={<ReloadOutlined />} loading={loading} onClick={() => setRevision(v => v + 1)}>刷新</Button>
        <Button icon={<DownloadOutlined />} loading={exporting} onClick={async () => { setExporting(true); try { await exportShareRecords(filter); } catch (e) { void messageApi.error(e instanceof Error ? e.message : "导出失败"); } finally { setExporting(false); } }}>导出 CSV</Button>
        <Space><Switch checked={autoRefresh} onChange={setAutoRefresh} size="small" /><Typography.Text type="secondary">30 秒自动刷新</Typography.Text></Space>
      </Space>
      <Typography.Paragraph type="secondary" className="!mt-3 !mb-0">时间筛选用于选取分享记录（创建 / 最近访问 / 最近下载），汇总和趋势展示命中链接的全历史统计。筛选后的 UV 为各短码累计日 UV 之和；无筛选时才是全站日去重 UV。时间展示为北京时间；范围选择按浏览器本地时间输入。</Typography.Paragraph>
    </Card>
    {error && <Alert type="error" showIcon message={error} />}
    <Row gutter={[12, 12]}>
      {[{ title: "分享链接", value: summary?.total, suffix: summary ? `（有效 ${summary.validCount} / 失效 ${summary.invalidCount}）` : "" },
        { title: "访问 PV", value: summary?.visitCount }, { title: filter.keyword || filter.from || filter.to || filter.valid !== "all" ? "选中短码累计日 UV 之和" : "全站累计日 UV", value: summary?.visitUv },
        { title: "下载触发", value: summary?.downloadCount }, { title: "下载触发 / PV", value: summary?.visitCount ? `${((summary.downloadCount / summary.visitCount) * 100).toFixed(1)}%` : "—" },
      ].map(item => <Col key={item.title} xs={24} sm={12} xl={item.title === "分享链接" ? 8 : 4}><Card className={glassCardClasses} size="small"><Statistic title={item.title} value={item.value ?? "—"} suffix={<span className="text-xs">{item.suffix}</span>} /></Card></Col>)}
    </Row>
    <Card title="分享记录" className={glassCardClasses}>
      <Table<ShareRecord> rowKey="id" loading={loading} dataSource={data?.items || []} size="small" scroll={{ x: 1800 }} pagination={{ current: offset / 20 + 1, pageSize: 20, total: data?.total || 0, showSizeChanger: false, showTotal: total => `共 ${total} 条`, onChange: page => setOffset((page - 1) * 20) }} columns={[
        { title: "分享人", width: 170, render: (_, r) => <div><div>{r.userName || (r.userId ? "账号" : "游客")}{r.userMissing && <Tag>已注销</Tag>}</div><Typography.Text type="secondary" className="text-xs">{r.userId || "未登录"}</Typography.Text></div> },
        { title: "设备", width: 170, render: (_, r) => <div>{r.deviceName || r.deviceKind}{r.deviceMissing && <Tag>设备不存在</Tag>}<div className="text-xs text-slate-500" title={r.deviceId}>{r.deviceId.slice(0, 12)}…</div></div> },
        { title: "短码", dataIndex: "code", width: 95 }, { title: "状态", dataIndex: "valid", width: 85, render: valid => <Tag color={valid ? "success" : "default"}>{valid ? "有效" : "已失效"}</Tag> },
        { title: "首次分享", dataIndex: "createdAt", width: 170, render: shareTime }, { title: "最近访问", dataIndex: "lastVisitAt", width: 170, render: shareTime }, { title: "最近下载", dataIndex: "lastDownloadAt", width: 170, render: shareTime },
        { title: "PV", dataIndex: "visitCount", width: 80 }, { title: "累计日 UV", dataIndex: "visitUv", width: 100 },
        { title: "Android 下载", dataIndex: "androidDownloadCount", width: 110 }, { title: "Windows 下载", dataIndex: "desktopDownloadCount", width: 110 }, { title: "总下载触发", dataIndex: "downloadCount", width: 110 },
        { title: "操作", width: 230, fixed: "right", render: (_, record) => <Space size={0}><Button type="link" onClick={() => setDetailId(record.id)}>详情</Button><Button type="link" onClick={async () => { try { await navigator.clipboard.writeText(record.url); void messageApi.success("链接已复制"); } catch { void messageApi.error("复制失败，请从详情复制链接"); } }}>复制链接</Button><Button type="link" danger disabled={!record.valid} onClick={() => invalidate(record)}>失效</Button></Space> },
      ]} />
    </Card>
    <Card title="命中链接的历史每日趋势与平台分布" className={glassCardClasses}><ShareTrendTable items={data?.trend || []} /></Card>
    {detailId && <ShareRecordDetail key={detailId} id={detailId} revision={revision} onClose={() => setDetailId(null)} />}
  </div>;
}
