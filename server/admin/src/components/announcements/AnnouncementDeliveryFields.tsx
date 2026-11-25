import { useEffect, useState } from "react";
import { Button, Card, Input, InputNumber, Select, Space, Switch, Typography } from "antd";
import { MAX_ANNOUNCEMENT_WAIT_SECONDS } from "../../utils/announcementDraft";
import { fetchUpdateHistoryPage } from "../../api/client";
import type {
  Announcement,
  AnnouncementPlatform,
  AnnouncementVersionRule,
  ReleaseConfig,
} from "../../types/config";
import {
  announcementPageOptions,
  announcementPlatformOptions,
  describeAnnouncementVersion,
} from "../../utils/announcementPresentation";

const { Text } = Typography;
const ruleOptions = [
  { value: "all", label: "不限版本" },
  { value: "current", label: "当前版本" },
  { value: "specified", label: "指定多个版本" },
  { value: "gte", label: "大于等于" },
  { value: "lte", label: "小于等于" },
] satisfies Array<{ value: AnnouncementVersionRule["mode"]; label: string }>;

type Props = {
  announcement: Announcement;
  releases: ReleaseConfig;
  onChange: (announcement: Announcement) => void;
};

export function AnnouncementDeliveryFields({ announcement, releases, onChange }: Props) {
  const platform = announcement.platform ?? "all";
  const rule = announcement.versionRule ?? { mode: "all" };
  const [historyOptions, setHistoryOptions] = useState<string[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (rule.mode !== "specified") return;
    let cancelled = false;
    setHistoryOptions([]);
    setLoadingHistory(true);
    const releasePlatform = platform === "mobile" ? "android" : platform === "pc" ? "desktop" : "all";
    void fetchUpdateHistoryPage({ platform: releasePlatform, offset: 0, limit: 50 })
      .then(({ list }) => {
        if (!cancelled) setHistoryOptions(list.map(({ version }) => version));
      })
      .catch(() => { /* 手动输入仍可使用。 */ })
      .finally(() => {
        if (!cancelled) setLoadingHistory(false);
      });
    return () => { cancelled = true; };
  }, [platform, rule.mode]);

  const setRule = (versionRule: AnnouncementVersionRule) => onChange({ ...announcement, versionRule });
  const suggestedVersions = {
    ...(platform !== "pc" ? { mobile: releases.android.latestVersion } : {}),
    ...(platform !== "mobile" ? { pc: releases.desktop.latestVersion } : {}),
  };
  const options = [...new Set([...Object.values(suggestedVersions), ...historyOptions])]
    .filter((version) => /^v?\d/i.test(version))
    .map((version) => ({ label: version, value: version }));

  return (
    <Card size="small" title="投放设置" className="rounded-xl">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="announcement-platform" className="mb-1 block text-xs font-semibold">平台</label>
          <Select<AnnouncementPlatform>
            id="announcement-platform"
            className="w-full"
            value={platform}
            options={announcementPlatformOptions}
            onChange={(nextPlatform) => onChange({
              ...announcement,
              platform: nextPlatform,
              versionRule: rule.mode === "current" ? { mode: "current" } : rule,
            })}
          />
        </div>
        <div>
          <label htmlFor="announcement-version-rule" className="mb-1 block text-xs font-semibold">App 版本</label>
          <Select<AnnouncementVersionRule["mode"]>
            id="announcement-version-rule"
            className="w-full"
            value={rule.mode}
            options={ruleOptions}
            onChange={(mode) => {
              switch (mode) {
                case "specified": setRule({ mode, versions: [] }); break;
                case "gte":
                case "lte": setRule({ mode, version: "version" in rule ? rule.version : "" }); break;
                case "all":
                case "current": setRule({ mode }); break;
              }
            }}
          />
        </div>
        {rule.mode === "specified" && (
          <div className="sm:col-span-2">
            <label htmlFor="announcement-versions" className="mb-1 block text-xs font-semibold">指定版本</label>
            <Select<string[]>
              id="announcement-versions"
              className="w-full"
              mode="tags"
              tokenSeparators={[",", "，"]}
              value={rule.versions}
              options={options}
              loading={loadingHistory}
              placeholder="选择历史版本，或输入版本号后按回车"
              onChange={(versions) => setRule({ mode: "specified", versions })}
            />
          </div>
        )}
        {(rule.mode === "gte" || rule.mode === "lte") && (
          <div className="sm:col-span-2">
            <label htmlFor="announcement-version-boundary" className="mb-1 block text-xs font-semibold">版本基线</label>
            <Input
              id="announcement-version-boundary"
              value={rule.version}
              placeholder="例如 v2.0.0"
              onChange={(event) => setRule({ mode: rule.mode, version: event.target.value })}
            />
          </div>
        )}
        {rule.mode === "current" && (
          <div className="sm:col-span-2">
            <Text type="secondary">
              {rule.versions ? `已锁定 ${describeAnnouncementVersion(rule)}` : `保存时锁定当前发布版本（当前配置 ${describeAnnouncementVersion({ mode: "current", versions: suggestedVersions })}）`}
            </Text>
            {rule.versions && <Button type="link" size="small" onClick={() => setRule({ mode: "current" })}>重新选择当前版本</Button>}
          </div>
        )}
        <div>
          <label htmlFor="announcement-wait" className="mb-1 block text-xs font-semibold">确认等待时间（秒）</label>
          <InputNumber
            id="announcement-wait"
            min={0}
            max={MAX_ANNOUNCEMENT_WAIT_SECONDS}
            value={announcement.waitSeconds ?? 0}
            onChange={(waitSeconds) => onChange({ ...announcement, waitSeconds: waitSeconds ?? 0 })}
          />
          <div className="mt-1 text-xs text-slate-500">仅自动弹出时等待，0 秒可立即确认。</div>
        </div>
      </div>
    </Card>
  );
}

