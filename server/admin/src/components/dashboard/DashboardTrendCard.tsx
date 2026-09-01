import type { ReactElement, ReactNode } from "react";
import { ResponsiveContainer } from "recharts";

export interface DashboardTrendCardProps {
  title: string;
  description?: string;
  extra?: ReactNode;
  children: ReactElement;
  heightClass?: string;
}

export default function DashboardTrendCard({
  title,
  description,
  extra,
  children,
  heightClass = "h-[260px] sm:h-[300px]",
}: DashboardTrendCardProps) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/60 bg-white/60 p-4 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col justify-between transition-all duration-300">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-base font-extrabold text-slate-800 sm:text-lg">{title}</h3>
          {description ? (
            <p className="mt-0.5 text-xs font-semibold text-slate-400">{description}</p>
          ) : null}
        </div>
        {extra ? <div className="shrink-0">{extra}</div> : null}
      </div>

      <div className={`w-full ${heightClass}`}>
        <ResponsiveContainer width="100%" height="100%" debounce={120}>
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
