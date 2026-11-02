import { useEffect, useState } from "react";
import { Alert, Descriptions, Modal, Spin, Table, Tabs, Typography } from "antd";
import { fetchShareDetail } from "../../api/appShareRecords";
import type { ShareDetail } from "../../types/appShareRecords";
import ShareTrendTable from "./ShareTrendTable";

export function shareTime(value: number | null): string {
  return value ? new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", dateStyle: "short", timeStyle: "medium", hour12: false }).format(value) : "—";
}
export default function ShareRecordDetail({ id, revision, onClose }: { id: string; revision: number; onClose: () => void }) {
  const [offsets, setOffsets] = useState({ visit: 0, download: 0 });
  const [data, setData] = useState<ShareDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    fetchShareDetail(id, offsets.visit, offsets.download, controller.signal).then(value => {
      if (!controller.signal.aborted) setData(value);
    }).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "加载详情失败"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, offsets, revision]);
  const record = data?.record;
  return <Modal open title="App 推广分享详情" onCancel={onClose} footer={null} width={1100}>
    {error && <Alert type="error" showIcon message={error} />}
    <Spin spinning={loading}><div className="space-y-4 min-h-40">
      {record && <>
        <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }} items={[
          { key: "code", label: "短码 / 状态", children: `${record.code} / ${record.valid ? "有效" : "已失效"}` },
          { key: "user", label: "分享人", children: `${record.userName || (record.userId ? record.userId : "游客")}${record.userMissing ? "（已注销）" : ""}` },
          { key: "device", label: "设备", children: `${record.deviceName || record.deviceKind} · ${record.deviceId}${record.deviceMissing ? "（设备不存在）" : ""}` },
          { key: "created", label: "首次分享", children: shareTime(record.createdAt) },
          { key: "visit", label: "最近访问", children: shareTime(record.lastVisitAt) },
          { key: "download", label: "最近下载", children: shareTime(record.lastDownloadAt) },
          { key: "invalid", label: "失效时间", children: shareTime(record.invalidatedAt) },
          { key: "stats", label: "累计统计", children: `PV ${record.visitCount} / 累计日 UV ${record.visitUv} / 下载触发 ${record.downloadCount}` },
          { key: "url", label: "分享链接", span: 2, children: <Typography.Text copyable className="break-all">{record.url}</Typography.Text> },
        ]} />
        <Alert showIcon type="info" message={`访问与下载明细仅保留最近 ${data.retentionDays} 天，累计计数与日报长期保留。下载触发不代表安装完成，统计不可作为奖励结算依据。`} />
        <Tabs items={[
          { key: "trend", label: "每日趋势", children: <ShareTrendTable items={data.trend} /> },
          { key: "visits", label: `访问明细（${data.visits.total}）`, children: <Table size="small" rowKey="eventId" dataSource={data.visits.items} scroll={{ x: 750 }} pagination={{ current: offsets.visit / 20 + 1, pageSize: 20, total: data.visits.total, showSizeChanger: false, onChange: page => setOffsets(v => ({ ...v, visit: (page - 1) * 20 })) }} columns={[
            { title: "接收时间", dataIndex: "receivedAt", render: shareTime }, { title: "设备", dataIndex: "browserDeviceType" },
            { title: "当日首次访问", dataIndex: "isUniqueForShareDay", render: value => value ? "是" : "否" },
            { title: "来源", dataIndex: "referrerPath", ellipsis: true }, { title: "浏览器", dataIndex: "userAgent", ellipsis: true },
          ]} /> },
          { key: "downloads", label: `下载明细（${data.downloads.total}）`, children: <Table size="small" rowKey="id" dataSource={data.downloads.items} scroll={{ x: 750 }} pagination={{ current: offsets.download / 20 + 1, pageSize: 20, total: data.downloads.total, showSizeChanger: false, onChange: page => setOffsets(v => ({ ...v, download: (page - 1) * 20 })) }} columns={[
            { title: "触发时间", dataIndex: "triggeredAt", render: shareTime }, { title: "平台", dataIndex: "platform", render: value => value === "desktop" ? "Windows" : "Android" },
            { title: "版本", dataIndex: "version" }, { title: "归因方式", dataIndex: "attributionSource", render: value => value === "explicit_code" ? "链接短码" : "7天 Cookie" },
            { title: "来源", dataIndex: "referrerPath", ellipsis: true },
          ]} /> },
        ]} />
      </>}
    </div></Spin>
  </Modal>;
}
