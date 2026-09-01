import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fetchAdminDashboard } from "../../api/client";
import type {
  AdminDashboardData,
  DashboardRangeDays,
} from "../../types/dashboard";
import DashboardChartTooltip from "../dashboard/DashboardChartTooltip";
import DashboardMetricCard, { formatBytes } from "../dashboard/DashboardMetricCard";
import DashboardTrendCard from "../dashboard/DashboardTrendCard";

interface DashboardTabProps {
  themeColor: string;
}

const RANGE_OPTIONS: Array<{ label: string; value: DashboardRangeDays }> = [
  { label: "近 7 天", value: 7 },
  { label: "近 30 天", value: 30 },
  { label: "近 90 天", value: 90 },
];

const PLATFORM_COLORS: Record<string, string> = {
  Android: "#22c55e",
  PC: "#0ea5e9",
};

export default function DashboardTab({ themeColor }: DashboardTabProps) {
  const [rangeDays, setRangeDays] = useState<DashboardRangeDays>(30);
  const [refreshKey, setRefreshKey] = useState(0);
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [reducedMotion] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  });

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    void fetchAdminDashboard(rangeDays, controller.signal)
      .then((res) => {
        setData(res);
      })
      .catch((reason) => {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : "加载失败");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [rangeDays, refreshKey]);

  const shortDate = useMemo(
    () => (dateStr: string) => (dateStr.length >= 10 ? dateStr.slice(5) : dateStr),
    [],
  );

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Top Header & Range Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800 sm:text-2xl tracking-tight">运营概览</h2>
          <p className="text-xs font-semibold text-slate-400 mt-1">
            时区：Asia/Shanghai（UTC+8）
            {data?.generatedAt ? ` · 更新于 ${new Date(data.generatedAt).toLocaleTimeString("zh-CN")}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Range Selector */}
          <div className="inline-flex rounded-2xl border border-white/60 bg-white/70 p-1 shadow-sm backdrop-blur-md">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRangeDays(opt.value)}
                style={rangeDays === opt.value ? { backgroundColor: themeColor, color: "#fff" } : {}}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                  rangeDays === opt.value ? "shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => setRefreshKey((k) => k + 1)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-2xl border border-white/60 bg-white/80 px-4 py-2 text-xs font-bold text-slate-700 shadow-sm transition-all hover:bg-white disabled:opacity-50"
          >
            <svg
              className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            <span>刷新</span>
          </button>
        </div>
      </div>

      {/* Error state */}
      {error ? (
        <div className="rounded-2xl sm:rounded-3xl border border-rose-200 bg-rose-50/80 p-5 text-rose-800 shadow-sm backdrop-blur-md">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-bold">加载仪表盘数据失败</p>
              <p className="mt-1 text-xs opacity-80">{error}</p>
            </div>
            <button
              type="button"
              onClick={() => setRefreshKey((k) => k + 1)}
              className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow transition hover:bg-rose-700"
            >
              重试
            </button>
          </div>
        </div>
      ) : null}

      {/* Loading state initial skeleton */}
      {!data && loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-28 rounded-2xl border border-white/60 bg-white/40 p-4 backdrop-blur-xl animate-pulse"
            />
          ))}
        </div>
      ) : null}

      {data ? (
        <>
          {/* Section 1: Core 8 Metric Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <DashboardMetricCard
              label="用户总数"
              value={data.summary.totalUsers}
              hint={`今日新增 +${data.summary.newUsersToday}`}
              accentColor={themeColor}
            />
            <DashboardMetricCard
              label="7 日新增用户"
              value={data.summary.newUsers7d}
              hint={`7 日登录用户 ${data.summary.loggedInUsers7d}`}
              accentColor="#8b5cf6"
            />
            <DashboardMetricCard
              label="设备总数"
              value={data.summary.totalDevices}
              hint={`Android ${data.summary.androidDevices} / PC ${data.summary.desktopDevices}`}
              accentColor="#0ea5e9"
            />
            <DashboardMetricCard
              label="7 日活跃设备"
              value={data.summary.activeDevices7d}
              hint="Android + PC 活跃去重"
              accentColor="#10b981"
            />
            <DashboardMetricCard
              label="今日官网访客"
              value={data.summary.siteVisitsToday}
              hint="自然日去重 UV"
              accentColor="#f59e0b"
            />
            <DashboardMetricCard
              label="7 日官网访客"
              value={data.summary.siteVisits7d}
              hint="7 日各日 UV 合计"
              accentColor="#f97316"
            />
            <DashboardMetricCard
              label="今日官网下载"
              value={data.summary.downloadsToday}
              hint="官网重定向次数"
              accentColor="#ec4899"
            />
            <DashboardMetricCard
              label="7 日官网下载"
              value={data.summary.downloads7d}
              hint={`下载转化率 ${data.summary.downloadConversion7d}%`}
              accentColor="#06b6d4"
            />
          </div>

          {/* Section 2: Four Trend Charts */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Chart 1: User Growth */}
            <DashboardTrendCard
              title="用户增长趋势"
              description="每日新增注册用户与累计用户"
              extra={
                <div className="flex items-center gap-3 text-xs font-semibold text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: themeColor }} />
                    <span>新增用户</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-purple-500" />
                    <span>累计用户</span>
                  </div>
                </div>
              }
            >
              <AreaChart
                data={data.daily}
                accessibilityLayer
                margin={{ top: 8, right: 12, left: -16, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.45} />
                <XAxis
                  dataKey="date"
                  tickFormatter={shortDate}
                  minTickGap={24}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                />
                <YAxis yAxisId="left" allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                />
                <Tooltip content={<DashboardChartTooltip />} />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="newUsers"
                  name="newUsers"
                  stroke={themeColor}
                  fill={themeColor}
                  fillOpacity={0.15}
                  strokeWidth={2}
                  isAnimationActive={!reducedMotion}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="totalUsers"
                  name="totalUsers"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={!reducedMotion}
                />
              </AreaChart>
            </DashboardTrendCard>

            {/* Chart 2: Device Activity */}
            <DashboardTrendCard
              title="设备增长与活跃"
              description="每日新设备与每日活跃设备"
              extra={
                <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-500">
                  <div className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-sm bg-emerald-500" />
                    <span>Android 新增</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-sm bg-sky-500" />
                    <span>PC 新增</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-emerald-600" />
                    <span>Android 活跃</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-sky-600" />
                    <span>PC 活跃</span>
                  </div>
                </div>
              }
            >
              <ComposedChart
                data={data.daily}
                accessibilityLayer
                margin={{ top: 8, right: 12, left: -16, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.45} />
                <XAxis
                  dataKey="date"
                  tickFormatter={shortDate}
                  minTickGap={24}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} />
                <Tooltip content={<DashboardChartTooltip />} />
                <Bar
                  dataKey="newAndroidDevices"
                  name="newAndroidDevices"
                  fill="#22c55e"
                  radius={[3, 3, 0, 0]}
                  isAnimationActive={!reducedMotion}
                />
                <Bar
                  dataKey="newDesktopDevices"
                  name="newDesktopDevices"
                  fill="#0ea5e9"
                  radius={[3, 3, 0, 0]}
                  isAnimationActive={!reducedMotion}
                />
                <Line
                  type="monotone"
                  dataKey="activeAndroidDevices"
                  name="activeAndroidDevices"
                  stroke="#16a34a"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={!reducedMotion}
                />
                <Line
                  type="monotone"
                  dataKey="activeDesktopDevices"
                  name="activeDesktopDevices"
                  stroke="#0284c7"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={!reducedMotion}
                />
              </ComposedChart>
            </DashboardTrendCard>

            {/* Chart 3: Downloads */}
            <DashboardTrendCard
              title="官网下载趋势"
              description="每日通过官网进入服务端的下载重定向次数"
              extra={
                <div className="flex items-center gap-3 text-xs font-semibold text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-sm bg-emerald-500" />
                    <span>Android</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-sm bg-sky-500" />
                    <span>PC</span>
                  </div>
                </div>
              }
            >
              <BarChart
                data={data.daily}
                accessibilityLayer
                margin={{ top: 8, right: 12, left: -16, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.45} />
                <XAxis
                  dataKey="date"
                  tickFormatter={shortDate}
                  minTickGap={24}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} />
                <Tooltip content={<DashboardChartTooltip />} />
                <Bar
                  dataKey="androidDownloads"
                  name="androidDownloads"
                  stackId="dl"
                  fill="#22c55e"
                  isAnimationActive={!reducedMotion}
                />
                <Bar
                  dataKey="desktopDownloads"
                  name="desktopDownloads"
                  stackId="dl"
                  fill="#0ea5e9"
                  radius={[3, 3, 0, 0]}
                  isAnimationActive={!reducedMotion}
                />
              </BarChart>
            </DashboardTrendCard>

            {/* Chart 4: Site Visits */}
            <DashboardTrendCard
              title="官网访问量趋势"
              description="每日按上海自然日去重的官网访客 UV"
              extra={
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: themeColor }} />
                  <span>独立访客 (UV)</span>
                </div>
              }
            >
              <AreaChart
                data={data.daily}
                accessibilityLayer
                margin={{ top: 8, right: 12, left: -16, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.45} />
                <XAxis
                  dataKey="date"
                  tickFormatter={shortDate}
                  minTickGap={24}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} />
                <Tooltip content={<DashboardChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="siteVisits"
                  name="siteVisits"
                  stroke={themeColor}
                  fill={themeColor}
                  fillOpacity={0.2}
                  strokeWidth={2}
                  isAnimationActive={!reducedMotion}
                />
              </AreaChart>
            </DashboardTrendCard>
          </div>

          {/* Section 3: Operations & Health Indicators */}
          <div className="rounded-2xl border border-white/60 bg-white/60 p-4 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <h3 className="text-base font-extrabold text-slate-800 sm:text-lg tracking-tight mb-4">
              运营健康与资源规模
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <div className="rounded-2xl border border-white/70 bg-white/50 p-3.5 backdrop-blur-sm">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">待处理反馈</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xl font-extrabold text-slate-800">{data.summary.pendingFeedback}</span>
                  {data.summary.pendingFeedback > 0 ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                      待处理
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="rounded-2xl border border-white/70 bg-white/50 p-3.5 backdrop-blur-sm">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">待处理故障</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xl font-extrabold text-slate-800">{data.summary.pendingFaultReports}</span>
                  {data.summary.pendingFaultReports > 0 ? (
                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                      待排查
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="rounded-2xl border border-white/70 bg-white/50 p-3.5 backdrop-blur-sm">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">有效分享</p>
                <div className="mt-2">
                  <span className="text-xl font-extrabold text-slate-800">{data.summary.validShares}</span>
                  <p className="text-[10px] font-semibold text-slate-400 mt-0.5">
                    访问 {data.summary.shareAccesses} 次
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-white/70 bg-white/50 p-3.5 backdrop-blur-sm">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">云端同步条目</p>
                <div className="mt-2">
                  <span className="text-xl font-extrabold text-slate-800">
                    {new Intl.NumberFormat("zh-CN").format(data.summary.syncedLibraryItems)}
                  </span>
                  <p className="text-[10px] font-semibold text-slate-400 mt-0.5">收藏与歌单</p>
                </div>
              </div>

              <div className="rounded-2xl border border-white/70 bg-white/50 p-3.5 backdrop-blur-sm">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">已上传文件</p>
                <div className="mt-2">
                  <span className="text-xl font-extrabold text-slate-800">{data.summary.uploadedFiles}</span>
                  <p className="text-[10px] font-semibold text-slate-400 mt-0.5">七牛托管</p>
                </div>
              </div>

              <div className="rounded-2xl border border-white/70 bg-white/50 p-3.5 backdrop-blur-sm">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">存储总占用</p>
                <div className="mt-2">
                  <span className="text-xl font-extrabold text-slate-800">
                    {formatBytes(data.summary.uploadedFileBytes)}
                  </span>
                  <p className="text-[10px] font-semibold text-slate-400 mt-0.5">安装包与更新</p>
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Distributions */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Platform Pie */}
            <DashboardTrendCard
              title="设备平台占比"
              description="Android 与 PC 累计设备占比"
              heightClass="h-[220px]"
            >
              <PieChart accessibilityLayer margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <Pie
                  data={data.distributions.devicePlatforms}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="value"
                  nameKey="name"
                  isAnimationActive={!reducedMotion}
                >
                  {data.distributions.devicePlatforms.map((entry) => (
                    <Cell key={entry.name} fill={PLATFORM_COLORS[entry.name] || "#94a3b8"} />
                  ))}
                </Pie>
                <Tooltip content={<DashboardChartTooltip />} />
              </PieChart>
            </DashboardTrendCard>

            {/* Android Versions */}
            <DashboardTrendCard
              title="Android 版本分布"
              description="TOP 6 版本分布"
              heightClass="h-[220px]"
            >
              {data.distributions.androidVersions.length > 0 ? (
                <BarChart
                  data={data.distributions.androidVersions}
                  layout="vertical"
                  accessibilityLayer
                  margin={{ top: 4, right: 16, left: 16, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.45} horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: "#64748b" }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 10, fill: "#64748b" }}
                    width={55}
                  />
                  <Tooltip content={<DashboardChartTooltip />} />
                  <Bar dataKey="value" name="count" fill="#22c55e" radius={[0, 4, 4, 0]} isAnimationActive={!reducedMotion} />
                </BarChart>
              ) : (
                <div className="flex h-full items-center justify-center text-xs font-semibold text-slate-400">
                  暂无 Android 版本数据
                </div>
              )}
            </DashboardTrendCard>

            {/* Desktop Versions */}
            <DashboardTrendCard
              title="PC 版本分布"
              description="TOP 6 版本分布"
              heightClass="h-[220px]"
            >
              {data.distributions.desktopVersions.length > 0 ? (
                <BarChart
                  data={data.distributions.desktopVersions}
                  layout="vertical"
                  accessibilityLayer
                  margin={{ top: 4, right: 16, left: 16, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.45} horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: "#64748b" }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 10, fill: "#64748b" }}
                    width={55}
                  />
                  <Tooltip content={<DashboardChartTooltip />} />
                  <Bar dataKey="value" name="count" fill="#0ea5e9" radius={[0, 4, 4, 0]} isAnimationActive={!reducedMotion} />
                </BarChart>
              ) : (
                <div className="flex h-full items-center justify-center text-xs font-semibold text-slate-400">
                  暂无 PC 版本数据
                </div>
              )}
            </DashboardTrendCard>
          </div>
        </>
      ) : null}
    </div>
  );
}
