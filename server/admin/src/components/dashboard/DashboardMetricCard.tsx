export interface DashboardMetricCardProps {
  label: string;
  value: number | string;
  hint?: string;
  accentColor?: string;
  badge?: string;
  isBytes?: boolean;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const idx = Math.min(i, units.length - 1);
  const formatted = (bytes / Math.pow(1024, idx)).toFixed(idx === 0 ? 0 : 1);
  return `${formatted} ${units[idx]}`;
}

export default function DashboardMetricCard({
  label,
  value,
  hint,
  accentColor,
  badge,
  isBytes,
}: DashboardMetricCardProps) {
  let displayValue = typeof value === "number" ? new Intl.NumberFormat("zh-CN").format(value) : value;
  if (isBytes && typeof value === "number") {
    displayValue = formatBytes(value);
  }

  return (
    <div className="min-w-0 rounded-2xl sm:rounded-3xl border border-white/60 bg-white/60 p-4 sm:p-5 lg:p-6 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-shadow duration-300">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-bold tracking-wider text-slate-500 uppercase">
          {label}
        </span>
        {badge ? (
          <span
            className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold"
            style={{
              backgroundColor: accentColor ? `${accentColor}18` : "#0ea5e918",
              color: accentColor || "#0ea5e9",
            }}
          >
            {badge}
          </span>
        ) : null}
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span
          className="truncate font-display text-2xl font-extrabold tracking-tight sm:text-3xl"
          style={accentColor ? { color: accentColor } : { color: "#0f172a" }}
        >
          {displayValue}
        </span>
      </div>

      {hint ? (
        <p className="mt-1.5 truncate text-xs font-semibold text-slate-400">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
