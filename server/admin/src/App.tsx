import { lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import RequireAuth from "./auth/RequireAuth";
import AdminLayout from "./layouts/AdminLayout";
import { useAdminLayout } from "./layouts/AdminLayoutContext";
import { AdminConfigWorkspaceProvider } from "./state/AdminConfigWorkspaceContext";
import LoginPage from "./components/LoginPage";

const DashboardTab = lazy(() => import("./components/tabs/DashboardTab"));
const WebsiteRecordsTab = lazy(() => import("./components/tabs/WebsiteRecordsTab"));
const CloudMusicManagementTab = lazy(() => import("./components/tabs/CloudMusicManagementTab"));
const VerificationCodesTab = lazy(() => import("./components/tabs/VerificationCodesTab"));
const ListeningLevelsTab = lazy(() => import("./components/tabs/ListeningLevelsTab"));
const RuntimeConfigTab = lazy(() => import("./components/tabs/RuntimeConfigTab"));

const SystemConfigPage = lazy(() => import("./pages/SystemConfigPage"));
const UpdateManagementPage = lazy(() => import("./pages/UpdateManagementPage"));
const FileManagementPage = lazy(() => import("./pages/FileManagementPage"));
const FeedbackManagementPage = lazy(() => import("./pages/FeedbackManagementPage"));
const FaultReportsPage = lazy(() => import("./pages/FaultReportsPage"));
const ShareManagementPage = lazy(() => import("./pages/ShareManagementPage"));
const UserManagementPage = lazy(() => import("./pages/UserManagementPage"));
const ContentManagementPage = lazy(() => import("./pages/ContentManagementPage"));
const AnnouncementsManagementPage = lazy(() => import("./pages/AnnouncementsManagementPage"));
const DynamicConfigPage = lazy(() => import("./pages/DynamicConfigPage"));
const EncryptionPage = lazy(() => import("./pages/EncryptionPage"));
const DevicesPage = lazy(() => import("./pages/DevicesPage"));

function DashboardRoute() {
  const { themeColor } = useAdminLayout();
  return <DashboardTab themeColor={themeColor} />;
}

function WebsiteRecordsRoute() {
  const { themeColor } = useAdminLayout();
  return <WebsiteRecordsTab themeColor={themeColor} />;
}

function CloudMusicRoute() {
  const { themeColor } = useAdminLayout();
  return <CloudMusicManagementTab themeColor={themeColor} />;
}

function VerificationCodesRoute() {
  const { themeColor } = useAdminLayout();
  return <VerificationCodesTab themeColor={themeColor} />;
}

function ListeningLevelsRoute() {
  const { themeColor } = useAdminLayout();
  return <ListeningLevelsTab themeColor={themeColor} />;
}

function RuntimeConfigRoute() {
  const { themeColor } = useAdminLayout();
  return <RuntimeConfigTab themeColor={themeColor} />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route
            element={
              <AdminConfigWorkspaceProvider>
                <AdminLayout />
              </AdminConfigWorkspaceProvider>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardRoute />} />
            <Route path="/users" element={<UserManagementPage />} />
            <Route path="/verification-codes" element={<VerificationCodesRoute />} />
            <Route path="/listening-levels" element={<ListeningLevelsRoute />} />
            <Route path="/devices" element={<DevicesPage />} />
            <Route path="/cloud-music" element={<CloudMusicRoute />} />
            <Route path="/shares" element={<ShareManagementPage />} />
            <Route path="/files" element={<FileManagementPage />} />
            <Route path="/website-records" element={<WebsiteRecordsRoute />} />
            <Route path="/updates" element={<UpdateManagementPage />} />
            <Route path="/announcements" element={<AnnouncementsManagementPage />} />
            <Route path="/content" element={<ContentManagementPage />} />
            <Route path="/feedback" element={<FeedbackManagementPage />} />
            <Route path="/fault-reports" element={<FaultReportsPage />} />
            <Route path="/system" element={<SystemConfigPage />} />
            <Route path="/dynamic-configs" element={<DynamicConfigPage />} />
            <Route path="/runtime-config" element={<RuntimeConfigRoute />} />
            <Route path="/encryption" element={<EncryptionPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthProvider>
  );
}
