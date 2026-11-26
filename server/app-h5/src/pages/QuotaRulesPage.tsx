import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Accordion,
  Button,
  Chip,
  SearchField,
  Separator,
} from "@heroui/react";
import {
  ChevronDown,
  ChevronRight,
  Clock,
  Layers,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UserX,
} from "lucide-react";
import H5HeaderLayout from "../components/H5HeaderLayout";

type RuleSectionItem = {
  id: string;
  keywords: string;
  question: string;
  answer: string;
};

const QUOTA_FAQ_ITEMS: RuleSectionItem[] = [
  {
    id: "deduction",
    keywords: "拼额度 额外次数 扣减 顺序 占用 常规",
    question: "「额外次数」和常规下载次数如何扣减？",
    answer:
      "下载时优先扣减当天/本周/本月/总数的常规配额；若常规余量不足，系统会自动使用永久「额外次数」补齐差额。消耗额外次数不会计入日/周/月/总常规已用统计。",
  },
  {
    id: "dedup",
    keywords: "重复 同曲 同音质 失败 跳过 扣费",
    question: "重复下载同一首歌、或者下载失败会扣次数吗？",
    answer:
      "同一首歌曲同一音质在本地已下载完成或已存在队列中会自动跳过，不发起扣减；此外网络校验未通过或入队前被取消也不会扣减次数。同一首歌曲切换不同音质下载会正常计入。",
  },
  {
    id: "refresh",
    keywords: "刷新 重置 时间 0点 周一 1号 北京时间",
    question: "周期配额什么时候刷新？",
    answer:
      "所有周期配额均按北京时间（UTC+8）计算：每日限额于每天 00:00 刷新，每周限额于每周一 00:00 刷新，每月限额于每月 1 日 00:00 刷新。",
  },
  {
    id: "guest-login",
    keywords: "游客 登录 合并 共享 多端",
    question: "游客设备配额和注册账号配额互通吗？",
    answer:
      "不互通。未登录游客按当前设备独立计次；登录后按 PisaMusic 账号计次，并在手机端与 PC 桌面端之间跨端共享可用配额。",
  },
];

