import { useEffect, useState } from "react";
import { Card, Col, Row, Select, Space, Statistic, Table, Tag, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fetchSongDownloadOverview, fetchTopDownloadedSongs } from "../../api/songDownloads";
import { adminCardClasses } from "../../constants/theme";
import type { SongDownloadOverviewStats, TopDownloadedSongItem } from "../../types/songDownloads";
import { resolveSongCoverUrl } from "../../utils/songCover";

const SOURCE_LABELS: Record<string, string> = {
  kg: "酷狗 (KG)",
  wy: "网易云 (WY)",
  kw: "酷我 (KW)",
  cloud: "网盘 (Cloud)",
};

export default function SongDownloadsOverviewTab({ themeColor }: { themeColor: string }) {
  const [days, setDays] = useState<7 | 30 | 90>(7);
  const [topDays, setTopDays] = useState<7 | 30 | 90 | "all">(30);
  const [topSource, setTopSource] = useState<string>("all");
  const [overview, setOverview] = useState<SongDownloadOverviewStats | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);

  const [topSongs, setTopSongs] = useState<TopDownloadedSongItem[]>([]);
  const [topTotal, setTopTotal] = useState(0);
  const [topPage, setTopPage] = useState(1);
  const [loadingTop, setLoadingTop] = useState(false);

  useEffect(() => {
    setLoadingOverview(true);
    fetchSongDownloadOverview(days)
      .then(setOverview)
      .catch((err) => message.error(err instanceof Error ? err.message : "加载下载概览失败"))
      .finally(() => setLoadingOverview(false));
  }, [days]);

  useEffect(() => {
    setLoadingTop(true);
    fetchTopDownloadedSongs({ days: topDays, source: topSource, offset: (topPage - 1) * 15, limit: 15 })
      .then((res) => {
        setTopSongs(res.list);
        setTopTotal(res.total);
      })
      .catch((err) => message.error(err instanceof Error ? err.message : "加载下载排行失败"))
      .finally(() => setLoadingTop(false));
  }, [topDays, topSource, topPage]);

  const columns: ColumnsType<TopDownloadedSongItem> = [
    {
      title: "排名",
      width: 72,
      render: (_v, _r, idx) => <span className="font-mono font-semibold">#{(topPage - 1) * 15 + idx + 1}</span>,
    },
    {
      title: "歌曲",
      render: (_v, r) => {
        const coverSrc = resolveSongCoverUrl(r.coverUrl, 240);
        return (
          <div className="flex items-center gap-3">
            {coverSrc ? (
              <img src={coverSrc} alt="" className="h-10 w-10 rounded-lg object-cover bg-slate-100" />
            ) : (
              <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center text-xs text-slate-400">
                无图
              </div>
            )}
            <div className="min-w-0">
              <div className="font-medium text-slate-800 truncate max-w-[260px]">{r.songName || "未知歌曲"}</div>
              <div className="text-xs text-slate-500 truncate max-w-[260px]">
                {r.singer || "未知歌手"} {r.album ? `· ${r.album}` : ""}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      title: "音源",
      dataIndex: "source",
      width: 110,
      render: (s: string) => <Tag>{SOURCE_LABELS[s] || s.toUpperCase()}</Tag>,
    },
    {
      title: "下载次数",
      dataIndex: "downloadCount",
      width: 110,
      render: (v: number) => <span className="font-semibold text-slate-800">{v}</span>,
    },
    {
      title: "独立用户/设备",
      dataIndex: "uniqueSubjects",
      width: 120,
    },
    {
      title: "最近下载",
      dataIndex: "lastDownloadedAt",
      width: 170,
      render: (ts: number) => (ts ? new Date(ts).toLocaleString("zh-CN") : "-"),
    },
  ];

  return (
    <div className="space-y-4">
      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}>
          <Card bordered={false} className={adminCardClasses} loading={loadingOverview}>
            <Statistic title="今日下载歌曲数" value={overview?.todayDownloads ?? 0} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card bordered={false} className={adminCardClasses} loading={loadingOverview}>
            <Statistic title={`近 ${days} 天下载数`} value={overview?.periodDownloads ?? 0} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card bordered={false} className={adminCardClasses} loading={loadingOverview}>
            <Statistic title="历史累计下载歌曲" value={overview?.totalDownloads ?? 0} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card bordered={false} className={adminCardClasses} loading={loadingOverview}>
            <Statistic title="累计下载批次数" value={overview?.totalBatches ?? 0} />
          </Card>
        </Col>
      </Row>

      <Card
        bordered={false}
        className={adminCardClasses}
        title="下载趋势"
        extra={
          <Select
            value={days}
            onChange={setDays}
            className="w-28"
            options={[
              { value: 7, label: "近 7 天" },
              { value: 30, label: "近 30 天" },
              { value: 90, label: "近 90 天" },
            ]}
          />
        }
      >
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={overview?.trend ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <RechartsTooltip />
              <Area
                type="monotone"
                dataKey="downloads"
                name="下载歌曲数"
                stroke={themeColor}
                fill={themeColor}
                fillOpacity={0.18}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        {overview && (
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
            <span>
              音源分布：
              {overview.bySource.map((s) => `${s.source.toUpperCase()} ${s.count}`).join(" / ") || "暂无"}
            </span>
            <span>·</span>
            <span>
              平台分布：
              {overview.byPlatform.map((p) => `${p.platform} ${p.count}`).join(" / ") || "暂无"}
            </span>
          </div>
        )}
      </Card>

      <Card
        bordered={false}
        className={adminCardClasses}
        title="歌曲下载 Top 排行"
        extra={
          <Space>
            <Select
              value={topDays}
              onChange={(v) => {
                setTopPage(1);
                setTopDays(v);
              }}
              className="w-28"
              options={[
                { value: 7, label: "近 7 天" },
                { value: 30, label: "近 30 天" },
                { value: 90, label: "近 90 天" },
                { value: "all", label: "全部时间" },
              ]}
            />
            <Select
              value={topSource}
              onChange={(v) => {
                setTopPage(1);
                setTopSource(v);
              }}
              className="w-32"
              options={[
                { value: "all", label: "全部音源" },
                { value: "kg", label: "酷狗 (KG)" },
                { value: "wy", label: "网易云 (WY)" },
                { value: "kw", label: "酷我 (KW)" },
                { value: "cloud", label: "网盘 (Cloud)" },
              ]}
            />
          </Space>
        }
      >
        <Table
          rowKey={(r) => `${r.source}:${r.songId}`}
          size="middle"
          bordered
          scroll={{ x: 900 }}
          loading={loadingTop}
          columns={columns}
          dataSource={topSongs}
          pagination={{
            current: topPage,
            pageSize: 15,
            total: topTotal,
            onChange: setTopPage,
            showTotal: (t) => `共 ${t} 首`,
          }}
        />
      </Card>
    </div>
  );
}
