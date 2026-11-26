import { Button, Card, Col, Divider, Input, InputNumber, Popconfirm, Row, Space, Switch, Tag } from "antd";
import { DeleteOutlined, PlusOutlined, SaveOutlined } from "@ant-design/icons";
import { glassCardClasses } from "../../constants/theme";
import type { AdminTierPoliciesPayload, QuotaLimits, VipTierConfig } from "../../types/songDownloads";

type Props = {
  policies: AdminTierPoliciesPayload;
  saving: boolean;
  onChange: (next: AdminTierPoliciesPayload) => void;
  onSave: () => void;
};

function QuotaLimitsRow({
  limits,
  onChange,
}: {
  limits: QuotaLimits;
  onChange: (next: QuotaLimits) => void;
}) {
  const fields: Array<{ key: keyof QuotaLimits; label: string; hint: string }> = [
    { key: "daily", label: "每日上限", hint: "北京时间 0 点刷新" },
    { key: "weekly", label: "每周上限", hint: "北京时间周一 0 点刷新" },
    { key: "monthly", label: "每月上限", hint: "北京时间 1 号 0 点刷新" },
    { key: "total", label: "总次数上限", hint: "累计总限额，不重置" },
  ];

  return (
    <Row gutter={[12, 12]}>
      {fields.map(({ key, label, hint }) => {
        const val = limits[key];
        const unlimited = val === null;
        return (
          <Col xs={24} sm={12} lg={6} key={key}>
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-sm text-slate-800">{label}</span>
                <Switch
                  size="small"
                  checked={!unlimited}
                  checkedChildren="限制"
                  unCheckedChildren="不限"
                  onChange={(checked) =>
                    onChange({
                      ...limits,
                      [key]: checked ? 10 : null,
                    })
                  }
                />
              </div>
              <div className="text-xs text-slate-400 mb-2">{hint}</div>
              <InputNumber
                min={0}
                max={100000000}
                precision={0}
                disabled={unlimited}
                value={unlimited ? undefined : val}
                placeholder="不限制"
                className="w-full"
                addonAfter="次"
                onChange={(n) =>
                  onChange({
                    ...limits,
                    [key]: typeof n === "number" ? Math.max(0, Math.trunc(n)) : 0,
                  })
                }
              />
            </div>
          </Col>
        );
      })}
    </Row>
  );
}

export default function TierPoliciesSection({ policies, saving, onChange, onSave }: Props) {
  const nextLevel = policies.vipTiers.reduce((max, t) => Math.max(max, t.level), 0) + 1;

  const updateTier = (level: number, patch: Partial<VipTierConfig>) => {
    onChange({
      ...policies,
      vipTiers: policies.vipTiers.map((t) => (t.level === level ? { ...t, ...patch } : t)),
    });
  };

  const addTier = () => {
    onChange({
      ...policies,
      vipTiers: [
        ...policies.vipTiers,
        {
          level: nextLevel,
          name: `VIP ${nextLevel}档`,
          daily: null,
          weekly: null,
          monthly: null,
          total: null,
        },
      ],
    });
  };

  const removeTier = (level: number) => {
    if (level === 1) return;
    onChange({
      ...policies,
      vipTiers: policies.vipTiers.filter((t) => t.level !== level),
    });
  };

  return (
    <Card
      className={glassCardClasses}
      title="四级下载配额与 VIP 等级策略"
      extra={
        <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={onSave}>
          保存全部策略
        </Button>
      }
    >
      <div className="space-y-5">
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          优先级顺序：<strong>账号独立覆盖 &gt; 有效 VIP 等级档 &gt; 大众用户档 &gt; 游客档</strong>；
          常规周期配额不足时自动消耗永久有效的「额外次数」（额外次数不占用日/周/月/总计）。
        </div>

        {/* 1. 游客档 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <Space>
              <Tag color="purple">游客档（未登录设备）</Tag>
              <span className="text-xs text-slate-500">耗尽后客户端弹窗引导登录账号</span>
            </Space>
            <Button
              size="small"
              onClick={() =>
                onChange({ ...policies, guest: { daily: 2, weekly: 10, monthly: 30, total: 30 } })
              }
            >
              恢复推荐 (2/10/30/30)
            </Button>
          </div>
          <QuotaLimitsRow
            limits={policies.guest}
            onChange={(guest) => onChange({ ...policies, guest })}
          />
        </div>

        <Divider className="!my-2" />

        {/* 2. 大众用户档 + 新注册赠送 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <Space wrap>
              <Tag color="blue">大众用户档（已注册非 VIP）</Tag>
              <span className="text-xs text-slate-500">新注册赠送额外下载次数：</span>
              <InputNumber
                size="small"
                min={0}
                max={1000000}
                precision={0}
                value={policies.registerGiftExtraCount}
                addonAfter="次"
                style={{ width: 130 }}
                onChange={(v) =>
                  onChange({
                    ...policies,
                    registerGiftExtraCount: typeof v === "number" ? Math.max(0, Math.trunc(v)) : 0,
                  })
                }
              />
            </Space>
            <Button
              size="small"
              onClick={() =>
                onChange({ ...policies, standard: { daily: 10, weekly: 100, monthly: 1000, total: null } })
              }
            >
              恢复推荐 (10/100/1000/不限)
            </Button>
          </div>
          <QuotaLimitsRow
            limits={policies.standard}
            onChange={(standard) => onChange({ ...policies, standard })}
          />
        </div>

        <Divider className="!my-2" />

        {/* 3. VIP 等级档位 (1..N) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <Space>
              <Tag color="gold">VIP 等级档（隐性，前端不展示）</Tag>
              <span className="text-xs text-slate-500">
                可动态新增 1..N 档，已有 VIP 默认归属 Lv1
              </span>
            </Space>
            <Button size="small" type="primary" ghost icon={<PlusOutlined />} onClick={addTier}>
              新增 VIP 档位（Lv{nextLevel}）
            </Button>
          </div>

          <div className="space-y-3">
            {policies.vipTiers.map((tier) => (
              <div
                key={tier.level}
                className="rounded-xl border border-amber-200/80 bg-amber-50/20 p-3 space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <Space>
                    <Tag color="gold">Lv{tier.level}</Tag>
                    <Input
                      size="small"
                      maxLength={32}
                      value={tier.name}
                      style={{ width: 180 }}
                      onChange={(e) => updateTier(tier.level, { name: e.target.value })}
                      placeholder={`VIP ${tier.level}档`}
                    />
                  </Space>
                  {tier.level !== 1 && (
                    <Popconfirm
                      title={`确认删除 Lv${tier.level} 档位？`}
                      description="已属于该等级的 VIP 用户将回落至 Lv1 限额"
                      onConfirm={() => removeTier(tier.level)}
                    >
                      <Button size="small" danger icon={<DeleteOutlined />}>
                        删除档位
                      </Button>
                    </Popconfirm>
                  )}
                </div>
                <QuotaLimitsRow
                  limits={{
                    daily: tier.daily,
                    weekly: tier.weekly,
                    monthly: tier.monthly,
                    total: tier.total,
                  }}
                  onChange={(next) => updateTier(tier.level, next)}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
