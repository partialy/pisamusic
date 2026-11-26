import { useNavigate } from "react-router-dom";
import { Button, Chip, Separator } from "@heroui/react";
import { ChevronRight, Gauge, Sparkles } from "lucide-react";
import H5HeaderLayout from "../components/H5HeaderLayout";

export function QuotaQueryPage() {
  const navigate = useNavigate();

  return (
    <H5HeaderLayout title="配额查询" subtitle="查看当前账号或设备的剩余下载次数与额外次数余额">
      <div className="rounded-2xl bg-surface-secondary px-4 py-3.5 text-[13px] leading-relaxed text-muted">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="font-semibold text-foreground">功能正在建设中</span>
          <Chip size="sm" variant="soft" color="default">
            <Chip.Label>占位页面</Chip.Label>
          </Chip>
        </div>
        配额实时明细与消耗流水查询页即将上线，目前可在下载受限弹窗中查看当前余量。
      </div>

      <section className="space-y-1.5">
        <div className="flex items-center gap-2 text-[14px] font-semibold text-muted">
          <Gauge className="h-4 w-4 text-accent" />
          <span>相关服务</span>
        </div>
        <div className="divide-y divide-separator border-t border-b border-separator">
          <button
            type="button"
            onClick={() => navigate("/quota-rules")}
            className="flex w-full items-center justify-between gap-3 py-3.5 text-left active:opacity-75"
          >
            <div>
              <div className="text-[14.5px] font-medium text-foreground">下载配额说明</div>
              <div className="mt-0.5 text-[12px] text-muted">查看游客与注册用户的配额与拼额度规则</div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
          </button>
          <button
            type="button"
            onClick={() => navigate("/boost")}
            className="flex w-full items-center justify-between gap-3 py-3.5 text-left active:opacity-75"
          >
            <div>
              <div className="text-[14.5px] font-medium text-foreground">提升配额 & 音质解锁</div>
              <div className="mt-0.5 text-[12px] text-muted">获取更多下载次数及无损/Hi-Res/全景声音质权限</div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
          </button>
        </div>
      </section>
    </H5HeaderLayout>
  );
}

export function BoostQuotaPage() {
  const navigate = useNavigate();

  return (
    <H5HeaderLayout title="提升配额" subtitle="获取更高下载限额、额外下载次数与高规格音质解锁">
      <div className="rounded-2xl bg-accent-soft px-4 py-3.5 text-[13px] leading-relaxed text-muted">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="font-semibold text-accent-soft-foreground">提升配额 & 音质解锁中心</span>
          <Chip size="sm" variant="soft" color="accent">
            <Chip.Label>占位页面</Chip.Label>
          </Chip>
        </div>
        本页面预留用于集中展示下载限额提升方式（账号注册、兑换码、权益授信）及高规格音质解锁指引，后续逐步实装。
      </div>

      <section className="space-y-1.5">
        <div className="flex items-center gap-2 text-[14px] font-semibold text-muted">
          <Sparkles className="h-4 w-4 text-accent" />
          <span>规划包含能力</span>
        </div>
        <div className="divide-y divide-separator border-t border-b border-separator text-[13.5px]">
          <div className="py-3 text-foreground">
            <span className="font-semibold">永久额外下载次数</span>
            <p className="m-0 mt-0.5 text-[12.5px] text-muted">常规周期配额耗尽后自动无缝抵扣，永不过期。</p>
          </div>
          <div className="py-3 text-foreground">
            <span className="font-semibold">高规格音质解锁</span>
            <p className="m-0 mt-0.5 text-[12.5px] text-muted">解锁 KG / WY FLAC、Hi-Res、超清母带及杜比/蝰蛇全景声。</p>
          </div>
          <div className="py-3 text-foreground">
            <span className="font-semibold">兑换码快速核销</span>
            <p className="m-0 mt-0.5 text-[12.5px] text-muted">输入活动兑换码即时叠加配额与高音质权益。</p>
          </div>
        </div>
      </section>

      <Separator />
      <div className="flex flex-wrap gap-2 pt-1">
        <Button size="sm" variant="secondary" className="rounded-full" onPress={() => navigate("/quota-rules")}>
          返回配额说明
        </Button>
        <Button size="sm" variant="outline" className="rounded-full" onPress={() => navigate("/quality")}>
          查看音质说明
        </Button>
      </div>
    </H5HeaderLayout>
  );
}

export function ServiceHomePage() {
  const navigate = useNavigate();

  const entries = [
    { path: "/quota-rules", title: "配额说明", desc: "游客与注册用户下载次数、拼额度及刷新规则", badge: "已上线" },
    { path: "/quality", title: "音质说明", desc: "KG / WY / KW / 云盘各档音质解锁权限对照", badge: "已上线" },
    { path: "/quota", title: "配额查询", desc: "实时查看剩余常规次数与永久额外次数（建设中）", badge: "占位" },
    { path: "/boost", title: "提升配额", desc: "获取更高下载限额与高规格音质解锁指引（建设中）", badge: "占位" },
  ];

  return (
    <H5HeaderLayout title="PisaMusic 服务中心" subtitle="规则说明与自助服务导航">
      <div className="divide-y divide-separator border-t border-b border-separator">
        {entries.map((item) => (
          <button
            key={item.path}
            type="button"
            onClick={() => navigate(item.path)}
            className="flex w-full items-center justify-between gap-3 py-3.5 text-left active:opacity-75"
          >
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-semibold text-foreground">{item.title}</span>
                <Chip size="sm" variant="soft" color={item.badge === "已上线" ? "accent" : "default"}>
                  <Chip.Label>{item.badge}</Chip.Label>
                </Chip>
              </div>
              <p className="m-0 text-[12.5px] text-muted">{item.desc}</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
          </button>
        ))}
      </div>
    </H5HeaderLayout>
  );
}

export function GenericPlaceholderPage({ title, description }: { title: string; description: string }) {
  const navigate = useNavigate();

  return (
    <H5HeaderLayout title={title} subtitle={description}>
      <div className="rounded-2xl bg-surface-secondary px-4 py-3.5 text-[13.5px] leading-relaxed text-muted">
        {description}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" className="rounded-full" onPress={() => navigate("/quota-rules")}>
          配额说明
        </Button>
        <Button size="sm" variant="secondary" className="rounded-full" onPress={() => navigate("/quality")}>
          音质说明
        </Button>
      </div>
    </H5HeaderLayout>
  );
}
