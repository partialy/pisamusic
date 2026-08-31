import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  InputNumber,
  Popconfirm,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  DeleteOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import {
  fetchListeningLevelConfig,
  ListeningLevelVersionConflictError,
  saveListeningLevelConfig,
} from "../../api/listening";
import type { ListeningLevelConfig, ListeningLevelRule } from "../../types/listening";

const { Text } = Typography;

type Props = {
  themeColor: string;
};

type DraftRule = {
  level: number;
  minMinutes: string;
  maxMinutes: string | null;
};

type RuleValidationResult =
  | { rules: ListeningLevelRule[]; error: null }
  | { rules: null; error: string };

function rulesToDraft(rules: ListeningLevelRule[]): DraftRule[] {
  return rules.map((rule) => ({
    level: rule.level,
    minMinutes: String(rule.minMinutes),
    maxMinutes: rule.maxMinutes === null ? null : String(rule.maxMinutes),
  }));
}

function reindexRules(rules: DraftRule[]): DraftRule[] {
  return rules.map((rule, index) => ({ ...rule, level: index + 1 }));
}

function readMinute(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const minute = Number(value);
  return Number.isSafeInteger(minute) && minute >= 0 ? minute : null;
}

function validateRules(rules: DraftRule[]): RuleValidationResult {
  if (rules.length === 0) return { rules: null, error: "至少需要保留一个等级。" };
  const parsedRules: ListeningLevelRule[] = [];
  for (let index = 0; index < rules.length; index += 1) {
    const rule = rules[index];
    const minMinutes = readMinute(rule.minMinutes);
    const maxMinutes = rule.maxMinutes === null ? null : readMinute(rule.maxMinutes);
    const previous = parsedRules[index - 1];
    if (minMinutes === null) {
      return { rules: null, error: `Lv ${rule.level} 的起始分钟必须是非负整数。` };
    }
    if (index === 0 && minMinutes !== 0) return { rules: null, error: "Lv 1 必须从 0 分钟开始。" };
    if (rule.maxMinutes !== null && (maxMinutes === null || maxMinutes < minMinutes)) {
      return { rules: null, error: `Lv ${rule.level} 的结束分钟必须是不小于起始分钟的整数。` };
    }
    if (index < rules.length - 1 && maxMinutes === null) return { rules: null, error: "只有最后一级可以设置为无上限。" };
    if (index > 0 && (previous.maxMinutes === null || minMinutes !== previous.maxMinutes + 1)) {
      return { rules: null, error: "等级区间必须连续且不能重叠。" };
    }
    parsedRules.push({ level: rule.level, minMinutes, maxMinutes });
  }
  return parsedRules[parsedRules.length - 1].maxMinutes === null
    ? { rules: parsedRules, error: null }
    : { rules: null, error: "最后一级必须设置为无上限。" };
}

function formatDurationSpan(minStr: string, maxStr: string | null): string {
  const min = readMinute(minStr);
  if (min === null) return "-";
  if (maxStr === null) {
    const minHour = (min / 60).toFixed(1);
    return `${min} 分钟以上 (≥ ${minHour} 小时，无上限)`;
  }
  const max = readMinute(maxStr);
  if (max === null || max < min) return "-";
  const span = max - min + 1;
  const spanHour = (span / 60).toFixed(1);
  return `${min} ~ ${max} 分钟 (共 ${span} 分钟 ≈ ${spanHour} 小时)`;
}

