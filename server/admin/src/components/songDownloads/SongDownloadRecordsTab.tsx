import { useCallback, useEffect, useState } from "react";
import { Button, Card, Input, Select, Space, Table, Tag, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { EyeOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { fetchSongDownloadRecords } from "../../api/songDownloads";
import { glassCardClasses } from "../../constants/theme";
import type { SongDownloadRecordItem } from "../../types/songDownloads";
import { resolveSongCoverUrl } from "../../utils/songCover";
import SongDownloadRecordDetailModal from "./SongDownloadRecordDetailModal";

export default function SongDownloadRecordsTab() {
  const [keyword, setKeyword] = useState("");
  const [source, setSource] = useState("all");
  const [platform, setPlatform] = useState("all");
  const [subjectType, setSubjectType] = useState("all");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<SongDownloadRecordItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [detailRecord, setDetailRecord] = useState<SongDownloadRecordItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchSongDownloadRecords({
        keyword: keyword.trim() || undefined,
        source,
        platform,
        subjectType,
        offset: (page - 1) * 20,
        limit: 20,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "加载下载流水失败");
    } finally {
      setLoading(false);
    }
  }, [keyword, source, platform, subjectType, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: ColumnsType<SongDownloadRecordItem> = [
    {
      title: "时间",
      dataIndex: "createdAt",
      width: 165,
      render: (ts: number) => new Date(ts).toLocaleString("zh-CN"),
    },
    {
      title: "歌曲",
      render: (_v, r) => {
        const coverSrc = resolveSongCoverUrl(r.coverUrl, 240);
        return (
          <div className="flex items-center gap-2.5">
            {coverSrc ? (
              <img src={coverSrc} alt="" className="h-9 w-9 rounded object-cover bg-slate-100" />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded bg-slate-100 text-[10px] text-slate-400">
                无图
              </div>
            )}
            <div className="min-w-0">
              <div className="font-medium text-slate-800 truncate max-w-[220px]">{r.songName}</div>
              <div className="text-xs text-slate-500 truncate max-w-[220px]">{r.singer || "未知歌手"}</div>
            </div>
          </div>
        );
      },
    },
    {
      title: "音源 / 音质",
      width: 150,
      render: (_v, r) => (
        <Space size={4}>
          <Tag>{r.source.toUpperCase()}</Tag>
          <span className="font-mono text-xs text-slate-600">{r.qualityKey}</span>
        </Space>
      ),
    },
    {
      title: "端平台",
      dataIndex: "platform",
      width: 95,
      render: (p: string) => <Tag color={p === "android" ? "green" : "blue"}>{p === "android" ? "Android" : "PC"}</Tag>,
    },
    {
      title: "用户 / 设备",
      render: (_v, r) => (
        <div className="text-xs">
          {r.userId ? (
            <div>
              <Tag color="blue" className="!mr-1">账号</Tag>
              <span className="font-medium text-slate-800">{r.username || r.userId}</span>
            </div>
          ) : (
            <Tag color="purple">游客设备</Tag>
          )}
          <div className="text-slate-400 mt-0.5 truncate max-w-[220px]">
            {r.deviceName || r.deviceId}
          </div>
        </div>
      ),
    },
    {
      title: "批次 ID",
      dataIndex: "batchId",
      width: 140,
      render: (id: string) => <span className="font-mono text-xs text-slate-400">{id.slice(0, 8)}…</span>,
    },
    {
      title: "操作",
      width: 90,
      render: (_v, r) => (
        <Button size="small" icon={<EyeOutlined />} onClick={() => setDetailRecord(r)}>
          详情
        </Button>
      ),
    },
  ];

  return (
    <Card className={glassCardClasses}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          allowClear
          placeholder="搜索歌名 / 歌手 / 用户名 / 设备ID"
          prefix={<SearchOutlined />}
          value={keyword}
          onChange={(e) => {
            setPage(1);
            setKeyword(e.target.value);
          }}
          className="w-64"
        />
        <Select
          value={source}
          onChange={(v) => {
            setPage(1);
            setSource(v);
          }}
          className="w-28"
          options={[
            { value: "all", label: "全部音源" },
            { value: "kg", label: "KG" },
            { value: "wy", label: "WY" },
            { value: "kw", label: "KW" },
            { value: "cloud", label: "Cloud" },
          ]}
        />
        <Select
          value={platform}
          onChange={(v) => {
            setPage(1);
            setPlatform(v);
          }}
          className="w-28"
          options={[
            { value: "all", label: "全部平台" },
            { value: "desktop", label: "PC" },
            { value: "android", label: "Android" },
          ]}
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
            { value: "user", label: "已登录账号" },
            { value: "device", label: "游客设备" },
          ]}
        />
        <Button icon={<ReloadOutlined />} onClick={() => void load()} loading={loading}>
          刷新
        </Button>
      </div>

      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={items}
        pagination={{
          current: page,
          pageSize: 20,
          total,
          onChange: setPage,
          showTotal: (t) => `共 ${t} 条下载记录`,
        }}
      />

      <SongDownloadRecordDetailModal record={detailRecord} onClose={() => setDetailRecord(null)} />
    </Card>
  );
}
