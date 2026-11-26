import { useState } from "react";
import { Card, Segmented, Tag, Typography } from "antd";
import {
  AppstoreOutlined,
  BulbOutlined,
  ClockCircleOutlined,
  DownloadOutlined,
  HistoryOutlined,
  InfoCircleOutlined,
  LinkOutlined,
  LoginOutlined,
  MessageOutlined,
  NotificationOutlined,
  PlayCircleOutlined,
  ReadOutlined,
  RightOutlined,
  RocketOutlined,
  ScanOutlined,
  SettingOutlined,
  ShareAltOutlined,
  SoundOutlined,
} from "@ant-design/icons";
import { adminCardClasses } from "../../constants/theme";
import {
  SIDEBAR_BUILTIN_META,
  type SidebarBuiltinIconType,
  type SidebarBuiltinItem,
  type SidebarMenuConfig,
  type SidebarMenuItem,
} from "../../types/sidebarMenu";

function PresetIcon({ iconKey, className }: { iconKey: string; className?: string }) {
  switch (iconKey) {
    case "login":
      return <LoginOutlined className={className} />;
    case "alarm":
      return <ClockCircleOutlined className={className} />;
    case "theme":
      return <BulbOutlined className={className} />;
    case "feedback":
      return <MessageOutlined className={className} />;
    case "announcement":
      return <NotificationOutlined className={className} />;
    case "update":
      return <RocketOutlined className={className} />;
    case "settings":
      return <SettingOutlined className={className} />;
    case "scan":
      return <ScanOutlined className={className} />;
    case "about":
      return <InfoCircleOutlined className={className} />;
    case "share":
      return <ShareAltOutlined className={className} />;
    case "download":
      return <DownloadOutlined className={className} />;
    case "audio_quality":
      return <SoundOutlined className={className} />;
    case "play":
      return <PlayCircleOutlined className={className} />;
    case "library":
      return <ReadOutlined className={className} />;
    case "history":
      return <HistoryOutlined className={className} />;
    case "link":
    default:
      return <LinkOutlined className={className} />;
  }
}

function PreviewIcon({
  iconType,
  iconValue,
  iconUrl,
  alt,
  defaultKey,
  sizeClass,
  dark,
}: {
  iconType: SidebarBuiltinIconType;
  iconValue: string;
  iconUrl: string;
  alt: string;
  defaultKey?: string;
  sizeClass: string;
  dark: boolean;
}) {
  const colorClass = dark ? "text-slate-100" : "text-slate-800";
  if (iconType === "none") return null;
  if (iconType === "default") {
    return <PresetIcon iconKey={defaultKey ?? "link"} className={`${sizeClass} ${colorClass} shrink-0`} />;
  }
  if (iconType === "image") {
    const src = iconUrl || iconValue;
    return src ? (
      <img src={src} alt={alt} className={`${sizeClass} rounded object-cover shrink-0`} />
    ) : (
      <AppstoreOutlined className={`${sizeClass} ${colorClass} shrink-0`} />
    );
  }
  if (iconType === "svg") {
    const safeSvg = iconValue.replace(/<script[\s\S]*?<\/script>/gi, "");
    return (
      <span
        className={`inline-flex items-center justify-center shrink-0 ${sizeClass} ${colorClass} [&>svg]:w-full [&>svg]:h-full`}
        dangerouslySetInnerHTML={{ __html: safeSvg }}
      />
    );
  }
  return <PresetIcon iconKey={iconValue} className={`${sizeClass} ${colorClass} shrink-0`} />;
}

