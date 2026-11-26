import { HashRouter, NavLink, Route, Routes } from "react-router-dom";

type PlaceholderPageMeta = {
  path: string;
  title: string;
  description: string;
};

const H5_ROUTES: PlaceholderPageMeta[] = [
  { path: "/", title: "PisaMusic H5 服务中心", description: "客户端内嵌活动、说明文档与自助服务入口（骨架预留）。" },
  { path: "/checkin", title: "每日签到", description: "签到领取额外下载次数（后续开放）。" },
  { path: "/activity", title: "活动中心", description: "限时活动与福利任务说明（后续开放）。" },
  { path: "/quality", title: "音质说明", description: "无损 / Hi-Res / 标准音质差异与下载消耗说明（后续开放）。" },
  { path: "/quota", title: "下载配额查询", description: "账号常规配额与永久额外次数明细（后续开放）。" },
  { path: "/redeem", title: "兑换码中心", description: "输入兑换码领取 VIP 时长或额外下载次数（后续开放）。" },
  { path: "/docs", title: "使用文档与常见问题", description: "功能指引与常见问题解答（后续开放）。" },
];

function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <div className="h5-shell">
      <div className="h5-card">
        <h1 style={{ margin: "0 0 8px", fontSize: 20 }}>{title}</h1>
        <p style={{ margin: 0, fontSize: 14, color: "#475569", lineHeight: 1.6 }}>{description}</p>
        <nav className="h5-nav" aria-label="H5 导航">
          {H5_ROUTES.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              className={({ isActive }) => `h5-link${isActive ? " active" : ""}`}
            >
              {item.title}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        {H5_ROUTES.map((item) => (
          <Route
            key={item.path}
            path={item.path}
            element={<PlaceholderPage title={item.title} description={item.description} />}
          />
        ))}
        <Route
          path="*"
          element={<PlaceholderPage title="页面建设中" description="当前页面正在规划开发，请从下方入口返回。" />}
        />
      </Routes>
    </HashRouter>
  );
}
