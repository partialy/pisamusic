import { useEffect, useState } from "react";
import { Alert, Button, Empty, Segmented, Spin, Table, Typography } from "antd";
import { CartesianGrid, Legend, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";
import { fetchWebsiteAnalytics } from "../../api/websiteAnalytics";
import type { WebsiteAnalyticsData } from "../../types/websiteAnalytics";
import DashboardMetricCard from "../dashboard/DashboardMetricCard";
import DashboardTrendCard from "../dashboard/DashboardTrendCard";

type Props = { domain?: string; themeColor: string; refreshKey: number };

export default function WebsiteDomainStats({ domain, themeColor, refreshKey }: Props) {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [data, setData] = useState<WebsiteAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setData(null);
    setError(null);
    void fetchWebsiteAnalytics(days, domain, controller.signal).then((result) => {
      if (!controller.signal.aborted) setData(result);
    }).catch((reason) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "域名统计加载失败");
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [days, domain, refreshKey, retry]);

  const summary = data?.summary;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          aria-label="统计时间范围"
          options={[{ label: "近 7 天", value: 7 }, { label: "近 30 天", value: 30 }, { label: "近 90 天", value: 90 }]}
          value={days}
          onChange={(value) => setDays(value as 7 | 30 | 90)}
        />
        <Typography.Text type="secondary">北京时间 · {data ? `${data.startDay} 至 ${data.endDay}` : "加载中"}</Typography.Text>
      </div>
      <Alert type="info" showIcon message="累计日 UV 按各域名每日访客数相加，同一人跨域或跨天可能重复计算；下载触发次数不代表安装成功。" />
      {error ? <Alert type="error" showIcon message={error} action={<Button onClick={() => setRetry((value) => value + 1)}>重试</Button>} /> : null}
      {loading ? <div className="flex justify-center py-16"><Spin aria-label="正在加载域名统计" /></div> : null}
      {summary && data ? <>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <DashboardMetricCard label="累计日 UV" value={summary.uv} accentColor={themeColor} />
          <DashboardMetricCard label="页面浏览 PV" value={summary.pv} accentColor={themeColor} />
          <DashboardMetricCard label="下载触发" value={summary.downloads} accentColor={themeColor} />
          <DashboardMetricCard label="Android 下载触发" value={summary.androidDownloads} accentColor={themeColor} />
          <DashboardMetricCard label="PC 下载触发" value={summary.desktopDownloads} accentColor={themeColor} />
        </div>
        {data.trend.length ? <DashboardTrendCard title="访问与下载趋势" description="每日 UV、PV 和下载触发次数；无记录日期补零">
          <LineChart data={data.trend} margin={{ top: 8, right: 12, bottom: 0, left: 0 }} accessibilityLayer>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="day" tickFormatter={(day: string) => day.slice(5)} />
            <YAxis allowDecimals={false} width={45} />
            <Tooltip />
            <Legend />
            <Line name="UV" dataKey="uv" stroke={themeColor} dot={false} isAnimationActive={false} />
            <Line name="PV" dataKey="pv" stroke="#0ea5e9" dot={false} isAnimationActive={false} />
            <Line name="下载触发" dataKey="downloads" stroke="#22c55e" dot={false} isAnimationActive={false} />
          </LineChart>
        </DashboardTrendCard> : <Empty description="暂无趋势数据" />}
        <div>
          <Typography.Title level={5}>域名排行与占比</Typography.Title>
          <Table rowKey="domain" size="small" dataSource={data.domains} scroll={{ x: 850 }} pagination={{ pageSize: 10, showSizeChanger: false }} columns={[
            { title: "域名", dataIndex: "domain", ellipsis: true, render: (value: string) => value || "未知域名" },
            { title: "累计日 UV", dataIndex: "uv", align: "right", sorter: (a, b) => a.uv - b.uv, defaultSortOrder: "descend" },
            { title: "UV 占比", key: "uvShare", align: "right", render: (_, row) => `${summary.uv ? (row.uv * 100 / summary.uv).toFixed(1) : "0.0"}%` },
            { title: "PV", dataIndex: "pv", align: "right", sorter: (a, b) => a.pv - b.pv },
            { title: "PV 占比", key: "pvShare", align: "right", render: (_, row) => `${summary.pv ? (row.pv * 100 / summary.pv).toFixed(1) : "0.0"}%` },
            { title: "Android 下载", dataIndex: "androidDownloads", align: "right" },
            { title: "PC 下载", dataIndex: "desktopDownloads", align: "right" },
            { title: "下载触发", dataIndex: "downloads", align: "right" },
            { title: "下载占比", key: "downloadShare", align: "right", render: (_, row) => `${summary.downloads ? (row.downloads * 100 / summary.downloads).toFixed(1) : "0.0"}%` },
          ]} />
        </div>
        <div>
          <Typography.Title level={5}>页面 PV 排行</Typography.Title>
          <Table rowKey="path" size="small" dataSource={data.topPages} pagination={{ pageSize: 10, showSizeChanger: false }} columns={[
            { title: "页面路径", dataIndex: "path", ellipsis: true },
            { title: "PV", dataIndex: "pv", align: "right", width: 120 },
          ]} />
        </div>
      </> : null}
    </div>
  );
}