function GridPreviewCard({
  items,
  dark,
  topMargin,
}: {
  items: SidebarMenuItem[];
  dark: boolean;
  topMargin?: boolean;
}) {
  if (!items.length) return null;
  const cardBg = dark ? "bg-[#1e2126] text-slate-100" : "bg-white text-slate-800";
  return (
    <div className={`mx-2 rounded-[14px] ${topMargin ? "mt-2" : ""} ${cardBg}`}>
      <div className="grid grid-cols-4">
        {items.map((item) => {
          const hasDot = item.badgeType === "dot_once" || item.badgeType === "dot_always";
          return (
            <div key={item.id} className="flex flex-col items-center justify-center py-2.5 px-1">
              <div className="mb-1.5 flex h-7 w-7 items-center justify-center">
                <PreviewIcon
                  iconType={item.iconType}
                  iconValue={item.iconValue}
                  iconUrl={item.iconUrl}
                  alt={item.name}
                  sizeClass="h-6 w-6 text-xl"
                  dark={dark}
                />
              </div>
              <div className="flex items-center justify-center gap-1 max-w-full">
                {hasDot && <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />}
                <span className="truncate text-[11px] leading-tight">{item.name}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BuiltinRowPreview({
  item,
  dark,
}: {
  item: SidebarBuiltinItem;
  dark: boolean;
}) {
  const meta = SIDEBAR_BUILTIN_META.find((m) => m.key === item.key);
  const title = item.name.trim() || meta?.defaultName || item.key;
  const subText = dark ? "text-slate-400" : "text-slate-500";
  return (
    <div className="flex items-center min-h-[44px] px-4 py-2 text-[13px]">
      {item.iconType !== "none" && (
        <span className="mr-3.5 flex h-5 w-5 items-center justify-center">
          <PreviewIcon
            iconType={item.iconType}
            iconValue={item.iconValue}
            iconUrl={item.iconUrl}
            alt={title}
            defaultKey={meta?.defaultIconKey}
            sizeClass="h-5 w-5 text-base"
            dark={dark}
          />
        </span>
      )}
      <span className="flex-1 truncate">{title}</span>
      {item.key === "import_playlists" && (
        <span className="mr-1.5 flex items-center gap-1 text-[10px]">
          <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-blue-500/15 text-blue-500 font-semibold">
            K
          </span>
          <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-slate-500/15 text-slate-400 font-semibold">
            Y
          </span>
        </span>
      )}
      {item.key === "sleep_timer" && (
        <span className={`mr-1.5 text-[11px] ${subText}`}>09:42</span>
      )}
      {item.key === "theme" && (
        <BulbOutlined className={`mr-1.5 text-sm ${subText}`} />
      )}
      <RightOutlined className={`text-[10px] ${subText}`} />
    </div>
  );
}

export default function SidebarMenuPreview({ config }: { config: SidebarMenuConfig }) {
  const [dark, setDark] = useState(false);

  const visibleBuiltinItems = config.builtinItems.filter((item) => item.enabled);
  const activeListSections = config.listSections
    .filter((sec) => sec.enabled)
    .map((sec) => ({
      ...sec,
      items: sec.items.filter((i) => i.enabled),
    }))
    .filter((sec) => sec.items.length > 0);

  const activeGridItems = config.gridSection.enabled
    ? config.gridSection.items.filter((i) => i.enabled)
    : [];

  const hasOnceDot = [
    ...activeListSections.flatMap((s) => s.items),
    ...activeGridItems,
  ].some((i) => i.badgeType === "dot_once");

  const shellBg = dark ? "bg-[#17191d] text-slate-100" : "bg-[#fefefe] text-slate-800";
  const dividerBg = dark ? "bg-white/10" : "bg-slate-200/80";
  const subText = dark ? "text-slate-400" : "text-slate-500";

  return (
    <Card
      bordered={false}
      title="客户端侧栏实时预览"
      className={adminCardClasses}
      extra={
        <Segmented
          value={dark ? "dark" : "light"}
          onChange={(v) => setDark(v === "dark")}
          options={[
            { label: "浅色", value: "light" },
            { label: "深色", value: "dark" },
          ]}
        />
      }
    >
      <div className="mb-3 flex items-center justify-between text-xs text-slate-500">
        <span>外层「三条杠」按钮状态：</span>
        {hasOnceDot ? <Tag color="red">显示红点（含一次性红点）</Tag> : <Tag>无红点</Tag>}
      </div>

      <div
        className={`mx-auto flex max-w-[300px] min-h-[460px] flex-col rounded-2xl border border-slate-200/70 overflow-hidden ${shellBg}`}
      >
        {/* 顶部账号头（对齐新版：无设置/扫码按钮） */}
        <div className="flex items-center px-4 pt-3.5 pb-2.5">
          <div className="h-9 w-9 rounded-full bg-blue-500/20 flex items-center justify-center text-xs font-semibold text-blue-500 shrink-0">
            PM
          </div>
          <span className="ml-2.5 text-sm font-medium truncate">PisaMusic 用户</span>
          <RightOutlined className={`ml-1 text-[10px] ${subText}`} />
        </div>

        {/* 中部滚动内容区 */}
        <div className="flex-1 pb-2">
          {/* 顶部四宫格 */}
          {config.gridSection.position === "top" && (
            <GridPreviewCard items={activeGridItems} dark={dark} />
          )}

          {/* 4 个固定顺序内置项 */}
          {visibleBuiltinItems.map((item) => (
            <BuiltinRowPreview key={item.key} item={item} dark={dark} />
          ))}

          {/* 多区块动态横栏：有标题显示标题，无标题显示分割线 */}
          {activeListSections.map((sec) => (
            <div key={sec.id}>
              {sec.title.trim() ? (
                <div className={`px-4 py-1 text-[11px] ${subText}`}>{sec.title.trim()}</div>
              ) : (
                <div className={`mx-4 my-1 h-px ${dividerBg}`} />
              )}
              {sec.items.map((item) => (
                <div key={item.id} className="flex items-center min-h-[44px] px-4 py-2 text-[13px]">
                  {item.iconType !== "none" && (
                    <span className="mr-3.5 flex h-5 w-5 items-center justify-center">
                      <PreviewIcon
                        iconType={item.iconType}
                        iconValue={item.iconValue}
                        iconUrl={item.iconUrl}
                        alt={item.name}
                        sizeClass="h-5 w-5 text-base"
                        dark={dark}
                      />
                    </span>
                  )}
                  <span className="flex-1 truncate">{item.name}</span>
                  {item.badgeType === "text" && item.subtitleText && (
                    <span className={`mr-1.5 text-[11px] truncate max-w-[90px] ${subText}`}>
                      {item.subtitleText}
                    </span>
                  )}
                  {(item.badgeType === "dot_once" || item.badgeType === "dot_always") && (
                    <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                  )}
                  <RightOutlined className={`text-[10px] ${subText}`} />
                </div>
              ))}
            </div>
          ))}

          {/* 底部四宫格 */}
          {config.gridSection.position === "bottom" && (
            <GridPreviewCard items={activeGridItems} dark={dark} topMargin />
          )}
        </div>

        {/* 底部吸底栏：设置 / 扫码 / 反馈 */}
        <div className="flex items-center px-2 pt-1.5 pb-2.5">
          {[
            { label: "设置", icon: <SettingOutlined /> },
            { label: "扫码", icon: <ScanOutlined /> },
            { label: "反馈", icon: <MessageOutlined /> },
          ].map((btn) => (
            <div
              key={btn.label}
              className="flex w-16 flex-col items-center justify-center py-1.5"
            >
              <span className="text-[17px] leading-none">{btn.icon}</span>
              <span className="mt-1 text-[11px] leading-tight">{btn.label}</span>
            </div>
          ))}
        </div>
      </div>

      <Typography.Paragraph type="secondary" className="!mt-3 !mb-0 text-xs">
        仅预览已启用的内置项、区块与入口；客户端离线或处于本地模式时，内置项默认全部显示并回退默认文案/图标，动态区块与四宫格隐藏。
      </Typography.Paragraph>
    </Card>
  );
}