export default function QuotaRulesPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();

  const showTiers = useMemo(() => {
    if (!query) return true;
    return (
      "游客 设备 注册 用户 两档 配额 跨端 共享".includes(query) ||
      "guest standard".includes(query)
    );
  }, [query]);

  const showDeduction = useMemo(() => {
    if (!query) return true;
    return "拼额度 额外次数 常规 北京时间 刷新 0点 重复 失败 幂等".includes(query);
  }, [query]);

  const filteredFaqs = useMemo(() => {
    if (!query) return QUOTA_FAQ_ITEMS;
    return QUOTA_FAQ_ITEMS.filter(
      (item) =>
        item.question.toLowerCase().includes(query) ||
        item.answer.toLowerCase().includes(query) ||
        item.keywords.toLowerCase().includes(query),
    );
  }, [query]);

  return (
    <H5HeaderLayout
      title="下载配额说明"
      subtitle="了解游客与注册用户的下载次数及额外次数抵扣规则"
      stickySlot={
        <SearchField
          fullWidth
          aria-label="搜索配额规则"
          value={search}
          onChange={setSearch}
          className="w-full"
        >
          <SearchField.Group className="h-10 w-full min-w-0 rounded-full bg-field px-1 shadow-none">
            <SearchField.SearchIcon className="ms-3 size-4 shrink-0 text-muted" />
            <SearchField.Input
              placeholder="搜索配额规则、额外次数、刷新时间…"
              className="min-w-0 flex-1 text-[14px]"
            />
            <SearchField.ClearButton className="me-1.5" />
          </SearchField.Group>
        </SearchField>
      }
    >
      {/* 提升配额直铺提示条（无边框多层嵌套） */}
      <button
        type="button"
        onClick={() => navigate("/boost")}
        className="flex w-full items-center justify-between gap-3 rounded-2xl bg-accent-soft px-3.5 py-3 text-left transition-opacity active:opacity-80"
      >
        <div className="min-w-0 flex-1 text-[13px] leading-relaxed text-foreground">
          如有更高限额需求，请查看{" "}
          <span className="font-bold text-accent-soft-foreground underline underline-offset-2">
            提升配额
          </span>{" "}
          页面。
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-accent-soft-foreground" />
      </button>

      {/* 基础配额档位（仅展示 游客 / 注册用户，直铺页面上） */}
      {showTiers && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[14px] font-semibold text-muted">基础配额档位</h2>
            <Chip size="sm" variant="soft" color="accent">
              <Chip.Label>两档基础说明</Chip.Label>
            </Chip>
          </div>

          {/* 游客 */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <UserX className="h-4 w-4 shrink-0 text-muted" />
                <span className="text-[16px] font-bold text-foreground">游客</span>
              </div>
              <Chip size="sm" variant="soft" color="default">
                <Chip.Label>未登录设备</Chip.Label>
              </Chip>
            </div>
            <p className="m-0 text-[13px] leading-relaxed text-muted">
              按当前使用设备独立计算试用次数，更换设备或卸载不共享。
            </p>
            <div className="divide-y divide-separator border-t border-b border-separator text-[13.5px]">
              <div className="flex items-center justify-between gap-3 py-2.5">
                <span className="text-muted">计次主体</span>
                <span className="font-medium text-foreground">单台设备隔离</span>
              </div>
              <div className="flex items-center justify-between gap-3 py-2.5">
                <span className="text-muted">限制维度</span>
                <span className="font-medium text-foreground">日 / 周 / 月 / 累计总上限</span>
              </div>
              <div className="flex items-center justify-between gap-3 py-2.5">
                <span className="text-muted">用尽提示</span>
                <span className="font-medium text-accent">可登录账号解锁更高额度</span>
              </div>
            </div>
          </div>

          {/* 注册用户 */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 shrink-0 text-accent" />
                <span className="text-[16px] font-bold text-foreground">注册用户</span>
              </div>
              <Chip size="sm" variant="soft" color="accent">
                <Chip.Label>多端共享</Chip.Label>
              </Chip>
            </div>
            <p className="m-0 text-[13px] leading-relaxed text-muted">
              登录 PisaMusic 账号后，手机端与桌面端共用同一配额池。
            </p>
            <div className="divide-y divide-separator border-t border-b border-separator text-[13.5px]">
              <div className="flex items-center justify-between gap-3 py-2.5">
                <span className="text-muted">计次主体</span>
                <span className="font-medium text-foreground">账号跨端共享</span>
              </div>
              <div className="flex items-center justify-between gap-3 py-2.5">
                <span className="text-muted">常规额度</span>
                <span className="font-medium text-foreground">更高的日 / 周 / 月周期限额</span>
              </div>
              <div className="flex items-center justify-between gap-3 py-2.5">
                <span className="text-muted">额外次数</span>
                <span className="font-medium text-success">新注册可获赠永久额外次数</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 配额计算与拼额度规则（直接平铺行，无边框盒套娃） */}
      {showDeduction && (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-[14px] font-semibold text-muted">配额计算与拼额度规则</h2>
            <span className="text-[11px] text-muted">具体余量见配额查询</span>
          </div>

          <div className="divide-y divide-separator border-t border-b border-separator">
            <div className="flex items-start gap-3 py-3">
              <Layers className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <div className="text-[13px] leading-relaxed text-muted">
                <span className="font-semibold text-foreground">常规优先，额外补足（拼额度）：</span>
                下载时先消耗常规周期额度；某项周期余量不足时，自动使用永久额外次数补齐差额。
              </div>
            </div>

            <div className="flex items-start gap-3 py-3">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <div className="text-[13px] leading-relaxed text-muted">
                <span className="font-semibold text-foreground">额外次数不过期、不占周期：</span>
                使用额外次数完成下载时，不会增加当日、本周或本月的常规已用计数。
              </div>
            </div>

            <div className="flex items-start gap-3 py-3">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <div className="text-[13px] leading-relaxed text-muted">
                <span className="font-semibold text-foreground">北京时间准点重置：</span>
                每日 00:00、每周一 00:00、每月 1 日 00:00 自动刷新周期已用计数。
              </div>
            </div>

            <div className="flex items-start gap-3 py-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <div className="text-[13px] leading-relaxed text-muted">
                <span className="font-semibold text-foreground">幂等保护：</span>
                已存在本地的同曲同音质歌曲跳过入队，不消耗任何下载次数。
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 常见问题（扁平无框手风琴） */}
      {filteredFaqs.length > 0 && (
        <section className="space-y-1">
          <h2 className="text-[14px] font-semibold text-muted">常见问题</h2>
          <Accordion className="h5-flat-accordion border-t border-b border-separator">
            {filteredFaqs.map((item) => (
              <Accordion.Item key={item.id} id={item.id}>
                <Accordion.Heading>
                  <Accordion.Trigger className="text-[14px] font-medium text-foreground">
                    {item.question}
                    <Accordion.Indicator>
                      <ChevronDown className="h-4 w-4 text-muted" />
                    </Accordion.Indicator>
                  </Accordion.Trigger>
                </Accordion.Heading>
                <Accordion.Panel>
                  <Accordion.Body className="text-[13px] leading-relaxed text-muted">
                    {item.answer}
                  </Accordion.Body>
                </Accordion.Panel>
              </Accordion.Item>
            ))}
          </Accordion>
        </section>
      )}

      {!showTiers && !showDeduction && filteredFaqs.length === 0 && (
        <div className="py-10 text-center text-[13.5px] text-muted">
          没有找到与「{search}」匹配的说明条目
        </div>
      )}

      {/* 底部直铺联动操作区 */}
      <Separator />
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <span className="text-[12.5px] text-muted">
          如有更高限额需求，请查看{" "}
          <button
            type="button"
            onClick={() => navigate("/boost")}
            className="inline cursor-pointer border-0 bg-transparent p-0 font-bold text-foreground underline underline-offset-2"
          >
            提升配额
          </button>{" "}
          页面
        </span>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" className="rounded-full" onPress={() => navigate("/quality")}>
            音质说明
          </Button>
          <Button size="sm" variant="outline" className="rounded-full" onPress={() => navigate("/quota")}>
            配额查询
          </Button>
        </div>
      </div>
    </H5HeaderLayout>
  );
}
