import { useMemo } from "react";
import { HashRouter, Route, Routes } from "react-router-dom";
import HostBlockedScreen from "./components/HostBlockedScreen";
import QualityGuidePage from "./pages/QualityGuidePage";
import QuotaRulesPage from "./pages/QuotaRulesPage";
import {
  BoostQuotaPage,
  GenericPlaceholderPage,
  QuotaQueryPage,
  ServiceHomePage,
} from "./pages/PlaceholderPages";
import { useAppTheme } from "./utils/appTheme";
import { verifyEmbeddedHostAccess } from "./utils/hostBridge";

export default function App() {
  useAppTheme();

  const hostCheck = useMemo(() => verifyEmbeddedHostAccess(), []);
  if (!hostCheck.allowed) {
    return <HostBlockedScreen />;
  }

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<ServiceHomePage />} />
        <Route path="/quota-rules" element={<QuotaRulesPage />} />
        <Route path="/quality" element={<QualityGuidePage />} />
        <Route path="/quota" element={<QuotaQueryPage />} />
        <Route path="/boost" element={<BoostQuotaPage />} />
        <Route
          path="/checkin"
          element={<GenericPlaceholderPage title="每日签到" description="签到领取额外下载次数（后续开放）。" />}
        />
        <Route
          path="/activity"
          element={<GenericPlaceholderPage title="活动中心" description="限时活动与福利任务说明（后续开放）。" />}
        />
        <Route
          path="/redeem"
          element={<GenericPlaceholderPage title="兑换码中心" description="输入兑换码领取 VIP 时长或额外下载次数（后续开放）。" />}
        />
        <Route
          path="/docs"
          element={<GenericPlaceholderPage title="使用文档与常见问题" description="功能指引与常见问题解答（后续开放）。" />}
        />
        <Route
          path="*"
          element={<GenericPlaceholderPage title="页面建设中" description="当前页面正在规划开发，请查看下方常用说明入口。" />}
        />
      </Routes>
    </HashRouter>
  );
}
