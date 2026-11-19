import { useEffect, useState } from "react";
import { Checkbox, Divider, InputNumber, Modal, Space, Switch, Tag, message } from "antd";
import { saveSubjectQuotaOverride } from "../../api/songDownloads";
import type { AdminQuotaStateItem } from "../../types/songDownloads";

type Props = {
  open: boolean;
  target: AdminQuotaStateItem | null;
  onClose: () => void;
  onSaved: (updated: AdminQuotaStateItem) => void;
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

export default function QuotaOverrideModal({ open, target, onClose, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [overrideEnabled, setOverrideEnabled] = useState(false);
  const [dailyLimit, setDailyLimit] = useState<number | null>(null);
  const [weeklyLimit, setWeeklyLimit] = useState<number | null>(null);
  const [monthlyLimit, setMonthlyLimit] = useState<number | null>(null);
  const [totalLimit, setTotalLimit] = useState<number | null>(null);
  const [resetDayUsed, setResetDayUsed] = useState(false);
  const [resetWeekUsed, setResetWeekUsed] = useState(false);
  const [resetMonthUsed, setResetMonthUsed] = useState(false);
  const [resetTotalUsed, setResetTotalUsed] = useState(false);

  useEffect(() => {
    if (!target) return;
    setOverrideEnabled(target.overrideEnabled);
    setDailyLimit(target.daily.limit);
    setWeeklyLimit(target.weekly.limit);
    setMonthlyLimit(target.monthly.limit);
    setTotalLimit(target.total.limit);
    setResetDayUsed(false);
    setResetWeekUsed(false);
    setResetMonthUsed(false);
    setResetTotalUsed(false);
  }, [target]);

  const handleSave = async () => {
    if (!target) return;
    setSaving(true);
    try {
      const updated = await saveSubjectQuotaOverride(target.subjectType, target.subjectKey, {
        overrideEnabled,
        dailyLimit: overrideEnabled ? dailyLimit : null,
        weeklyLimit: overrideEnabled ? weeklyLimit : null,
        monthlyLimit: overrideEnabled ? monthlyLimit : null,
        totalLimit: overrideEnabled ? totalLimit : null,
        resetDayUsed,
        resetWeekUsed,
        resetMonthUsed,
        resetTotalUsed,
      });
      message.success("配额设置已更新");
      onSaved(updated);
      onClose();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={
        <Space>
          <span>编辑下载配额</span>
          {target && (
            <Tag color={target.subjectType === "user" ? "blue" : "purple"}>
              {target.subjectType === "user" ? "账号" : "设备"}
            </Tag>
          )}
        </Space>
      }
      onCancel={onClose}
      onOk={handleSave}
      confirmLoading={saving}
      okText="保存"
      cancelText="取消"
      width={520}
    >
      {target && (
        <div className="space-y-3 pt-2">
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <div className="font-semibold text-slate-800">{target.displayName}</div>
            <div className="font-mono text-slate-400">{target.subjectKey}</div>
            <div className="mt-1">
              当前已用：日 {target.daily.used} / 周 {target.weekly.used} / 月 {target.monthly.used} / 总 {target.total.used}
            </div>
          </div>

          <div className="flex items-center justify-between py-1">
            <div>
              <div className="text-sm font-semibold text-slate-800">启用独立配额覆盖</div>
              <div className="text-xs text-slate-400">关闭时跟随全局默认配额策略</div>
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

          <div>
            <div className="mb-2 text-xs font-medium text-slate-500">清空已用次数（可选）</div>
            <Space wrap>
              <Checkbox checked={resetDayUsed} onChange={(e) => setResetDayUsed(e.target.checked)}>
                清零今日 ({target.daily.used})
              </Checkbox>
              <Checkbox checked={resetWeekUsed} onChange={(e) => setResetWeekUsed(e.target.checked)}>
                清零本周 ({target.weekly.used})
              </Checkbox>
              <Checkbox checked={resetMonthUsed} onChange={(e) => setResetMonthUsed(e.target.checked)}>
                清零本月 ({target.monthly.used})
              </Checkbox>
              <Checkbox checked={resetTotalUsed} onChange={(e) => setResetTotalUsed(e.target.checked)}>
                清零总计 ({target.total.used})
              </Checkbox>
            </Space>
          </div>
        </div>
      )}
    </Modal>
  );
}
