import { useEffect, useState } from "react";
import { Checkbox, Divider, InputNumber, Modal, Space, Switch, Tag, message } from "antd";
import { saveBatchSubjectQuotaOverride, saveSubjectQuotaOverride } from "../../api/songDownloads";
import type { AdminQuotaStateItem, QuotaTargetRef } from "../../types/songDownloads";

type Props = {
  open: boolean;
  target: AdminQuotaStateItem | null;
  batchTargets?: QuotaTargetRef[];
  onClose: () => void;
  onSaved: () => void;
};

type LimitFieldProps = {
  label: string;
  hint: string;
  value: number | null;
  disabled: boolean;
  onChange: (val: number | null) => void;
};

function LimitField({ label, hint, value, disabled, onChange }: LimitFieldProps) {
  const unlimited = value === null;
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <div>
        <div className="text-sm font-medium text-slate-800">{label}</div>
        <div className="text-xs text-slate-400">{hint}</div>
      </div>
      <div className="flex items-center gap-2">
        <Switch
          size="small"
          disabled={disabled}
          checked={!unlimited}
          checkedChildren="限制"
          unCheckedChildren="不限"
          onChange={(checked) => onChange(checked ? 100 : null)}
        />
        <InputNumber
          min={0}
          max={100000000}
          precision={0}
          disabled={disabled || unlimited}
          value={unlimited ? undefined : value}
          placeholder="不限制"
          className="w-32"
          onChange={(v) => onChange(typeof v === "number" ? Math.max(0, Math.trunc(v)) : 0)}
        />
      </div>
    </div>
  );
}