export default function ListeningLevelsTab({ themeColor: _ }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<ListeningLevelConfig | null>(null);
  const [draftRules, setDraftRules] = useState<DraftRule[]>([]);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const activeRequestRef = useRef<AbortController | null>(null);

  const loadConfig = useCallback(async () => {
    activeRequestRef.current?.abort();
    const controller = new AbortController();
    activeRequestRef.current = controller;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const next = await fetchListeningLevelConfig(controller.signal);
      if (controller.signal.aborted || requestId !== requestIdRef.current) return;
      setConfig(next);
      setDraftRules(rulesToDraft(next.rules));
    } catch (reason) {
      if (controller.signal.aborted || requestId !== requestIdRef.current) return;
      setError(reason instanceof Error ? reason.message : "听歌等级配置加载失败");
    } finally {
      if (controller.signal.aborted || requestId !== requestIdRef.current) return;
      if (activeRequestRef.current === controller) activeRequestRef.current = null;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConfig();
    return () => {
      activeRequestRef.current?.abort();
      activeRequestRef.current = null;
      requestIdRef.current += 1;
    };
  }, [loadConfig]);

  const validation = useMemo(() => validateRules(draftRules), [draftRules]);
  const validationError = validation.error;
  const hasChanges = useMemo(
    () => config !== null && JSON.stringify(config.rules) !== JSON.stringify(validation.rules ?? draftRules),
    [config, draftRules, validation.rules],
  );

  const updateRule = (index: number, patch: Partial<DraftRule>) => {
    setDraftRules((current) =>
      current.map((rule, ruleIndex) => (ruleIndex === index ? { ...rule, ...patch } : rule)),
    );
  };

  const updateMinute = (index: number, field: "minMinutes" | "maxMinutes", value: string) => {
    updateRule(index, { [field]: value });
  };

  const toggleUnlimited = (index: number, unlimited: boolean) => {
    const rule = draftRules[index];
    if (!rule) return;
    updateRule(index, { maxMinutes: unlimited ? null : rule.minMinutes });
  };

  const addRule = () => {
    const last = draftRules[draftRules.length - 1];
    if (!last) {
      setDraftRules([{ level: 1, minMinutes: "0", maxMinutes: null }]);
      return;
    }
    const minMinutes = readMinute(last.minMinutes);
    const maxMinutes = last.maxMinutes === null ? minMinutes : readMinute(last.maxMinutes);
    if (minMinutes === null || maxMinutes === null || maxMinutes < minMinutes) {
      setError("请先填写当前最高等级有效的起始和结束分钟，再添加等级。");
      return;
    }
    setDraftRules((current) => [
      ...current.slice(0, -1),
      { ...last, maxMinutes: String(maxMinutes) },
      { level: last.level + 1, minMinutes: String(maxMinutes + 1), maxMinutes: null },
    ]);
  };

  const removeRule = (index: number) => {
    setDraftRules((current) => {
      if (current.length <= 1) return current;
      const next = reindexRules(current.filter((_, ruleIndex) => ruleIndex !== index));
      return next.map((rule, ruleIndex) => (ruleIndex === next.length - 1 ? { ...rule, maxMinutes: null } : rule));
    });
  };

  const saveRules = async () => {
    if (!config) return;
    if (validation.error || !validation.rules) {
      setError(validation.error ?? "等级区间无效");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = await saveListeningLevelConfig(config.version, validation.rules);
      setConfig(saved);
      setDraftRules(rulesToDraft(saved.rules));
    } catch (reason) {
      if (reason instanceof ListeningLevelVersionConflictError) {
        setError("配置已被其他管理员更新，请刷新后重新编辑再保存。");
      } else {
        setError(reason instanceof Error ? reason.message : "听歌等级配置保存失败");
      }
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnsType<DraftRule> = [
    {
      title: "等级",
      key: "level",
      width: 100,
      align: "center",
      render: (_, record) => (
        <Tag color="geekblue" className="px-3 py-1 text-sm font-extrabold">
          Lv {record.level}
        </Tag>
      ),
    },
    {
      title: "起始分钟",
      key: "minMinutes",
      width: 180,
      render: (_, record, index) => (
        <InputNumber
          min={0}
          step={1}
          precision={0}
          value={Number(record.minMinutes) || 0}
          disabled={saving || index === 0}
          onChange={(val) => updateMinute(index, "minMinutes", String(val ?? 0))}
          className="w-full"
          addonAfter="分钟"
        />
      ),
    },
    {
      title: "结束分钟",
      key: "maxMinutes",
      width: 200,
      render: (_, record, index) => {
        const isUnlimited = record.maxMinutes === null;
        return (
          <InputNumber
            min={Number(record.minMinutes) || 0}
            step={1}
            precision={0}
            value={isUnlimited ? undefined : Number(record.maxMinutes)}
            placeholder={isUnlimited ? "无上限" : "请输入结束分钟"}
            disabled={saving || isUnlimited}
            onChange={(val) => updateMinute(index, "maxMinutes", val !== null ? String(val) : "")}
            className="w-full"
            addonAfter={isUnlimited ? "∞" : "分钟"}
          />
        );
      },
    },
    {
      title: "是否无上限",
      key: "unlimited",
      width: 120,
      align: "center",
      render: (_, record, index) => {
        const isLast = index === draftRules.length - 1;
        const isUnlimited = record.maxMinutes === null;
        return (
          <Checkbox
            checked={isUnlimited}
            disabled={saving || !isLast}
            onChange={(e) => toggleUnlimited(index, e.target.checked)}
          >
            无上限
          </Checkbox>
        );
      },
    },
    {
      title: "区间跨度说明",
      key: "span",
      render: (_, record) => (
        <Text type="secondary" className="font-mono text-xs">
          {formatDurationSpan(record.minMinutes, record.maxMinutes)}
        </Text>
      ),
    },
    {
      title: "操作",
      key: "action",
      width: 100,
      align: "center",
      render: (_, __, index) => (
        <Popconfirm
          title="确认删除该等级？"
          description="删除后后续等级将自动向前重排并调整无上限状态。"
          onConfirm={() => removeRule(index)}
          disabled={saving || draftRules.length <= 1}
          okText="确定"
          cancelText="取消"
          okButtonProps={{ danger: true }}
        >
          <Button
            type="link"
            danger
            size="small"
            icon={<DeleteOutlined />}
            disabled={saving || draftRules.length <= 1}
          >
            删除
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div className="space-y-4 animate-fade-in-up">
      <Card
        bordered={false}
        className="shadow-sm rounded-2xl"
        title={
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-slate-800">听歌等级区间配置</span>
            {config && <Tag color="blue">当前版本 v{config.version}</Tag>}
            {hasChanges && <Tag color="orange">有未保存改动</Tag>}
          </div>
        }
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => void loadConfig()}
              loading={loading}
              disabled={saving}
            >
              刷新配置
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={() => void saveRules()}
              loading={saving}
              disabled={loading || !hasChanges || Boolean(validationError)}
            >
              保存等级
            </Button>
          </Space>
        }
      >
        <div className="space-y-4">
          <Alert
            type="info"
            showIcon
            message="等级计算规则"
            description="按照用户全设备去重后的累计听歌分钟动态计算等级。区间必须连续且不能重叠：Lv 1 必须从 0 分钟开始，每一级的起始分钟必须等于前一级的结束分钟 + 1，且只有最后一级可以设为无上限。"
            className="rounded-xl"
          />

          {error && (
            <Alert
              type="error"
              showIcon
              message={error}
              closable
              onClose={() => setError(null)}
              className="rounded-xl"
            />
          )}

          {validationError && (
            <Alert
              type="warning"
              showIcon
              message={`区间连续性校验：${validationError}`}
              className="rounded-xl"
            />
          )}

          <div className="flex justify-between items-center pt-2">
            <span className="text-sm font-semibold text-slate-700">
              当前配置：共 {draftRules.length} 个等级
            </span>
            <Button
              type="dashed"
              icon={<PlusOutlined />}
              onClick={addRule}
              disabled={saving || draftRules.length >= 100}
            >
              {draftRules.length >= 100 ? "已达上限 (100级)" : "添加等级"}
            </Button>
          </div>

          <Table<DraftRule>
            rowKey="level"
            columns={columns}
            dataSource={draftRules}
            loading={loading}
            pagination={false}
            size="middle"
            bordered
            className="overflow-hidden rounded-xl border border-slate-200"
          />
        </div>
      </Card>
    </div>
  );
}
