import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Avatar,
  Badge,
  Button,
  ConfigProvider,
  Drawer,
  Layout,
  Menu,
  type MenuProps,
  Popover,
  Space,
  Tag,
  Typography,
} from "antd";
import {
  AlertOutlined,
  BgColorsOutlined,
  BugOutlined,
  CloudUploadOutlined,
  ControlOutlined,
  CustomerServiceOutlined,
  DashboardOutlined,
  DesktopOutlined,
  ExportOutlined,
  FileTextOutlined,
  FolderOutlined,
  GlobalOutlined,
  KeyOutlined,
  LogoutOutlined,
  MenuOutlined,
  MessageOutlined,
  NotificationOutlined,
  ReloadOutlined,
  RocketOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  ShareAltOutlined,
  SlidersOutlined,
  TeamOutlined,
  TrophyOutlined,
  UserOutlined,
} from "@ant-design/icons";
import zhCN from "antd/locale/zh_CN";
import "dayjs/locale/zh-cn";
import dayjs from "dayjs";
import { bgPresets, colorPresets } from "../constants/theme";
import { loadTheme, saveTheme } from "../utils/themeStorage";
import { useAuth } from "../auth/AuthContext";
import { useAdminConfigWorkspace } from "../state/AdminConfigWorkspaceContext";
import {
  AdminLayoutContext,
  type AdminPageActions,
} from "./AdminLayoutContext";
import {
  ADMIN_ROUTES,
  findAdminRouteByKey,
  findAdminRouteByPath,
} from "../router/adminRoutes";
import JsonExportModal from "../components/modals/JsonExportModal";
import ChangePasswordModal from "../components/modals/ChangePasswordModal";

dayjs.locale("zh-cn");

const { Text } = Typography;

function tabFallback() {
  return (
    <div className="flex items-center justify-center py-24 text-slate-500 font-semibold animate-fade-in-up">
      加载中…
    </div>
  );
}

const initialTheme = loadTheme();

