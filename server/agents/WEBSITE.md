# 官网规范

适用于 `server/frontend/` 与 `server/frontend-html/`；不属于 Admin 模块。继承[根通用规范](../../AGENTS.md)，通过 [Server 入口](../AGENTS.md)按任务加载。以下路径和命令均相对仓库根目录。

## 目录与构建

- `server/frontend/` 是 React / TypeScript / Vite 官网工程；开发 `pnpm --dir server/frontend dev`，构建 `pnpm --dir server/frontend build`，输出 `server/web-user/`，不要提交产物。
- `server/frontend-html/` 是现有静态官网页面，不能当作带有 package.json 的 Vite 工程运行；按本次任务的真实入口修改，勿擅自合并两套目录。
- 不恢复旧 `build:web`、`deploy:web` 或复制到 `server/web/` 的流程；构建 / 部署流程变化时更新本文件。

## 页面与公共契约

- 六个公开入口（`/`、`/listen/`、`/scan/`、`/download/`、`/app-share/`、`/agreement/`）使用同源 `POST /api/analytics/page-view` 同时记录逐次 PV 与每日域名 UV；域名由后端读取原始 Host，反代须保留 `Host $host`。静态页面共用 `/js/site-analytics.js`，React 由 `App` 导航统一调用 `src/api/analytics.ts`，不再由首页单独上报 UV。
- 新文档、刷新、SPA 真实页面变化创建新 UUID 事件；重试复用事件 ID。StrictMode 重建、组件重渲染、页内锚点和后台恢复不创建 PV。不得使用每日 localStorage 标记屏蔽 PV；访客 ID 沿用 `pm_site_visitor_id`，每日去重由数据库保证。
- 浏览器后退/前进命中 BFCache（`pageshow.persisted`）按真实导航新增 PV；沿用内存访客身份，不将旧文档的 `document.referrer` 冒充本次来源。普通 `pageshow` 和可见性变化不新增事件。
- 采集路径仅保留公开页面入口，查询、Fragment、分享短码及标识不进入普通统计；App 推广归因脚本和下载追踪继续独立运行。

- `server/frontend-html` 的首页与 `/listen/` 是可索引稳定页面，必须维持各自 canonical、Open Graph/Twitter 与 JSON-LD，并出现在 sitemap；`/scan/`、`/download/` 及其参数化入口用于功能跳转，维持 `noindex, follow`，不加入 sitemap。

- `/scan/`、`/download/`、音乐试听与 App 推广流程按[跨模块契约](../../agents/CROSS_MODULE.md)对应章节维护；Android / PC 下载信息保持兼容，不把下载触发描述为安装或注册成功。
- 邀请参数贯穿扫码与下载引导，允许返回扫码页继续加入；`/download/` 负责推荐下载项，不绕过官网下载统计接口直接发安装包。
- 官网接口或部署配置变更需要后端支持时，额外读取 [Server 后端规范](SERVER.md)，同步接口文档。
- 官网代码改动运行对应构建；静态页面按实际入口检查浏览器效果及 SEO 元数据。纯文档变更无需构建。
