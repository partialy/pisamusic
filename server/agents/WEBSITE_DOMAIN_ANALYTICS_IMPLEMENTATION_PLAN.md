# 官网域名统计实施计划与改造记录

更新日期：2026-11-11。依据「制定域名记录计划」会话最终 Q1–Q12 决策，业务决策已闭合，本轮执行源码改造，不执行生产迁移、部署或 Git 提交。

## 已确认决策

- 一个域名代表一个地区节点，所有域名同源反代 `/api`，共用一个 MySQL 5.7 数据库，无新增统计服务。
- 自动记录格式合法的原始 Host，无白名单、新环境变量或客户端域名字段；代理须保留 Host，不使用 X-Forwarded-Host。
- 所有公开网页纳入普通统计；UV 为每域名每日访客数，PV 为真实打开、刷新、导航次数，下载为有效客户端重定向触发次数。已识别爬虫不计。
- 普通 PV 与 App 推广归因独立，保留现有每日 UV 明细，新增 PV 事件表；Admin 不新增逐次 PV 明细标签。
- Admin 官网记录新增域名统计标签，支持 7/30/90 天，汇总、趋势、域名排行和占比、Android/PC 下载数、页面 PV 排行。
- 统一北京时间，默认明细保留 180 天。历史域名空串显示未知，不推测域名，不伪造历史 PV。
- 全站累计日 UV 为各域名各日 UV 之和，同人跨域可重复，Dashboard 与域名统计一致。兼容 SQLite 与旧访问 API。

## 实施阶段

1. 数据库：Schema v3 扩展 UV/下载 domain，UV 唯一键 `(visit_day,domain,visitor_hash)`；PV 事件表 UUID 主键及域名日期、日期路径、时间索引。MySQL v1 先升级 v2，再执行可续迁的 v3 DDL，记录步骤意图，失败阻断业务，验证完整结构后 applied。SQLite 原库增量升级与新库基线同步。复制、旧备份恢复、验证与清理脚本同步适配。
2. Server：统一 Host、公开页面路径与来源脱敏；`page-view` 同事务写 PV/UV，UUID 重试去重，跨午夜重试不额外插 UV。`site-visit` 继续只写 UV。下载域名在原分享归因事务透传。新增同快照统计 Store，列表 domain/startDay/endDay 筛选，Dashboard 改为累计日 UV。
3. 官网：React App 统一导航采集，六个静态公开入口共用 `/js/site-analytics.js`。新文档/刷新/真实路由/BFCache 返回生成新事件，重试复用 UUID；StrictMode、重复渲染、普通可见性恢复不加 PV。移除首页每日上报缓存，保留推广归因。
4. Admin：访问/下载列表与详情增加域名；筛选重置分页；新增懒加载域名统计，复用已有 JWT、加密、Ant Design、Recharts 与指标卡片，处理过期请求。
5. 文档与验证：接口与各模块规范同步；构建 Server/Admin/官网，验证统计幂等、跨域、事务、筛选、迁移恢复及兼容。不跑完整 PM 测试。

上述五阶段源码已完成。计划保存在 Server 模块文档目录，避免根 docs 的忽略规则使新增实施记录遗漏。具体接口见 [页面采集](../apidoc/analytics/reportPageView.md)、[域名聚合](../apidoc/admin/websiteStats.md)。

## 上线操作顺序

1. 各节点统一分析 hash salt；核验 Nginx `proxy_set_header Host $host;`，生产数据库为单一共用实例。
2. 停止各 Server 实例写入，完整备份并记录原 Schema、UV/下载条数及关键 ID。不要在多个实例上同时抢跑 DDL。
3. 启动一个新版本 Server 完成 v2→v3 迁移，核验空历史域名、PV 表、新唯一索引与 applied 账本。失败时本次启动终止，保留数据和步骤账本；排除原因后同版本可续迁，必要时从升级前完整备份恢复。
4. 完成 Server 升级再发布官网/Admin，避免旧 v2 Server 长期混跑。DDL 不能按普通事务回滚；旧代码回滚须连同相容数据库恢复方案一并考虑。
5. 分别经 A/B 域名访问三次：各 UV=1/PV=3；验证下载、分享归因、未知域名、Admin 筛选/趋势及 Dashboard 一致，再恢复流量。

## 验证记录与边界

- Server、Admin、官网构建/类型检查通过；官网静态脚本语法与导航、刷新、StrictMode、BFCache、重试模拟通过。
- 15 项统计/列表/迁移聚焦用例通过（含 2 项新增综合场景），隔离 SQLite 用例覆盖旧库迁移、跨域 UV、PV 幂等与跨午夜重试、事务回滚、下载域名、聚合与 HTTP 参数校验；MySQL DDL 中断账本/续迁使用模拟用例验证。
- MySQL 5.7 静态 Schema 检查通过。真实 MySQL 升级/双向复制、Nginx、多域名和浏览器视觉需环境验收；未执行生产数据库迁移或部署。
- 旧推广测试存在与本轮域名字段无关的 `null`/`undefined` 断言失败（查询未命中返回 null，旧断言期望 undefined）；单独记录，不扩大本轮修改范围。

新增聚焦用例入口：`server/src/db/websiteAnalytics.case.ts`、`server/src/db/schema/websiteAnalyticsMigration.case.ts`；编译后可单独用 Node test runner 运行。
