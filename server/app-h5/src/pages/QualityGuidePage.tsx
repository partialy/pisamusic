import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Accordion,
  Button,
  Chip,
  SearchField,
  Separator,
  Tabs,
} from "@heroui/react";
import { ChevronDown, ChevronRight, Lock, Unlock } from "lucide-react";
import H5HeaderLayout from "../components/H5HeaderLayout";

type AccessRequirement = "guest" | "login" | "unlock";
type SourceKey = "all" | "kg" | "wy" | "kw" | "cloud";

type QualityRuleRow = {
  id: string;
  source: Exclude<SourceKey, "all">;
  sourceLabel: string;
  label: string;
  access: AccessRequirement;
  note: string;
};

const QUALITY_RULES: QualityRuleRow[] = [
  // KG 酷狗
  { id: "kg-128", source: "kg", sourceLabel: "KG", label: "128 kbps MP3", access: "guest", note: "基础音质，无需登录即可播放与下载" },
  { id: "kg-320", source: "kg", sourceLabel: "KG", label: "320 kbps MP3", access: "login", note: "高码率 MP3，登录 PisaMusic 账号即可使用" },
  { id: "kg-high", source: "kg", sourceLabel: "KG", label: "无损 (high)", access: "login", note: "高保真无损档，登录 PisaMusic 账号即可使用" },
  { id: "kg-flac", source: "kg", sourceLabel: "KG", label: "FLAC", access: "unlock", note: "原生 FLAC 无损音质，需系统解锁权限" },
  { id: "kg-atmos", source: "kg", sourceLabel: "KG", label: "蝰蛇全景声", access: "unlock", note: "环绕全景声效，需系统解锁权限" },
  { id: "kg-clear", source: "kg", sourceLabel: "KG", label: "蝰蛇超清音质", access: "unlock", note: "母带超清档位，需系统解锁权限" },

  // WY 网易云
  { id: "wy-br-128", source: "wy", sourceLabel: "WY", label: "[码率] 128 kbps", access: "guest", note: "基础 MP3 码率，无需登录即可使用" },
  { id: "wy-std", source: "wy", sourceLabel: "WY", label: "[音质等级] 标准 standard", access: "guest", note: "标准音质等级，无需登录即可使用" },
  { id: "wy-higher", source: "wy", sourceLabel: "WY", label: "[音质等级] 较高 higher", access: "login", note: "登录 PisaMusic 账号即可使用" },
  { id: "wy-exhigh", source: "wy", sourceLabel: "WY", label: "[音质等级] 极高 exhigh", access: "login", note: "极高音质等级，登录 PisaMusic 账号即可使用" },
  { id: "wy-br-320", source: "wy", sourceLabel: "WY", label: "[码率] 320 kbps", access: "unlock", note: "320k 码率档，需系统解锁权限" },
  { id: "wy-br-max", source: "wy", sourceLabel: "WY", label: "[码率] 999000（最大）", access: "unlock", note: "最大码率档，需系统解锁权限" },
  { id: "wy-lossless", source: "wy", sourceLabel: "WY", label: "[音质等级] 无损 lossless", access: "unlock", note: "无损 FLAC，需系统解锁权限" },
  { id: "wy-hires", source: "wy", sourceLabel: "WY", label: "[音质等级] Hi-Res", access: "unlock", note: "高解析度 Hi-Res 音质，需系统解锁权限" },
  { id: "wy-jyeffect", source: "wy", sourceLabel: "WY", label: "[音质等级] 高清环绕声", access: "unlock", note: "空间音效档位，需系统解锁权限" },
  { id: "wy-sky", source: "wy", sourceLabel: "WY", label: "[音质等级] 沉浸环绕声", access: "unlock", note: "沉浸声效档位，需系统解锁权限" },
  { id: "wy-dolby", source: "wy", sourceLabel: "WY", label: "[音质等级] 杜比全景声", access: "unlock", note: "杜比全景声档位，需系统解锁权限" },
  { id: "wy-jymaster", source: "wy", sourceLabel: "WY", label: "[音质等级] 超清母带", access: "unlock", note: "母带级音质，需系统解锁权限" },

  // KW 酷我 & Cloud 云盘
  { id: "kw-std", source: "kw", sourceLabel: "KW", label: "标准 standard", access: "guest", note: "全状态开放，无需额外解锁" },
  { id: "kw-exhigh", source: "kw", sourceLabel: "KW", label: "极高 exhigh", access: "guest", note: "全状态开放，无需额外解锁" },
  { id: "kw-lossless", source: "kw", sourceLabel: "KW", label: "无损 lossless", access: "guest", note: "全状态开放，无需额外解锁" },
  { id: "cloud-def", source: "cloud", sourceLabel: "云盘", label: "默认 (cloud:default)", access: "guest", note: "共享云盘原档直链，全状态开放" },
];

