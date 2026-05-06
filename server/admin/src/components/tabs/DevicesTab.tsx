import { useEffect, useState } from "react";
import type { DeviceFilter, DeviceInfo } from "../../types/config";
import { glassCardClasses, glassInputClasses } from "../../constants/theme";
import { formatDateTimeLocal, formatTimestamp, parseDateTimeLocal } from "../../utils/date";

type Props = {
  devices: DeviceInfo[];
  totalDevices: number;
  deviceOffset: number;
  deviceLimit: number;
  deviceFilter: DeviceFilter;
  deviceLoading: boolean;
  themeColor: string;
  selectedDevice: DeviceInfo | null;
  onFilterChange: (filter: DeviceFilter) => void;
  onPageChange: (offset: number) => void;
  onRefreshDevices: () => void;
  onSelectDevice: (device: DeviceInfo | null) => void;
  onLockDevice: (id: string, locked: boolean, lockEndTime?: number | null) => void;
  onDeleteDevice: (id: string) => void;
};

function LockBadge({ locked, lockEndTime }: { locked: boolean; lockEndTime: number | null }) {
  if (!locked) {
    return <span className="rounded-md border border-emerald-200 bg-emerald-100/80 px-2 py-0.5 text-[10px] font-bold text-emerald-600">正常</span>;
  }
  if (lockEndTime === null) {
    return <span className="rounded-md border border-red-200 bg-red-100/80 px-2 py-0.5 text-[10px] font-bold text-red-600">永久封禁</span>;
  }
  if (lockEndTime <= Date.now()) {
    return <span className="rounded-md border border-amber-200 bg-amber-100/80 px-2 py-0.5 text-[10px] font-bold text-amber-600">封禁已过期</span>;
  }
  return (
    <span className="rounded-md border border-red-200 bg-red-100/80 px-2 py-0.5 text-[10px] font-bold text-red-600">
      临时封禁 {formatTimestamp(lockEndTime)}
    </span>
  );
}

function DeviceIcon() {
  return (
    <div className="mr-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 text-white shadow-lg shadow-blue-500/30">
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
      </svg>
    </div>
  );
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-4 border-b border-white/40 py-2">
      <span className="shrink-0 text-sm font-bold text-slate-600">{label}</span>
      <span className="min-w-0 truncate text-right font-mono text-sm text-slate-800">{value}</span>
    </div>
  );
}

