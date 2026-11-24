import { useState } from "react";
import { Card, Segmented, Tag, Typography } from "antd";
import {
  AppstoreOutlined,
  BulbOutlined,
  ClockCircleOutlined,
  LinkOutlined,
  MessageOutlined,
  NotificationOutlined,
  RightOutlined,
  RocketOutlined,
  ScanOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { glassCardClasses } from "../../constants/theme";
import type { SidebarMenuConfig, SidebarMenuItem } from "../../types/sidebarMenu";

function PresetIcon({ iconKey, className }: { iconKey: string; className?: string }) {
  switch (iconKey) {
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
    case "link":
    default:
      return <LinkOutlined className={className} />;
  }
}

function PreviewIcon({
  item,
  sizeClass,
  dark,
}: {
  item: SidebarMenuItem;
  sizeClass: string;
  dark: boolean;
}) {
  const colorClass = dark ? "text-slate-100" : "text-slate-800";
  if (item.iconType === "none") return null;
  if (item.iconType === "image") {
    const src = item.iconUrl || item.iconValue;
    return src ? (
      <img src={src} alt={item.name} className={`${sizeClass} rounded object-cover shrink-0`} />
    ) : (
      <AppstoreOutlined className={`${sizeClass} ${colorClass} shrink-0`} />
    );
  }
  if (item.iconType === "svg") {
    const safeSvg = item.iconValue.replace(/<script[\s\S]*?<\/script>/gi, "");
    return (
      <span
        className={`inline-flex items-center justify-center shrink-0 ${sizeClass} ${colorClass} [&>svg]:w-full [&>svg]:h-full`}
        dangerouslySetInnerHTML={{ __html: safeSvg }}
      />
    );
  }
  return <PresetIcon iconKey={item.iconValue} className={`${sizeClass} ${colorClass} shrink-0`} />;
}

function GridPreviewCard({
  items,
  dark,
}: {
  items: SidebarMenuItem[];
  dark: boolean;
}) {
  if (!items.length) return null;
  const cardBg = dark ? "bg-[#23262e] text-slate-100" : "bg-white text-slate-800";
  return (
    <div className={`rounded-xl p-3 shadow-sm ${cardBg}`}>
      <div className="grid grid-cols-3 gap-y-3 gap-x-2">
        {items.map((item) => {
          const hasDot = item.badgeType === "dot_once" || item.badgeType === "dot_always";
          return (
            <div key={item.id} className="flex flex-col items-center justify-center py-1 px-1">
              <div className="mb-1.5 flex h-7 w-7 items-center justify-center">
                <PreviewIcon item={item} sizeClass="h-6 w-6 text-xl" dark={dark} />
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

const FIXED_ROWS = [
  { label: "导入歌单", icon: <LinkOutlined /> },
  { label: "链接导入", icon: <LinkOutlined /> },
  { label: "定时关闭", icon: <ClockCircleOutlined /> },
  { label: "主题外观", icon: <BulbOutlined /> },
  { label: "意见反馈", icon: <MessageOutlined /> },
  { label: "系统公告", icon: <NotificationOutlined /> },
  { label: "检查更新", icon: <RocketOutlined />, value: "2.8.7" },
];

export default function SidebarMenuPreview({ config }: { config: SidebarMenuConfig }) {
  const [dark, setDark] = useState(false);

  const activeListItems = config.listSection.enabled
    ? config.listSection.items.filter((i) => i.enabled)
    : [];
  const activeGridItems = config.gridSection.enabled
    ? config.gridSection.items.filter((i) => i.enabled)
    : [];
  const hasOnceDot = [...activeListItems, ...activeGridItems].some(
    (i) => i.badgeType === "dot_once",
  );

  const shellBg = dark ? "bg-[#17191d] text-slate-100" : "bg-[#f5f6f8] text-slate-800";
  const cardBg = dark ? "bg-[#23262e] text-slate-100" : "bg-white text-slate-800";
  const dividerBg = dark ? "bg-white/10" : "bg-slate-200/80";
  const subText = dark ? "text-slate-400" : "text-slate-500";

  return (
    <Card
      title="客户端侧栏实时预览"
      className={glassCardClasses}
      extra={
        <Segmented
          size="small"
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

      <div className={`mx-auto max-w-[300px] rounded-2xl border border-slate-200/70 p-3 space-y-2.5 ${shellBg}`}>
        {/* 顶部账号头 */}
        <div className="flex items-center justify-between px-1 py-1">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center text-xs font-semibold text-blue-500">
              PM
            </div>
            <span className="text-sm font-medium">PisaMusic 用户</span>
          </div>
          <div className={`flex items-center gap-2 text-sm ${subText}`}>
            <SettingOutlined />
            <ScanOutlined />
          </div>
        </div>

        {/* 顶部九宫格 */}
        {config.gridSection.position === "top" && (
          <GridPreviewCard items={activeGridItems} dark={dark} />
        )}

        {/* 现有列表卡片 + 底部动态分段 */}
        <div className={`rounded-xl py-1 shadow-sm ${cardBg}`}>
          {FIXED_ROWS.map((row, idx) => (
            <div key={row.label}>
              {idx > 0 && <div className={`mx-3 h-px ${dividerBg}`} />}
              <div className="flex items-center px-3 py-2.5 text-xs">
                <span className="mr-2.5 text-sm opacity-80">{row.icon}</span>
                <span className="flex-1 truncate">{row.label}</span>
                {row.value && <span className={`mr-1 text-[11px] ${subText}`}>{row.value}</span>}
                <RightOutlined className={`text-[10px] ${subText}`} />
              </div>
            </div>
          ))}

          {activeListItems.length > 0 && (
            <div>
              <div className={`mx-3 h-px ${dividerBg}`} />
              {config.listSection.title.trim() && (
                <div className={`px-3 pt-2 pb-0.5 text-[11px] ${subText}`}>
                  {config.listSection.title.trim()}
                </div>
              )}
              {activeListItems.map((item, idx) => (
                <div key={item.id}>
                  {idx > 0 && <div className={`mx-3 h-px ${dividerBg}`} />}
                  <div className="flex items-center px-3 py-2.5 text-xs">
                    {item.iconType !== "none" && (
                      <span className="mr-2.5 flex h-4 w-4 items-center justify-center">
                        <PreviewIcon item={item} sizeClass="h-4 w-4 text-sm" dark={dark} />
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
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 底部九宫格 */}
        {config.gridSection.position === "bottom" && (
          <GridPreviewCard items={activeGridItems} dark={dark} />
        )}
      </div>

      <Typography.Paragraph type="secondary" className="!mt-3 !mb-0 text-xs">
        仅预览已启用的区域与菜单项；客户端主动进入本地模式时会自动隐藏动态下发区域。
      </Typography.Paragraph>
    </Card>
  );
}
