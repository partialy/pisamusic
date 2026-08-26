const SERIES_NAME_MAP: Record<string, string> = {
  newUsers: "新增用户",
  totalUsers: "累计用户",
  newAndroidDevices: "Android 新设备",
  newDesktopDevices: "PC 新设备",
  activeAndroidDevices: "Android 活跃",
  activeDesktopDevices: "PC 活跃",
  siteVisits: "官网访问 UV",
  androidDownloads: "Android 下载",
  desktopDownloads: "PC 下载",
  count: "数量",
  value: "数值",
};

interface TooltipPayloadItem {
  name?: string;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
  stroke?: string;
  fill?: string;
}

export interface DashboardChartTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

export default function DashboardChartTooltip({
  active,
  payload,
  label,
}: DashboardChartTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-white/80 bg-white/95 p-3 shadow-xl backdrop-blur-md text-xs text-slate-700 min-w-[140px] pointer-events-none">
      {label ? (
        <div className="mb-2 border-b border-slate-100 pb-1.5 font-bold text-slate-800 tracking-wide">
          {label}
        </div>
      ) : null}
      <div className="space-y-1.5">
        {payload.map((item, idx) => {
          const key = String(item.dataKey || item.name || "");
          const displayName = (item.name && SERIES_NAME_MAP[item.name]) || SERIES_NAME_MAP[key] || item.name || key;
          const color = item.color || item.stroke || item.fill || "#0ea5e9";
          const rawVal = item.value;
          const formattedVal =
            typeof rawVal === "number" ? new Intl.NumberFormat("zh-CN").format(rawVal) : (rawVal ?? 0);

          return (
            <div key={idx} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5 truncate">
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="truncate text-slate-600 font-medium">{displayName}</span>
              </div>
              <span className="font-extrabold text-slate-900 shrink-0">{formattedVal}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