export default function QuotaOverrideModal({ open, target, batchTargets = [], onClose, onSaved }: Props) {
  const isBatch = batchTargets.length > 1;
  const active = Boolean(target) || batchTargets.length > 0;

  const [saving, setSaving] = useState(false);
  const [overrideEnabled, setOverrideEnabled] = useState(false);
  const [dailyLimit, setDailyLimit] = useState<number | null>(null);
  const [weeklyLimit, setWeeklyLimit] = useState<number | null>(null);
  const [monthlyLimit, setMonthlyLimit] = useState<number | null>(null);
  const [totalLimit, setTotalLimit] = useState<number | null>(null);
  const [extraBalance, setExtraBalance] = useState<number>(0);
  const [extraDelta, setExtraDelta] = useState<number>(0);
  const [resetDayUsed, setResetDayUsed] = useState(false);
  const [resetWeekUsed, setResetWeekUsed] = useState(false);
  const [resetMonthUsed, setResetMonthUsed] = useState(false);
  const [resetTotalUsed, setResetTotalUsed] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (isBatch) {
      setOverrideEnabled(true);
      setDailyLimit(null);
      setWeeklyLimit(null);
      setMonthlyLimit(null);
      setTotalLimit(null);
      setExtraBalance(0);
      setExtraDelta(0);
    } else if (target) {
      setOverrideEnabled(target.overrideEnabled);
      setDailyLimit(target.daily.limit);
      setWeeklyLimit(target.weekly.limit);
      setMonthlyLimit(target.monthly.limit);
      setTotalLimit(target.total.limit);
      setExtraBalance(target.extraRemaining ?? 0);
      setExtraDelta(0);
    }
    setResetDayUsed(false);
    setResetWeekUsed(false);
    setResetMonthUsed(false);
    setResetTotalUsed(false);
  }, [open, isBatch, target]);

  const handleSave = async () => {
    if (!active) return;
    setSaving(true);
    try {
      const payload = {
        overrideEnabled,
        dailyLimit: overrideEnabled ? dailyLimit : null,
        weeklyLimit: overrideEnabled ? weeklyLimit : null,
        monthlyLimit: overrideEnabled ? monthlyLimit : null,
        totalLimit: overrideEnabled ? totalLimit : null,
        ...(isBatch
          ? extraDelta !== 0
            ? { extraDelta }
            : {}
          : { extraBalance }),
        resetDayUsed,
        resetWeekUsed,
        resetMonthUsed,
        resetTotalUsed,
      };
      if (isBatch) {
        const res = await saveBatchSubjectQuotaOverride({
          targets: batchTargets.map((t) => ({ subjectType: t.subjectType, subjectKey: t.subjectKey })),
          ...payload,
        });
        message.success(`已批量更新 ${res.updatedCount} 个主体的配额设置`);
      } else if (target) {
        await saveSubjectQuotaOverride(target.subjectType, target.subjectKey, payload);
        message.success("配额设置已更新");
      }
      onSaved();
      onClose();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const userCount = batchTargets.filter((t) => t.subjectType === "user").length;
  const deviceCount = batchTargets.length - userCount;

  return (
    <Modal
      open={open}
      title={
        <Space>
          <span>{isBatch ? `批量配置下载配额（共 ${batchTargets.length} 项）` : "编辑下载配额"}</span>
          {!isBatch && target && (
            <Tag color={target.subjectType === "user" ? "blue" : "purple"}>
              {target.subjectType === "user" ? "账号" : "设备"}
            </Tag>
          )}
        </Space>
      }
      onCancel={onClose}
      onOk={() => void handleSave()}
      confirmLoading={saving}
      okText={isBatch ? "批量保存" : "保存"}
      cancelText="取消"
      width={540}
    >
      {active && (
        <div className="space-y-3 pt-2">
          {isBatch ? (
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 space-y-1.5">
              <div className="font-semibold text-slate-800">
                已选择 {batchTargets.length} 个配置主体（账号 {userCount} / 设备 {deviceCount}），保存后将统一覆盖这些主体的配额策略
              </div>
              <div className="max-h-20 overflow-y-auto">
                <Space size={[4, 4]} wrap>
                  {batchTargets.map((item) => (
                    <Tag
                      key={`${item.subjectType}:${item.subjectKey}`}
                      color={item.subjectType === "user" ? "blue" : "purple"}
                      className="!mr-0"
                    >
                      {item.displayName}
                    </Tag>
                  ))}
                </Space>
              </div>
            </div>
          ) : target ? (
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <div className="font-semibold text-slate-800">{target.displayName}</div>
              <div className="font-mono text-slate-400">{target.subjectKey}</div>
              <div className="mt-1">
                当前已用：日 {target.daily.used} / 周 {target.weekly.used} / 月 {target.monthly.used} / 总 {target.total.used}
                <span className="ml-2 text-emerald-600">额外可用：{target.extraRemaining ?? 0}</span>
              </div>
            </div>
          ) : null}

          <div className="flex items-center justify-between py-1">
            <div>
              <div className="text-sm font-semibold text-slate-800">启用独立配额覆盖</div>
              <div className="text-xs text-slate-400">关闭时跟随对应档位策略（VIP / 大众用户 / 游客）</div>
            </div>
            <Switch checked={overrideEnabled} onChange={setOverrideEnabled} />
          </div>

          <Divider className="!my-2" />

          <LimitField
            label="每日上限"
            hint="北京时间每天 0 点刷新"
            value={dailyLimit}
            disabled={!overrideEnabled}
            onChange={setDailyLimit}
          />
          <LimitField
            label="每周上限"
            hint="北京时间每周一 0 点刷新"
            value={weeklyLimit}
            disabled={!overrideEnabled}
            onChange={setWeeklyLimit}
          />
          <LimitField
            label="每月上限"
            hint="北京时间每月 1 号 0 点刷新"
            value={monthlyLimit}
            disabled={!overrideEnabled}
            onChange={setMonthlyLimit}
          />
          <LimitField
            label="总次数上限"
            hint="累计上限，不自动重置"
            value={totalLimit}
            disabled={!overrideEnabled}
            onChange={setTotalLimit}
          />

          <Divider className="!my-2" />

          <div className="flex items-center justify-between gap-3 py-1.5">
            <div>
              <div className="text-sm font-medium text-slate-800">
                {isBatch ? "批量增减额外次数" : "额外可用次数（永久）"}
              </div>
              <div className="text-xs text-slate-400">
                {isBatch
                  ? "正数增加、负数扣减（最低降至 0）；不占日/周/月/总配额"
                  : "常规配额不足时自动抵扣，不占用日/周/月/总配额"}
              </div>
            </div>
            {isBatch ? (
              <InputNumber
                min={-100000}
                max={100000}
                precision={0}
                value={extraDelta}
                onChange={(v) => setExtraDelta(typeof v === "number" ? Math.trunc(v) : 0)}
                addonAfter="次"
                className="w-36"
              />
            ) : (
              <InputNumber
                min={0}
                max={100000000}
                precision={0}
                value={extraBalance}
                onChange={(v) => setExtraBalance(typeof v === "number" ? Math.max(0, Math.trunc(v)) : 0)}
                addonAfter="次"
                className="w-36"
              />
            )}
          </div>

          <Divider className="!my-2" />

          <div>
            <div className="mb-2 text-xs font-medium text-slate-500">清空已用次数（可选）</div>
            <Space wrap>
              <Checkbox checked={resetDayUsed} onChange={(e) => setResetDayUsed(e.target.checked)}>
                {isBatch || !target ? "清零今日已用" : `清零今日 (${target.daily.used})`}
              </Checkbox>
              <Checkbox checked={resetWeekUsed} onChange={(e) => setResetWeekUsed(e.target.checked)}>
                {isBatch || !target ? "清零本周已用" : `清零本周 (${target.weekly.used})`}
              </Checkbox>
              <Checkbox checked={resetMonthUsed} onChange={(e) => setResetMonthUsed(e.target.checked)}>
                {isBatch || !target ? "清零本月已用" : `清零本月 (${target.monthly.used})`}
              </Checkbox>
              <Checkbox checked={resetTotalUsed} onChange={(e) => setResetTotalUsed(e.target.checked)}>
                {isBatch || !target ? "清零累计总计" : `清零总计 (${target.total.used})`}
              </Checkbox>
            </Space>
          </div>
        </div>
      )}
    </Modal>
  );
}