export default function DevicesTab({
  devices,
  totalDevices,
  deviceOffset,
  deviceLimit,
  deviceFilter,
  deviceLoading,
  themeColor,
  selectedDevice,
  onFilterChange,
  onPageChange,
  onRefreshDevices,
  onSelectDevice,
  onLockDevice,
  onDeleteDevice,
}: Props) {
  const [localSearch, setLocalSearch] = useState(deviceFilter.search ?? "");
  const [localLockedFilter, setLocalLockedFilter] = useState<string>(
    deviceFilter.locked === true ? "locked" : deviceFilter.locked === false ? "unlocked" : "all",
  );
  const [localBrand, setLocalBrand] = useState(deviceFilter.brand ?? "");
  const [lockDraft, setLockDraft] = useState<{ locked: boolean; permanent: boolean; endTime: string } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(totalDevices / deviceLimit));
  const currentPage = Math.floor(deviceOffset / deviceLimit) + 1;
  const hasActiveFilter = Boolean(deviceFilter.search || deviceFilter.brand || deviceFilter.locked !== undefined);

  useEffect(() => {
    setLocalSearch(deviceFilter.search ?? "");
    setLocalBrand(deviceFilter.brand ?? "");
    setLocalLockedFilter(deviceFilter.locked === true ? "locked" : deviceFilter.locked === false ? "unlocked" : "all");
  }, [deviceFilter]);

  const handleApplyFilter = () => {
    const filter: DeviceFilter = {};
    if (localSearch.trim()) filter.search = localSearch.trim();
    if (localBrand.trim()) filter.brand = localBrand.trim();
    if (localLockedFilter === "locked") filter.locked = true;
    if (localLockedFilter === "unlocked") filter.locked = false;
    onFilterChange(filter);
  };

  const handleResetFilter = () => {
    setLocalSearch("");
    setLocalBrand("");
    setLocalLockedFilter("all");
    onFilterChange({});
  };

  const handlePrevPage = () => {
    if (deviceOffset - deviceLimit >= 0) onPageChange(deviceOffset - deviceLimit);
  };

  const handleNextPage = () => {
    if (deviceOffset + deviceLimit < totalDevices) onPageChange(deviceOffset + deviceLimit);
  };

  if (selectedDevice) {
    const d = selectedDevice;
    const extras = Object.entries(d.extraInfo);

    return (
      <div className="space-y-8 animate-fade-in-up">
        <button
          type="button"
          onClick={() => onSelectDevice(null)}
          className="flex items-center rounded-2xl border border-white/60 bg-white/80 px-5 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition-all hover:bg-white"
        >
          <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
          返回设备列表
        </button>

        <div className={glassCardClasses}>
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center">
              <DeviceIcon />
              <div className="min-w-0">
                <h2 className="truncate text-xl font-bold text-slate-800">{d.brand} {d.model}</h2>
                <p className="mt-1 truncate text-xs text-slate-500">{d.deviceName} / Android {d.osVersion} / SDK {d.sdkVersion}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <LockBadge locked={d.locked} lockEndTime={d.lockEndTime} />
              <span className="rounded-md border border-slate-200 bg-slate-100/60 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-600">v{d.appVersion}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            <FieldRow label="ID" value={d.id} />
            <FieldRow label="Fingerprint" value={d.fingerprint} />
            <FieldRow label="Brand" value={d.brand} />
            <FieldRow label="Model" value={d.model} />
            <FieldRow label="Device Name" value={d.deviceName} />
            <FieldRow label="OS Version" value={d.osVersion} />
            <FieldRow label="SDK Version" value={String(d.sdkVersion)} />
            <FieldRow label="App Version" value={d.appVersion} />
            <FieldRow label="App Version Code" value={String(d.appVersionCode)} />
            <FieldRow label="First Seen At" value={formatTimestamp(d.firstSeenAt)} />
            <FieldRow label="Last Active At" value={formatTimestamp(d.lastActiveAt)} />
            <FieldRow label="First Seen IP" value={d.firstSeenIp ?? "N/A"} />
            <FieldRow label="Last Seen IP" value={d.lastSeenIp ?? "N/A"} />
            <FieldRow label="Country Code" value={d.lastCountryCode ?? "N/A"} />
            <FieldRow label="Timezone" value={d.lastTimezone ?? "N/A"} />
            <FieldRow label="Locale" value={d.lastLocale ?? "N/A"} />
          </div>

          {extras.length > 0 && (
            <div className="mt-6 border-t border-white/40 pt-4">
              <h3 className="mb-3 text-sm font-bold text-slate-600">Extra Info</h3>
              <div className="space-y-2">
                {extras.map(([key, val]) => (
                  <div key={key} className="flex min-w-0 items-center justify-between gap-4 rounded-xl bg-white/40 px-4 py-2">
                    <span className="shrink-0 font-mono text-xs font-bold text-slate-500">{key}</span>
                    <span className="min-w-0 truncate text-right font-mono text-xs text-slate-800">{String(val)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className={glassCardClasses}>
          <h2 className="mb-6 text-xl font-bold text-slate-800">封禁管理</h2>
          {lockDraft ? (
            <div className="space-y-4">
              {lockDraft.locked && (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm font-bold text-slate-700">封禁类型</span>
                  <button
                    type="button"
                    onClick={() => setLockDraft({ ...lockDraft, permanent: true })}
                    className={`rounded-xl px-4 py-2 text-sm font-bold transition-all ${lockDraft.permanent ? "border border-red-200 bg-red-100/80 text-red-600" : "border border-white/60 bg-white/50 text-slate-500"}`}
                  >
                    永久封禁
                  </button>
                  <button
                    type="button"
                    onClick={() => setLockDraft({ ...lockDraft, permanent: false })}
                    className={`rounded-xl px-4 py-2 text-sm font-bold transition-all ${!lockDraft.permanent ? "border border-amber-200 bg-amber-100/80 text-amber-600" : "border border-white/60 bg-white/50 text-slate-500"}`}
                  >
                    临时封禁
                  </button>
                </div>
              )}

              {lockDraft.locked && !lockDraft.permanent && (
                <label className="block">
                  <span className="mb-2 ml-1 block text-sm font-bold text-slate-700">截止时间</span>
                  <input
                    type="datetime-local"
                    value={lockDraft.endTime}
                    onChange={(e) => setLockDraft({ ...lockDraft, endTime: e.target.value })}
                    className={glassInputClasses + " font-mono text-[13px]"}
                  />
                </label>
              )}

              <div className="flex flex-wrap gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    if (lockDraft.locked) {
                      onLockDevice(d.id, true, lockDraft.permanent ? null : parseDateTimeLocal(lockDraft.endTime));
                    } else {
                      onLockDevice(d.id, false, null);
                    }
                    setLockDraft(null);
                  }}
                  style={{ backgroundColor: themeColor, boxShadow: `0 10px 15px -3px ${themeColor}40` }}
                  className="rounded-xl px-6 py-3 font-bold text-white transition-opacity hover:opacity-90"
                >
                  {lockDraft.locked ? "确认封禁" : "确认解封"}
                </button>
                <button
                  type="button"
                  onClick={() => setLockDraft(null)}
                  className="rounded-xl border border-white/50 px-6 py-3 font-bold text-slate-600 shadow-sm transition-colors hover:bg-white/60"
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {d.locked ? (
                <button
                  type="button"
                  onClick={() => setLockDraft({ locked: false, permanent: true, endTime: "" })}
                  className="rounded-xl border border-emerald-200 bg-emerald-50 px-6 py-3 font-bold text-emerald-700 shadow-sm transition-all hover:bg-emerald-100"
                >
                  解除封禁
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setLockDraft({ locked: true, permanent: true, endTime: formatDateTimeLocal(Date.now() + 7 * 24 * 60 * 60 * 1000) })}
                  className="rounded-xl border border-red-200 bg-red-50 px-6 py-3 font-bold text-red-700 shadow-sm transition-all hover:bg-red-100"
                >
                  封禁设备
                </button>
              )}
            </div>
          )}
        </div>

        <div className={glassCardClasses}>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-800">删除设备</h2>
              <p className="mt-1 text-xs text-slate-500">删除后该设备的所有记录将被永久移除，此操作不可撤销。</p>
            </div>
            {confirmDeleteId === d.id ? (
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    onDeleteDevice(d.id);
                    setConfirmDeleteId(null);
                  }}
                  className="rounded-xl bg-red-600 px-6 py-3 font-bold text-white shadow-sm transition-colors hover:bg-red-700"
                >
                  确认删除
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(null)}
                  className="rounded-xl border border-white/50 px-6 py-3 font-bold text-slate-600 shadow-sm transition-colors hover:bg-white/60"
                >
                  取消
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDeleteId(d.id)}
                className="rounded-xl border border-red-200 bg-red-50 px-6 py-3 font-bold text-red-600 shadow-sm transition-all hover:bg-red-100"
              >
                删除此设备
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in-up">
      <div className={glassCardClasses}>
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center">
            <DeviceIcon />
            <div>
              <h2 className="text-xl font-bold text-slate-800">设备列表</h2>
              <p className="mt-1 text-xs text-slate-500">共 {totalDevices} 台设备</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onRefreshDevices}
            style={{ backgroundColor: themeColor, boxShadow: `0 10px 15px -3px ${themeColor}40` }}
            className="shrink-0 rounded-2xl px-5 py-2.5 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:opacity-90"
          >
            刷新列表
          </button>
        </div>

        <form
          className="mb-6 rounded-2xl border border-white/60 bg-white/40 p-4 shadow-inner"
          onSubmit={(e) => {
            e.preventDefault();
            handleApplyFilter();
          }}
        >
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_150px_150px_auto_auto] lg:items-end">
            <label className="block min-w-0">
              <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">搜索</span>
              <input
                type="text"
                value={localSearch}
                placeholder="品牌、型号、设备名、ID"
                onChange={(e) => setLocalSearch(e.target.value)}
                className={glassInputClasses + " h-11"}
              />
            </label>

            <label className="block min-w-0">
              <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">状态</span>
              <select
                value={localLockedFilter}
                onChange={(e) => setLocalLockedFilter(e.target.value)}
                className="h-11 w-full rounded-2xl border border-white/60 bg-white/50 px-4 text-sm text-slate-800 shadow-inner transition-all focus:bg-white/90 focus:outline-none focus:ring-2 focus:ring-slate-400/30"
              >
                <option value="all">全部</option>
                <option value="locked">已封禁</option>
                <option value="unlocked">正常</option>
              </select>
            </label>

            <label className="block min-w-0">
              <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">品牌</span>
              <input
                type="text"
                value={localBrand}
                placeholder="品牌筛选"
                onChange={(e) => setLocalBrand(e.target.value)}
                className={glassInputClasses + " h-11"}
              />
            </label>

            <button
              type="submit"
              style={{ backgroundColor: themeColor, boxShadow: `0 10px 15px -3px ${themeColor}40` }}
              className="h-11 rounded-2xl px-5 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:opacity-90"
            >
              筛选
            </button>

            <button
              type="button"
              onClick={handleResetFilter}
              disabled={!hasActiveFilter && !localSearch && !localBrand && localLockedFilter === "all"}
              className="h-11 rounded-2xl border border-white/60 bg-white/60 px-5 text-sm font-bold text-slate-700 shadow-sm transition-all hover:bg-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
            >
              重置
            </button>
          </div>

          {hasActiveFilter && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-bold text-slate-600">当前筛选:</span>
              {deviceFilter.search && <span className="rounded-lg bg-white/70 px-2 py-1 font-mono">搜索: {deviceFilter.search}</span>}
              {deviceFilter.brand && <span className="rounded-lg bg-white/70 px-2 py-1 font-mono">品牌: {deviceFilter.brand}</span>}
              {deviceFilter.locked !== undefined && (
                <span className="rounded-lg bg-white/70 px-2 py-1 font-mono">状态: {deviceFilter.locked ? "已封禁" : "正常"}</span>
              )}
            </div>
          )}
        </form>

        {deviceLoading ? (
          <div className="rounded-2xl border border-white/60 bg-white/40 py-12 text-center shadow-inner">
            <p className="font-bold text-slate-500">加载中...</p>
          </div>
        ) : devices.length === 0 ? (
          <div className="rounded-2xl border border-white/60 bg-white/40 py-12 text-center shadow-inner">
            <p className="font-bold text-slate-500">暂无设备记录</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {devices.map((d) => (
              <div key={d.id} className={`${glassCardClasses} group !p-5`}>
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="min-w-0 truncate text-sm font-bold text-slate-800">{d.brand} {d.model}</span>
                      <LockBadge locked={d.locked} lockEndTime={d.lockEndTime} />
                      <span className="rounded-md border border-slate-200 bg-slate-100/60 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-600">v{d.appVersion}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                      <span>{d.deviceName}</span>
                      <span className="text-slate-400">/</span>
                      <span>Android {d.osVersion}</span>
                      <span className="text-slate-400">/</span>
                      <span>SDK {d.sdkVersion}</span>
                      <span className="text-slate-400">/</span>
                      <span>最近活跃 {formatTimestamp(d.lastActiveAt)}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2 md:ml-4 lg:opacity-0 lg:transition-opacity lg:group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => onSelectDevice(d)}
                      className="rounded-xl border border-white bg-white/80 px-4 py-2 text-xs font-bold text-slate-700 transition-all hover:bg-white"
                    >
                      详情
                    </button>
                    <button
                      type="button"
                      onClick={() => onLockDevice(d.id, !d.locked, null)}
                      className={`${d.locked ? "border border-emerald-100 bg-emerald-50 text-emerald-600 hover:bg-emerald-100" : "border border-red-100 bg-red-50 text-red-600 hover:bg-red-100"} rounded-xl px-4 py-2 text-xs font-bold transition-all`}
                    >
                      {d.locked ? "解封" : "封禁"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm("确定要删除此设备记录吗？此操作不可撤销。")) onDeleteDevice(d.id);
                      }}
                      className="rounded-xl border border-red-100 bg-red-50 px-4 py-2 text-xs font-bold text-red-600 transition-all hover:bg-red-100"
                    >
                      删除
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {totalDevices > 0 && (
          <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs font-bold text-slate-500">
              第 {currentPage} 页 / 共 {totalPages} 页
            </span>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handlePrevPage}
                disabled={deviceOffset === 0}
                className={`rounded-2xl border border-white/60 px-5 py-2.5 text-sm font-bold transition-all ${
                  deviceOffset === 0 ? "cursor-not-allowed bg-slate-200 text-slate-400" : "bg-white/60 text-slate-700 shadow-sm hover:bg-white"
                }`}
              >
                上一页
              </button>
              <button
                type="button"
                onClick={handleNextPage}
                disabled={deviceOffset + deviceLimit >= totalDevices}
                className={`rounded-2xl border border-white/60 px-5 py-2.5 text-sm font-bold transition-all ${
                  deviceOffset + deviceLimit >= totalDevices ? "cursor-not-allowed bg-slate-200 text-slate-400" : "bg-white/60 text-slate-700 shadow-sm hover:bg-white"
                }`}
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