const SOURCE_TABS: Array<{ id: SourceKey; label: string }> = [
  { id: "all", label: "全部" },
  { id: "kg", label: "KG" },
  { id: "wy", label: "WY" },
  { id: "kw", label: "KW" },
  { id: "cloud", label: "云盘" },
];

function renderAccessChip(access: AccessRequirement) {
  if (access === "guest") {
    return (
      <Chip size="sm" variant="soft" color="success">
        <Unlock className="h-3 w-3" />
        <Chip.Label>无需登录</Chip.Label>
      </Chip>
    );
  }
  if (access === "login") {
    return (
      <Chip size="sm" variant="soft" color="accent">
        <Chip.Label>需登录</Chip.Label>
      </Chip>
    );
  }
  return (
    <Chip size="sm" variant="soft" color="warning">
      <Lock className="h-3 w-3" />
      <Chip.Label>需解锁</Chip.Label>
    </Chip>
  );
}

export default function QualityGuidePage() {
  const navigate = useNavigate();
  const [sourceTab, setSourceTab] = useState<SourceKey>("all");
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();

  const visibleRows = useMemo(() => {
    return QUALITY_RULES.filter((row) => {
      if (sourceTab !== "all" && row.source !== sourceTab) return false;
      if (!query) return true;
      const accessText =
        row.access === "guest" ? "无需登录 游客" : row.access === "login" ? "需登录 注册用户" : "需解锁 联系作者";
      return (
        row.label.toLowerCase().includes(query) ||
        row.sourceLabel.toLowerCase().includes(query) ||
        row.note.toLowerCase().includes(query) ||
        accessText.includes(query)
      );
    });
  }, [query, sourceTab]);

  return (
    <H5HeaderLayout
      title="音质锁定说明"
      subtitle="各音源在不同登录或授权状态下的可用与锁定音质范围"
      stickySlot={
        <div className="space-y-2">
          <SearchField
            fullWidth
            aria-label="搜索音质档位"
            value={search}
            onChange={setSearch}
            className="w-full"
          >
            <SearchField.Group className="h-10 w-full min-w-0 rounded-full bg-field px-1 shadow-none">
              <SearchField.SearchIcon className="ms-3 size-4 shrink-0 text-muted" />
              <SearchField.Input
                placeholder="搜索音质名称，如 无损、Hi-Res、杜比、320…"
                className="min-w-0 flex-1 text-[14px]"
              />
              <SearchField.ClearButton className="me-1.5" />
            </SearchField.Group>
          </SearchField>

          <Tabs
            variant="secondary"
            selectedKey={sourceTab}
            onSelectionChange={(key) => setSourceTab(String(key) as SourceKey)}
            className="w-full"
          >
            <Tabs.ListContainer>
              <Tabs.List aria-label="音源筛选" className="w-full">
                {SOURCE_TABS.map((tab) => (
                  <Tabs.Tab key={tab.id} id={tab.id} className="flex-1 px-2 text-[13px] font-medium">
                    {tab.label}
                    <Tabs.Indicator />
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs.ListContainer>
          </Tabs>
        </div>
      }
    >
      {/* 独立性提醒 & 提升配额跳转（单层轻底直铺，无重边框） */}
      <button
        type="button"
        onClick={() => navigate("/boost")}
        className="flex w-full items-center justify-between gap-3 rounded-2xl bg-warning-soft px-3.5 py-3 text-left transition-opacity active:opacity-80"
      >
        <div className="min-w-0 flex-1 space-y-1">
          <div className="text-[13px] font-semibold text-warning-soft-foreground">
            音质权益与第三方音乐平台账号无关
          </div>
          <p className="m-0 text-[12px] leading-relaxed text-muted">
            如有更高音质解锁或限额需求，请查看{" "}
            <span className="font-bold text-foreground underline underline-offset-2">提升配额</span> 页面。
          </p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-warning-soft-foreground" />
      </button>

      {/* 音质权限列表直铺页面 */}
      <section className="space-y-1.5">
        <div className="flex items-center justify-between">
          <h2 className="text-[14px] font-semibold text-muted">可用与锁定音质清单</h2>
          <span className="text-[12px] text-muted">{visibleRows.length} 项</span>
        </div>

        {visibleRows.length === 0 ? (
          <div className="py-10 text-center text-[13.5px] text-muted">
            未匹配到「{search}」相关音质项
          </div>
        ) : (
          <div className="divide-y divide-separator border-t border-b border-separator">
            {visibleRows.map((row) => (
              <div key={row.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex shrink-0 items-center rounded-md bg-surface-secondary px-1.5 py-0.5 text-[11px] font-semibold text-muted">
                      {row.sourceLabel}
                    </span>
                    <span className="text-[14px] font-medium text-foreground">{row.label}</span>
                  </div>
                  <p className="m-0 text-[12px] leading-relaxed text-muted">{row.note}</p>
                </div>
                <div className="shrink-0">{renderAccessChip(row.access)}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 常见问题（扁平无框直铺） */}
      <section className="space-y-1">
        <h2 className="text-[14px] font-semibold text-muted">常见问题</h2>
        <Accordion className="h5-flat-accordion border-t border-b border-separator">
          <Accordion.Item id="why-grey">
            <Accordion.Heading>
              <Accordion.Trigger className="text-[14px] font-medium text-foreground">
                为什么音质选择器里部分选项是灰色不可选？
                <Accordion.Indicator>
                  <ChevronDown className="h-4 w-4 text-muted" />
                </Accordion.Indicator>
              </Accordion.Trigger>
            </Accordion.Heading>
            <Accordion.Panel>
              <Accordion.Body className="text-[13px] leading-relaxed text-muted">
                灰色并带有「需登录」标签的音质，在登录 PisaMusic 账号后即可直接使用；带有「需解锁」标签的超高规格音质（如 FLAC、Hi-Res、母带、全景声等），可在选中时按提示申请解锁或前往{" "}
                <strong className="text-foreground">提升配额</strong> 页面查看详情。
              </Accordion.Body>
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item id="default-fallback">
            <Accordion.Heading>
              <Accordion.Trigger className="text-[14px] font-medium text-foreground">
                如果设置了固定默认音质但权限不足会怎样？
                <Accordion.Indicator>
                  <ChevronDown className="h-4 w-4 text-muted" />
                </Accordion.Indicator>
              </Accordion.Trigger>
            </Accordion.Heading>
            <Accordion.Panel>
              <Accordion.Body className="text-[13px] leading-relaxed text-muted">
                在线播放时会自动安全回落到当前权限允许的基础音质，不会卡死无法播放；批量/单曲下载时则会提示您重新选择当前可用的音质档位。
              </Accordion.Body>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      </section>

      <Separator />
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <span className="text-[12.5px] text-muted">查看下载次数的扣减与刷新方式</span>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" className="rounded-full" onPress={() => navigate("/quota-rules")}>
            配额说明
          </Button>
          <Button size="sm" className="rounded-full" onPress={() => navigate("/boost")}>
            提升配额
          </Button>
        </div>
      </div>
    </H5HeaderLayout>
  );
}
