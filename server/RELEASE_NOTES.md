# Server 1.1.0

发布日期：2026-11-11。包含 Server、Admin 和官网域名访问统计改造。

## 本次更新

- 访问与下载记录新增域名，保留历史未知域名。
- 新增普通 PV 采集，每域名每日 UV 去重、事件 UUID 幂等；公开官网页面统一采集，兼容刷新、路由切换和 BFCache 返回，保留 App 推广归因。
- Admin「官网记录」增加域名/日期筛选，以及 7/30/90 天域名汇总、趋势、占比、页面排行与 Android/PC 下载触发数。
- Dashboard 统一使用累计日 UV，跨域同访客可分别计数。
- Schema 升级至 v3，支持 SQLite 旧库增量升级、MySQL 5.7 v2→v3 失败记账与续迁，兼容新增字段/PV 表的数据复制。

## 部署包内容

- `dist/`：编译后的后端（不含测试程序）。
- `web-admin/`：Admin 构建产物。
- `web-user/`：React 官网构建产物。
- `frontend-html/`：静态官网，包括六个公开页面与公共埋点脚本。
- `static/`、`discover/`：仓库维护的公开资产。
- `package.json`、锁文件、`.env.example`、接口文档、模块规范和离线数据库恢复入口。

不包含 `.env`、数据库、上传文件、node_modules、日志、签名文件或本地操作记录。现有运行目录的数据与配置须自行保留。

## 部署步骤

1. 要求 Node.js >=22.16.0；生产数据库支持 MySQL 5.7 或 SQLite。在解压后的 `server/` 目录运行命令。
2. 升级前停止所有共享数据库的 Server 实例写入并完整备份数据库，保留现有 `.env`、`data/`、`uploads/`。不要并发执行升级。
3. 解压至独立发布目录，安装后端生产依赖：`npm ci --omit=dev`。将原环境配置和运行数据按既有部署路径接入；新安装参考 `.env.example`。
4. 确认各官网域名同源反代 `/api`，并使用 `proxy_set_header Host $host;` 保留访问域名；各节点共用分析 hash salt。按原部署方式分别提供 Admin、React 官网或静态官网，不以两套官网相互覆盖。仅发布 React 构建不足以替换静态官网页面。
5. 先启动一个新 Server：`npm start`。启动会执行 Schema v3 增量升级；MySQL DDL 失败会阻止业务启动并保留账本，排除原因后同版本可续迁。DDL 不具备普通事务完整回滚能力，回退时必须考虑数据库兼容或恢复升级前备份。
6. 核验 Schema v3、历史记录和域名统计，再发布其余节点及网页。避免旧 v2 Server 与新 Schema 长期混跑。

## 验证与限制

三端构建、统计/列表/迁移聚焦用例与 MySQL 5.7 静态 Schema 检查已通过。未对真实生产 MySQL 进行升级、未部署，多域名反代和浏览器视觉仍需环境验收。旧推广测试有一项查询未命中的 `null/undefined` 断言失败，已单独记录。

详细实施与上线核验见 `agents/WEBSITE_DOMAIN_ANALYTICS_IMPLEMENTATION_PLAN.md`。