export function AnnouncementGotoFields({ announcement, onChange }: Omit<Props, "releases">) {
  const action = announcement.gotoAction;
  const legacy = (announcement.announcementVersion ?? 1) === 1 || Boolean(announcement.gotoUrl);
  const mode = action?.type === "page" ? "page" : action?.openMode ?? (legacy ? "legacy" : "browser");
  const url = action?.type === "url" ? action.url : announcement.gotoUrl ?? "";
  const modes = [
    ...(legacy ? [{ value: "legacy", label: "原有链接" }] : []),
    { value: "browser", label: "系统浏览器" },
    { value: "app", label: "App 内网页" },
    { value: "page", label: "App 页面" },
  ];

  return (
    <div className="space-y-3 border-t border-slate-200/60 pt-3">
      <div className="flex items-center justify-between">
        <label htmlFor="announcement-goto-enabled" className="text-xs font-semibold">显示「前往」按钮</label>
        <Switch
          id="announcement-goto-enabled"
          checked={announcement.showGotoButton}
          onChange={(showGotoButton) => onChange({
            ...announcement,
            showGotoButton,
            gotoAction: showGotoButton && !legacy && !action ? { type: "url", url: "", openMode: "browser" } : action,
          })}
        />
      </div>
      {announcement.showGotoButton && (
        <>
          <Select<"legacy" | "browser" | "app" | "page">
            aria-label="前往动作"
            value={mode}
            options={modes}
            className="w-full"
            onChange={(value) => {
              if (value === "legacy") onChange({ ...announcement, gotoAction: null });
              else if (value === "page") onChange({ ...announcement, gotoAction: { type: "page", page: "discover" } });
              else onChange({
                ...announcement,
                gotoAction: {
                  type: "url",
                  openMode: value,
                  url,
                  ...(value === "app" && { showHeaderBar: true }),
                },
              });
            }}
          />
          {action?.type === "page" ? (
            <Select
              aria-label="目标 App 页面"
              value={action.page}
              options={announcementPageOptions}
              className="w-full"
              onChange={(page: typeof action.page) => onChange({ ...announcement, gotoAction: { ...action, page } })}
            />
          ) : (
            <Input
              aria-label="前往地址"
              value={url}
              placeholder="https://example.com"
              onChange={(event) => onChange(action?.type === "url"
                ? { ...announcement, gotoAction: { ...action, url: event.target.value } }
                : { ...announcement, gotoUrl: event.target.value })}
            />
          )}
          {action?.type === "url" && action.openMode === "app" && (
            <Space>
              <label htmlFor="announcement-goto-header" className="text-xs">显示顶栏</label>
              <Switch
                id="announcement-goto-header"
                size="small"
                checked={action.showHeaderBar !== false}
                onChange={(showHeaderBar) => onChange({ ...announcement, gotoAction: { ...action, showHeaderBar } })}
              />
            </Space>
          )}
        </>
      )}
    </div>
  );
}
