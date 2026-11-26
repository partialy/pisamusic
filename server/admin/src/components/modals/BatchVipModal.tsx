import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  DatePicker,
  Input,
  InputNumber,
  Modal,
  Radio,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { CrownOutlined, SearchOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { batchAssignAdminUserVip, resolveAdminUsersForVip } from "../../api/client";
import { fetchTierPolicies } from "../../api/songDownloads";
import type { AdminVipResolvedUser } from "../../types/config";
import type { VipTierConfig } from "../../types/songDownloads";
import { formatTimestamp } from "../../utils/date";

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export default function BatchVipModal({ open, onClose, onSuccess }: Props) {
  const [rawText, setRawText] = useState("");
  const [resolving, setResolving] = useState(false);
  const [matched, setMatched] = useState<AdminVipResolvedUser[]>([]);
  const [notFound, setNotFound] = useState<string[]>([]);
  const [hasQueried, setHasQueried] = useState(false);

  const [tiers, setTiers] = useState<VipTierConfig[]>([]);
  const [action, setAction] = useState<"grant" | "revoke">("grant");
  const [vipLevel, setVipLevel] = useState(1);
  const [mode, setMode] = useState<"duration_days" | "expires_at">("duration_days");
  const [durationDays, setDurationDays] = useState(30);
  const [expiresAt, setExpiresAt] = useState<dayjs.Dayjs | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRawText("");
    setMatched([]);
    setNotFound([]);
    setHasQueried(false);
    setAction("grant");
    setVipLevel(1);
    setMode("duration_days");
    setDurationDays(30);
    setExpiresAt(null);
    fetchTierPolicies()
      .then((res) => setTiers(res.vipTiers))
      .catch(() => undefined);
  }, [open]);

  const handleResolve = async () => {
    if (!rawText.trim()) {
      message.warning("请输入邮箱或用户 ID");
      return;
    }
    setResolving(true);
    try {
      const res = await resolveAdminUsersForVip(rawText);
      setMatched(res.matched);
      setNotFound(res.notFound);
      setHasQueried(true);
    } catch (e) {
      message.error(e instanceof Error ? e.message : "查询用户失败");
    } finally {
      setResolving(false);
    }
  };

  const handleSubmit = async () => {
    if (!matched.length) {
      message.warning("请先查询并确认至少一个有效用户");
      return;
    }
    if (action === "grant" && mode === "expires_at") {
      if (!expiresAt || expiresAt.valueOf() <= Date.now()) {
        message.warning("请选择晚于当前时间的到期时间");
        return;
      }
    }
    setSubmitting(true);
    try {
      const res = await batchAssignAdminUserVip({
        userIds: matched.map((u) => u.id),
        action,
        vipLevel,
        mode,
        durationDays,
        expiresAt: expiresAt?.valueOf(),
      });
      message.success(
        action === "revoke"
          ? `已取消 ${res.updatedCount} 位用户的 VIP`
          : `已成功为 ${res.updatedCount} 位用户赋予 VIP`,
      );
      onSuccess();
      onClose();
    } catch (e) {
      message.error(e instanceof Error ? e.message : "批量操作失败");
    } finally {
      setSubmitting(false);
    }
  };

  const columns: ColumnsType<AdminVipResolvedUser> = [
    {
      title: "用户",
      render: (_v, r) => (
        <div>
          <span className="font-medium text-slate-800">{r.username}</span>
          <div className="font-mono text-xs text-slate-400">{r.id}</div>
        </div>
      ),
    },
    {
      title: "邮箱",
      dataIndex: "email",
      render: (email: string) => <span className="font-mono text-xs">{email || "-"}</span>,
    },
    {
      title: "当前 VIP 状态",
      render: (_v, r) =>
        r.vip ? (
          <Space size={4}>
            <Tag color="gold">VIP Lv{r.vipLevel}</Tag>
            <span className="text-xs text-slate-500">
              {r.vipExpiresAt ? formatTimestamp(r.vipExpiresAt) : "-"}
            </span>
          </Space>
        ) : (
          <Tag>普通（历史 Lv{r.vipLevel}）</Tag>
        ),
    },
  ];

  return (
    <Modal
      open={open}
      centered
      title={
        <Space>
          <CrownOutlined className="text-amber-500" />
          <span>批量赋予 / 管理 VIP</span>
        </Space>
      }
      width={720}
      onCancel={onClose}
      onOk={() => void handleSubmit()}
      okText={action === "revoke" ? `确认取消 (${matched.length}人)` : `确认赋予 (${matched.length}人)`}
      okButtonProps={{ disabled: matched.length === 0, loading: submitting, danger: action === "revoke" }}
      cancelText="取消"
      destroyOnClose
    >
      <div className="space-y-4 pt-2 max-h-[72vh] overflow-y-auto pr-1">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Typography.Text strong className="text-sm">
              1. 输入用户邮箱或用户 ID（支持换行、逗号或空格分隔）
            </Typography.Text>
            <Button
              type="primary"
              ghost
              size="small"
              icon={<SearchOutlined />}
              loading={resolving}
              onClick={() => void handleResolve()}
            >
              查询用户
            </Button>
          </div>
          <Input.TextArea
            rows={4}
            placeholder={"每行一个邮箱或用户 ID，例如：\nuser1@example.com\nuser2@example.com"}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
          />
        </div>

        {hasQueried && (
          <div className="space-y-2">
            {notFound.length > 0 && (
              <Alert
                type="warning"
                showIcon
                message={`以下 ${notFound.length} 项未查到对应用户（已自动跳过）：${notFound.join("、")}`}
              />
            )}
            <Table<AdminVipResolvedUser>
              rowKey="id"
              size="small"
              columns={columns}
              dataSource={matched}
              pagination={{ pageSize: 5, hideOnSinglePage: true }}
              locale={{ emptyText: "未匹配到任何有效用户" }}
            />
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-3">
          <Typography.Text strong className="block text-sm">
            2. 设置赋予策略（已有有效 VIP 时：时长叠加，等级取最高值上升）
          </Typography.Text>

          <Space wrap size="large">
            <div>
              <span className="text-xs text-slate-500 mr-2">操作：</span>
              <Radio.Group value={action} onChange={(e) => setAction(e.target.value)} size="small">
                <Radio.Button value="grant">赋予 / 续期 VIP</Radio.Button>
                <Radio.Button value="revoke">取消 VIP</Radio.Button>
              </Radio.Group>
            </div>

            {action === "grant" && (
              <div>
                <span className="text-xs text-slate-500 mr-2">目标 VIP 等级：</span>
                {tiers.length > 0 ? (
                  <Select
                    size="small"
                    style={{ width: 170 }}
                    value={vipLevel}
                    onChange={setVipLevel}
                    options={tiers.map((t) => ({
                      value: t.level,
                      label: `${t.level} 档（${t.name}）`,
                    }))}
                  />
                ) : (
                  <InputNumber
                    size="small"
                    min={1}
                    max={1000}
                    value={vipLevel}
                    onChange={(v) => setVipLevel(Number(v) || 1)}
                  />
                )}
              </div>
            )}
          </Space>

          {action === "grant" && (
            <div className="flex flex-wrap items-center gap-3">
              <Radio.Group value={mode} onChange={(e) => setMode(e.target.value)} size="small">
                <Radio.Button value="duration_days">按天数叠加</Radio.Button>
                <Radio.Button value="expires_at">指定到期时间</Radio.Button>
              </Radio.Group>

              {mode === "duration_days" ? (
                <Space size={6}>
                  <InputNumber
                    size="small"
                    min={1}
                    max={36500}
                    precision={0}
                    value={durationDays}
                    onChange={(v) => setDurationDays(Math.max(1, Number(v) || 1))}
                    addonAfter="天"
                  />
                  {[7, 30, 90, 365].map((d) => (
                    <Button key={d} size="small" onClick={() => setDurationDays(d)}>
                      {d}天
                    </Button>
                  ))}
                </Space>
              ) : (
                <DatePicker
                  size="small"
                  showTime
                  format="YYYY-MM-DD HH:mm:ss"
                  value={expiresAt}
                  onChange={setExpiresAt}
                  disabledDate={(cur) => cur && cur.valueOf() < dayjs().startOf("day").valueOf()}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