export default function AdminLayout() {
  const { logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { loadError, hydrated, refreshRemote, exportPayload } = useAdminConfigWorkspace();

  const [themeColor, setThemeColor] = useState(initialTheme.themeColor);
  const [bgIndex, setBgIndex] = useState(initialTheme.bgIndex);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [pageActions, setPageActions] = useState<AdminPageActions | null>(null);

  const currentRoute = useMemo(
    () => findAdminRouteByPath(location.pathname) ?? ADMIN_ROUTES[0],
    [location.pathname],
  );
  const currentTab = currentRoute.key;

  const [openKeys, setOpenKeys] = useState<string[]>(() => {
    return currentRoute.groupKey
      ? [currentRoute.groupKey]
      : ["user_group", "media_group", "operation_group", "maintenance_group", "system_group"];
  });

  useEffect(() => {
    if (currentRoute.groupKey) {
      setOpenKeys((prev) => (prev.includes(currentRoute.groupKey!) ? prev : [...prev, currentRoute.groupKey!]));
    }
  }, [currentRoute.groupKey]);

  useEffect(() => {
    saveTheme({ themeColor, bgIndex });
  }, [themeColor, bgIndex]);

  const registerPageActions = useCallback((actions: AdminPageActions | null) => {
    setPageActions(actions);
  }, []);

  const menuItems: MenuProps["items"] = useMemo(
    () => [
      { key: "dashboard", icon: <DashboardOutlined />, label: "仪表盘" },
      {
        key: "user_group",
        icon: <TeamOutlined />,
        label: "用户中心",
        children: [
          { key: "users", icon: <UserOutlined />, label: "用户管理" },
          { key: "verificationCodes", icon: <KeyOutlined />, label: "验证码记录" },
          { key: "listeningLevels", icon: <TrophyOutlined />, label: "听歌等级" },
          { key: "devices", icon: <DesktopOutlined />, label: "设备管理" },
        ],
      },
      {
        key: "media_group",
        icon: <CustomerServiceOutlined />,
        label: "曲库与资源",
        children: [
          { key: "cloudMusic", icon: <CustomerServiceOutlined />, label: "网盘音乐" },
          { key: "shares", icon: <ShareAltOutlined />, label: "分享管理" },
          { key: "files", icon: <FolderOutlined />, label: "文件管理" },
        ],
      },
      {
        key: "operation_group",
        icon: <RocketOutlined />,
        label: "运营与发布",
        children: [
          { key: "websiteRecords", icon: <GlobalOutlined />, label: "官网记录" },
          { key: "update", icon: <CloudUploadOutlined />, label: "版本发布" },
          { key: "announcements", icon: <NotificationOutlined />, label: "公告管理" },
          { key: "content", icon: <FileTextOutlined />, label: "内容与协议" },
        ],
      },
      {
        key: "maintenance_group",
        icon: <AlertOutlined />,
        label: "监控与运维",
        children: [
          { key: "feedback", icon: <MessageOutlined />, label: "反馈管理" },
          { key: "faultReports", icon: <BugOutlined />, label: "故障管理" },
        ],
      },
      {
        key: "system_group",
        icon: <SettingOutlined />,
        label: "系统设置",
        children: [
          { key: "system", icon: <SettingOutlined />, label: "系统配置" },
          { key: "dynamicConfig", icon: <ControlOutlined />, label: "动态配置" },
          { key: "runtimeConfig", icon: <SlidersOutlined />, label: "运行策略" },
          { key: "encryption", icon: <SafetyCertificateOutlined />, label: "加密白名单" },
        ],
      },
    ],
    [],
  );

  const handleMenuClick: MenuProps["onClick"] = ({ key }) => {
    const route = findAdminRouteByKey(key);
    if (route) {
      navigate(route.path);
      setMobileNavOpen(false);
    }
  };

  const themePanel = (
    <div className="w-64 p-2 space-y-4">
      <div>
        <Text strong className="text-xs text-slate-500 uppercase tracking-wider block mb-2">
          背景色调
        </Text>
        <div className="grid grid-cols-4 gap-2">
          {bgPresets.map((bg, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setBgIndex(idx);
                saveTheme({ themeColor, bgIndex: idx });
              }}
              className={`h-6 rounded-lg border-2 transition-all ${
                bgIndex === idx ? "border-slate-800 scale-110 shadow-sm" : "border-transparent hover:scale-105"
              } bg-gradient-to-r ${bg.base}`}
            />
          ))}
        </div>
      </div>

      <div>
        <Text strong className="text-xs text-slate-500 uppercase tracking-wider block mb-2">
          主色调 (Theme Color)
        </Text>
        <div className="grid grid-cols-4 gap-2">
          {colorPresets.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => {
                setThemeColor(color);
                saveTheme({ themeColor: color, bgIndex });
              }}
              className={`h-7 rounded-lg border-2 transition-all ${
                themeColor === color ? "border-slate-800 scale-110 shadow-sm" : "border-transparent hover:scale-105"
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
          <div
            className={`relative h-7 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
              !colorPresets.includes(themeColor)
                ? "border-slate-800 scale-110 shadow-sm"
                : "border-slate-200 hover:border-slate-400"
            }`}
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-red-500 via-green-500 to-blue-500 pointer-events-none" />
            <div className="absolute inset-0.5 bg-white rounded-md pointer-events-none flex items-center justify-center">
              <div className="w-3.5 h-3.5 rounded-sm" style={{ backgroundColor: themeColor }} />
            </div>
            <input
              type="color"
              value={colorPresets.includes(themeColor) ? "#ffffff" : themeColor}
              onChange={(e) => {
                setThemeColor(e.target.value);
                saveTheme({ themeColor: e.target.value, bgIndex });
              }}
              className="absolute inset-[-10px] w-12 h-12 opacity-0 cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between">
      <div className="flex flex-col min-h-0 flex-1">
        {/* Top Branding */}
        <div className="flex h-16 shrink-0 items-center justify-between px-5 border-b border-slate-200/80 bg-white/40">
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar
              shape="square"
              size={32}
              src="/pisamusic_icon_1024.png"
              className="rounded-lg shadow-2xs border border-slate-200/80 shrink-0 bg-white p-0.5"
            />
            <span className="font-extrabold text-base tracking-tight text-slate-800 truncate">
              PisaAdmin
            </span>
          </div>

          <Popover content={themePanel} trigger="click" placement="bottomRight">
            <Button
              type="text"
              shape="circle"
              size="small"
              icon={<BgColorsOutlined />}
              title="切换主题与配色"
            />
          </Popover>
        </div>

        {/* Ant Design Menu */}
        <div className="flex-1 overflow-y-auto py-2">
          <Menu
            mode="inline"
            selectedKeys={[currentTab]}
            openKeys={openKeys}
            onOpenChange={setOpenKeys}
            onClick={handleMenuClick}
            items={menuItems}
            className="!border-r-0 !bg-transparent font-medium"
          />
        </div>
      </div>

      {/* Sider Footer */}
      <div className="p-3 shrink-0 border-t border-slate-200/80 bg-white/40 space-y-2">
        <div className="flex items-center justify-between px-1">
          <Badge
            status="processing"
            color="green"
            text={<span className="text-[11px] text-slate-500 font-medium">运行状态</span>}
          />
          <Tag color="success" className="!mr-0 font-bold font-mono text-[10px]">
            Production
          </Tag>
        </div>
        <div className="flex gap-2 pt-0.5">
          <Button
            size="small"
            icon={<KeyOutlined />}
            className="flex-1 text-xs"
            onClick={() => {
              setShowChangePasswordModal(true);
              setMobileNavOpen(false);
            }}
          >
            修改密码
          </Button>
          <Button
            size="small"
            danger
            icon={<LogoutOutlined />}
            className="flex-1 text-xs"
            onClick={logout}
          >
            退出
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: themeColor,
          borderRadius: 8,
        },
      }}
    >
      <AdminLayoutContext.Provider value={{ themeColor, registerPageActions }}>
        <div className="relative min-h-dvh w-full font-sans text-slate-800">
          {/* Background Gradients */}
          <div
            className={`fixed inset-0 z-[-1] bg-gradient-to-br ${bgPresets[bgIndex].base} transition-colors duration-700`}
          >
            <div
              className={`absolute top-[-10%] left-[-10%] w-96 h-96 ${bgPresets[bgIndex].blob1} rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-[pulse_8s_ease-in-out_infinite] transition-colors duration-700`}
            />
            <div
              className={`absolute top-[20%] right-[-10%] w-96 h-96 ${bgPresets[bgIndex].blob2} rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-[pulse_10s_ease-in-out_infinite_reverse] transition-colors duration-700`}
            />
            <div
              className={`absolute bottom-[-20%] left-[20%] w-96 h-96 ${bgPresets[bgIndex].blob3} rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-[pulse_9s_ease-in-out_infinite] transition-colors duration-700`}
            />
          </div>

          <Layout className="min-h-dvh bg-transparent">
            {/* Mobile Drawer Navigation */}
            <Drawer
              open={mobileNavOpen}
              onClose={() => setMobileNavOpen(false)}
              placement="left"
              width={240}
              styles={{ body: { padding: 0 } }}
              className="lg:hidden"
            >
              {sidebarContent}
            </Drawer>

            {/* Desktop Sider */}
            <Layout.Sider
              width={240}
              theme="light"
              className="!hidden lg:!flex !fixed !inset-y-0 !left-0 !z-20 !bg-white/70 !backdrop-blur-2xl !border-r !border-slate-200/80 !shadow-sm flex-col"
            >
              {sidebarContent}
            </Layout.Sider>

            {/* Main Layout Area */}
            <Layout className="min-w-0 flex-1 lg:ml-[240px] bg-transparent flex flex-col min-h-dvh">
              <Layout.Header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/70 px-4 backdrop-blur-xl sm:px-8">
                <div className="flex min-w-0 items-center gap-3">
                  <Button
                    type="text"
                    icon={<MenuOutlined />}
                    className="lg:hidden shrink-0"
                    onClick={() => setMobileNavOpen(true)}
                  />
                  <div className="min-w-0 flex items-center gap-2">
                    {currentRoute.groupTitle && (
                      <>
                        <span className="text-slate-400 text-sm font-medium">
                          {currentRoute.groupTitle}
                        </span>
                        <span className="text-slate-300 text-xs">/</span>
                      </>
                    )}
                    <span className="truncate text-lg font-bold text-slate-800">
                      {currentRoute.title}
                    </span>
                    {hydrated && loadError && !currentRoute.hideGlobalActions && (
                      <Tag color="warning" className="!mr-0 text-xs">
                        配置加载失败 (已使用本地默认)
                      </Tag>
                    )}
                  </div>
                </div>

                {!currentRoute.hideGlobalActions && (
                  <Space>
                    <Button
                      icon={<ReloadOutlined />}
                      onClick={() => {
                        if (pageActions?.refresh) {
                          void pageActions.refresh();
                        } else {
                          void refreshRemote();
                        }
                      }}
                    >
                      重新拉取
                    </Button>
                    <Button
                      type="primary"
                      icon={<ExportOutlined />}
                      onClick={() => {
                        if (pageActions?.exportJson) {
                          void pageActions.exportJson();
                        } else {
                          setShowJsonModal(true);
                        }
                      }}
                    >
                      导出 JSON 配置
                    </Button>
                  </Space>
                )}
              </Layout.Header>

              <Layout.Content className="relative flex-1 min-w-0 p-4">
                <div className="w-full pb-10">
                  <Suspense fallback={tabFallback()}>
                    <Outlet />
                  </Suspense>
                </div>
              </Layout.Content>
            </Layout>
          </Layout>

          {showJsonModal && (
            <JsonExportModal
              exportData={exportPayload}
              themeColor={themeColor}
              onClose={() => setShowJsonModal(false)}
            />
          )}

          {showChangePasswordModal && (
            <ChangePasswordModal
              themeColor={themeColor}
              onClose={() => setShowChangePasswordModal(false)}
              onSuccess={() => alert("密码已更新，请妥善保管新密码。")}
            />
          )}
        </div>
      </AdminLayoutContext.Provider>
    </ConfigProvider>
  );
}
