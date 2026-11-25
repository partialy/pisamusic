# Server 后端规范

适用于 `server/src/`、后端脚本、SQLite、配置、存储、实时通信和接口文档维护；纯 Admin 或官网页面任务无需读取。继承[根通用规范](../../AGENTS.md)与 [Server 入口](../AGENTS.md)。本文命令及源码路径均相对仓库根目录。

- Node.js / TypeScript 后端集中在 `server/`，不要移回 `pm/server` 或 `yixi`。
- Controller / Route 仅处理参数、基础校验与响应；业务在 Service，持久化在 Store / Repository，不把业务和数据库细节堆进路由。
- 单文件规模与防耦合红线：单文件代码行数尽量控制在 500 行以内，严格禁止超过 1000 行。严禁将新功能或无关业务继续向 `configStore.ts`、`admin.ts`、`cloudMusicService.ts`、`appDb.ts` 等历史大文件回塞。
  - **Store 层边界**：Store 必须按数据表/领域实体独立建文件（1 个 Store 对应 1 张核心实体表及其从属表）。`configStore.ts` 仅保留基础系统配置，文件记录必须在 `fileRecordStore.ts`、发布历史在 `updateHistoryStore.ts`、系统公告在 `announcementStore.ts`、管理员账户在 `adminUserStore.ts`、加解密路径在 `encryptionStore.ts`。
  - **Route 层边界**：`routes/admin.ts` 严格定位为子路由装配中心，禁止在 `admin.ts` 内部直接内联编写超过 5 行的业务路由实现；所有管理端路由必须拆分为独立的 `adminXxx.ts` 子 Router，并在 `admin.ts` 中通过 `adminRouter.use("/xxx", ...)` 挂载。
  - **Service 层边界**：复杂的跨端业务服务必须按角色与视角拆分（如 Public 只读检索、User 用户投稿与管理、Admin 后台运维与审核），底层音视频二进制提取或第三方 SDK 交互必须提取为独立 Helper，避免全生命周期逻辑堆在单个巨大 Service。
- 涉及账号、同步、消息、分享、一起听、云盘、发布、故障或听歌统计时，按需查阅[跨模块契约](../../agents/CROSS_MODULE.md)对应章节。
- **统一分页规范**：所有常规分页接口统一复用 `types/response.ts` 的 `PaginatedListData<T>` 与 `utils/pagination.ts` 的 `normalizePagination` / `buildPaginatedList`，请求用 `offset` / `limit`，响应 `data` 为 `{ list, total, offset, limit, hasMore }`（`sync/changes` 游标同步、`messages/unread` 未读队列及 `web/music/search` 除外）。网盘音乐公开搜索与投稿历史旧版 `/api/cloud-music/search`、`/api/cloud-music/submit/my-history` 保持 `items` 兼容旧端，统一分页新接口位于 `/api/cloud-music/v2/search` 与 `/api/cloud-music/v2/submit/my-history`（待客户端切换记录见 [CLIENT_ADAPTATION.md](../../CLIENT_ADAPTATION.md)）。

## 运行与构建

- Node 要求：`>=22.5.0`
- 开发：`pnpm --dir server dev`
- 构建：`pnpm --dir server build`（含测试文件）；生产构建 `pnpm --dir server build:prod`（通过 `tsconfig.build.json` 排除 `*.spec.ts`/`*.case.ts`/`*.test.ts`）
- 全量构建：`pnpm --dir server build:all`，依次构建服务端与管理后台；生产发布全量构建：`pnpm --dir server build:release`。管理后台产物输出到 `server/web-admin/`（为忽略的构建产物，不要提交）。官网使用纯静态 `server/frontend-html/`，无需构建。
- 自动部署流水线：主用 Gitee Go（[`.workflow/deploy-server.yml`](../../.workflow/deploy-server.yml)），同时保留 GitHub Actions（[`.github/workflows/deploy-server.yml`](../../.github/workflows/deploy-server.yml)）作兼容备用；两者共享部署脚本 [`deploy/deploy-server.sh`](../../deploy/deploy-server.sh)，监听 `main` 分支 `server/**` 改动并增量部署至宝塔 `/www/wwwroot/node/pm-server`。
- 启动构建产物：`pnpm --dir server start`
- 默认端口：`53380`
- 官网双端发布接口：`/api/config/releases` 返回 Android 与 PC 当前发布信息；`/api/config/check-update` 保留为 Android 旧更新接口。

## 文件管理、版本发布与云盘资产

- 七牛上传文件统一登记到 `server` SQLite 的 `file_records` 表，后台管理接口为 `GET /api/admin/files` 和 `DELETE /api/admin/files/:id`。
- 旧 `release_files` / `desktop_update_assets` 表已废弃，启动时会删除；发布安装包、PC 自动更新 `latest.yml` / EXE / blockmap 都直接读写 `file_records`，不要恢复旧表或旧表迁移逻辑。
- 文件管理允许删除被历史、当前 Android / PC 发布版本或 active PC 自动更新引用的七牛对象；删除时必须调用七牛删除对象，把本地记录标记为 `deleted`，同步清理 `update_history.release_file_id`、`file_records.referenced_by`、当前发布下载地址和 active 自动更新引用，不要物理删除数据库记录。
- 发布历史的完整删除仅允许非当前版本：`update_history` 使用 `deleted_at` 逻辑删除，Android 同步删除关联安装包，PC 同步删除该版本安装包、`latest.yml` 和 blockmap；七牛对象实际删除，`file_records` 保留并标记为 `deleted`。当前 Android / PC 版本必须先发布替代版本后才能删除。
- 网盘音乐（`source: "cloud"`）独立存储与分发，曲库记录与资产分别登记在 SQLite 的 `cloud_music_tracks` 和 `cloud_music_assets` 表，物理文件登记在 `file_records`（`usage_type='cloud-music'`，支持所有者关联）。管理端 `/api/admin/cloud-music/*` 由浏览器本地解析音频标签、内嵌封面与内嵌歌词并直传七牛，服务端 `complete` 仅调用七牛 `stat` 校验对象并接收前端解析的规格与元数据直接入库（无需服务端临时下载文件）；客户端用户投稿 `/api/cloud-music/submit/*` 保持服务端 `stat` 校验与 `music-metadata` 解析。公开检索与详情入口为 `/api/cloud-music/*`，播放及歌词链接签发 1 小时私有签名 URL（`disabled` 曲目不可播）；后台管理支持批量上传队列、状态流转、审核、试听与临时文件一键清理。网盘音乐不参与第三方音乐源聚合。
- 用户投稿确认以七牛 `stat` 核对对象大小。服务端优先通过七牛源站读取，并以实际流字节数校验完整性。封面按图片文件头同步七牛对象及文件记录的 MIME，歌词确认只登记资产，内容留给后台审核。
- 管理端 `GET /api/admin/cloud-music/:uuid/lyrics` 只读当前 `isCurrent/uploaded` 歌词资产（允许管理员查看 disabled/pending 曲目），通过七牛私有签名和 HTTPS 域名白名单读取，禁用重定向，15 秒超时和 2 MiB 限额，响应 no-store。`services/cloudMusic/cloudMusicLyricsService.ts` 负责文本与二进制 KRC 解码，也供公开 `lyrics-url?includeText=1` 返回 KRC 文本。管理接口无歌词时返回 404，读取失败返回 502。
- 服务端版本发布支持手填直链或后台上传安装包到七牛云。七牛配置使用 `server/.env` 中的 `QINIU_ACCESS_KEY`、`QINIU_SECRET_KEY`、`QINIU_BUCKET`、`QINIU_UPLOAD_URL`、`QINIU_DOMAIN`、`QINIU_DOMAIN_CDN`；`server/.env` 不提交，提交 `server/.env.example` 作为模板。
- 七牛安装包信息统一保存在 `file_records` 表，发布历史通过 `update_history.release_file_id` 记录文件记录 ID。上传到七牛的安装包对外下载地址必须使用服务端 `/api/config/release-files/:id/download` 入口，由服务端生成七牛私有空间临时签名 URL 后跳转，不要把七牛对象直链直接下发给客户端。删除发布记录关联安装包时只删除七牛对象与文件状态，不删除历史记录；如果当前 Android / PC 发布配置正引用该文件下载地址，需要同步清空下载地址并关闭下载状态。
- 七牛安装包上传：管理后台通过 `/api/admin/release-files/upload-token` 获取上传凭证，客户端直传七牛后调用 `/api/admin/release-files/complete` 登记文件，再发布版本；删除历史安装包使用 `/api/admin/update-history/:id/release-file`。

## 配置、邮件与历史迁移边界

- 服务发现配置的后台保存校验必须与客户端一致：`serviceOrigins[].apiBaseUrl`、`realtimeBaseUrl` 为纯 origin，仅 HTTPS（开发 localhost 可用 HTTP），禁止认证信息、路径、query、hash；自动更新 feed 可含路径，但必须为无认证信息、query、hash 的 HTTPS URL。客户端细节见 [PC 规范](../../yixi/AGENTS.md)。
- 服务端邮箱验证码通过后台“系统配置”里的 `email.serviceUrl` 和 `email.provider` 配置发送，默认 `https://gateway.partialy.cn/auth-service/api/send/email`，body 固定为 `{ provider, type: "verify_code", code, to }`；默认 provider 为 `aliyun`，后台可维护 provider 列表，默认包含 `aliyun / 阿里云` 和 `resend / Resend`；网关验签复用 bootstrap `gatewaySign` 配置，签名算法与桌面端 `gatewaySigner` 保持一致。“API 网关与服务端点”支持仅替换全部端点 URL 的 hostname，协议、端口和路径保持不变，替换后仍需通过“保存端点”提交。
- 服务端历史 JSON 导入 SQLite 迁移已结束，不要恢复 `jsonImport.ts` 或启动时读取 `server/data/*.json` 自动导入数据库的逻辑。
- 动态配置模块：公开读取接口为 `GET /api/config/get?id=xxx`，返回 `{ id, type, content }`；后台管理接口挂载在 `GET/POST/PUT/DELETE /api/admin/dynamic-configs`。
- 动态配置类型：固定为 `html`、`string`、`number`、`url`，数据存储在 SQLite `dynamic_configs` 表；新增实现优先放独立 store / route / admin 组件文件，不要继续堆进通用大文件。
- 双端冷启动聚合接口：Android 使用 `POST /api/config/startup`，PC 桌面端使用 `POST /api/config/desktop-startup`（均加密，路由层统一通过 `routes/config.ts` 委托 `services/startupService.ts` 的 `executeAndroidStartup` / `executeDesktopStartup`，分别与 `routes/device.ts` 共用 `services/deviceReportService.ts` 的 `reportAndroidDevice` / `reportDesktopDevice`、与 `routes/auth.ts` 共用 `services/userTokenService.ts`），单次请求内完成 `-233` 停服判定、设备上报与日活登记、账号 Token 静默刷新（`none/refreshed/expired`）、未读专属消息拉取及 `bootstrap` / `update`（Android 为 `cfg.update`，桌面端为 `releases.desktop`）/ `agreement`（本地版本匹配时省略正文）/ `announcements` 聚合返回；旧版 `bootstrap`、`releases`、`agreement`、`device/report`、`device/desktop/report`、`messages/unread` 等接口继续保留兼容旧端与手动刷新场景。
- 运行时策略管理与下载保护：服务端策略常量由 SQLite `runtime_configs` 表（包含 `key`、`name` 中文说明、`value_json`、`updated_at`）与内存 `configManager` 单例统一维护，启动时优先初始化全表加载，提供 0 数据库 IO 高性能同步读取与原子批量提交。安装包与 PC 自动更新七牛私有下载链接 TTL 统一由 `storage.releaseDownloadUrlTtlSeconds` 维护（默认 300 秒），云盘播放/歌词签名 TTL 保持 3600 秒；官网下载入口 `/api/config/download/*` 经由明显爬虫拦截中间件对脚本 UA（`python/`、`aiohttp/`、`curl/`、`wget/` 等）返回 403；下载相关入口共享 IP 滑动窗口限流中间件（默认 60 秒内 5 次），超限返回 429 与 `Retry-After`。网页版音乐使用独立可配置 IP 滑动窗口：`/api/web/music/url` 默认 5 分钟 10 次，`/search` 与 `/lyric` 共享默认 5 分钟 30 次；后台管理接口为 `GET/PATCH /api/admin/runtime-config`。

## 管理接口的后端职责

- App推广沿用 `GET /api/config/app-share`，设备来源取权威DeviceToken的android/desktop；按kind+设备ID+账号/guest幂等，不同设备表同ID隔离。无设备Header保持旧通用配置兼容，有设备或显式账号凭证失效返回401且不降级游客；GET不计PV/UV。无需新增推广表/迁移。
- Admin「运营与发布 → 分享记录」使用 `/api/admin/app-share-records` 提供筛选、排序、详情事件分页、趋势、CSV 导出和单向失效；deviceKind=all/android/desktop来源筛选贯通列表/汇总/趋势/CSV，双kind限定设备JOIN并在设备删除后回退展示快照。分享来源与实际Android/PC下载平台独立统计；失效记录保留，同身份再次获取产生新码，不支持删除、恢复或修改计数。生产部署需设置独立 `APP_SHARE_ATTRIBUTION_SECRET`，并由管理员通过现有内容管理发布推广隐私条款；不在数据库迁移中覆盖管理员政策，发布说明见 `docs/app-share/tracking-release.md`。
- PC 发布与自动更新：`GET /api/admin/desktop-updates/assets` 按版本读取已有 PC 更新资产；`POST /api/admin/desktop-updates/activate` 支持传 `assetIds` 精准绑定 `latest.yml` / `.exe` / `.blockmap` 并同步修正关联 `file_records.version` 与 `win32/x64` 平台归属，`publishUpdate` / `updatePublishedUpdate` 同步维护 `releaseFileId` 版本一致性，EXE 复用同一 `file_records` 对象对外下载与自动更新。
- 分享记录后台管理接口挂载在 `/api/admin/shares`，支持按 `type=song|playlist`、分享人关键词和 `valid=true|false|all` 分页筛选，并展示访问次数和最近更新时间；操作列可按现有 `/scan?type=music-share&uuid=<uuid>` 契约预览公开页或复制分享链接；单条分享只能通过 `PATCH /api/admin/shares/:uuid/invalid` 标记失效，必须保留 `share_records` 历史记录，不删除 `raw_json`，也不要改变 `GET /api/shares/public/:uuid` 的公开读取契约。
- 一起听房间后台管理接口挂载在 `/api/admin/listen-together/*`，支持在线房间列表/详情、历史房间分页/详情以及在线房间安全解散（`POST /api/admin/listen-together/online/:recordId/dissolve`）；解散时向房间广播 `ROOM_DESTROYED`、清理成员映射和离线定时器，并在历史表记录 `admin_dissolved` 与操作管理员，不污染普通用户接口契约。
- 用户管理模块：后台接口挂载在 `/api/admin/users*`，支持用户分页查询、资料编辑、详情统计和硬删除；详情统计读取 `user_sync_items` 中未删除的 `favorite_song`、`favorite_playlist`、`user_playlist` 以及 `user_track_stats` / `user_listening_stats` 听歌统计，详情表格数据通过 `/api/admin/users/:id/library` 按分类（含 `favoriteSongs`、`favoritePlaylists`、`userPlaylists`、`playlistTracks`、`listeningHistory`，支持 `status=active|deleted|all` 与 `playlistId` 过滤）分页加载，默认每页 30 条，并通过 `GET /api/admin/users/:id/sync-logs` 只读分页排查 `user_sync_change_log` 与 `syncLogFloor`；不要暴露 `password_hash`，不要把用户管理逻辑继续堆进通用 admin 大文件。
- 反馈管理模块：客户端通过 `POST /api/feedback` 提交反馈（支持可选 User JWT 与 `x-pm-device-token` 归属登记，缺省设备令牌时兼容回落 `device.serverDeviceId`），记录保存在 `feedback` / `feedback_images` 表，图片位于 `server/uploads/feedback/` 并通过 `/uploads/feedback/*` 访问；客户端可通过 `GET /api/feedback`（统一分页）和 `GET /api/feedback/:id` 按账号或设备凭证查看自己提交的反馈记录与处理状态（不支持客户端删除）。后台鉴权接口挂载在 `GET /api/admin/feedback`、`GET /api/admin/feedback/:id`、`PATCH /api/admin/feedback/:id/status` 和 `DELETE /api/admin/feedback/:id`，支持类型、状态、关键词筛选、`pending` / `processed` 两态处理流转及记录与附件级联删除。反馈持久化和查询统一放在独立 `feedbackStore.ts`，不要重新堆进通用 `configStore` 或 `admin.ts`。
- 验证码记录模块：发送验证码（邮箱/短信）统一持久化到 SQLite 的 `verification_code_records` 表，记录通道（`email` / `phone`）、目标联系人、用途（`register` / `login` / `reset_password` / `profile_email` / `profile_phone`）、验证码、触发用户（若有）、触发设备 ID（`x-pm-device-id`）、客户端 IP、发送状态（`sent` / `verified` / `expired` / `failed`）及时间；验证成功时自动将对应记录流转为 `verified` 并记录 `verified_at`。后台管理接口为 `GET /api/admin/verification-codes` 与 `DELETE /api/admin/verification-codes/:id`，前端作为“验证码记录”置于左侧菜单用户管理下方，支持多维筛选与分页。
- 统计与仪表盘模块：公开接口为 `POST /api/analytics/page-view`（强制明文，PV/域名日 UV 上报）与旧 `POST /api/analytics/site-visit`（仅日 UV）与 `GET /api/config/download/:platform`（强制明文，官网安装包下载重定向与统计）；管理端聚合接口挂载在 `GET /api/admin/dashboard?days=7|30|90`（需 JWT 鉴权与加密，返回 7/30/90 天零填充日序列与聚合汇总，严禁返回单条 IP、访客 hash 或明细 User-Agent）。后台“官网记录”通过 `GET /api/admin/website-records?type=visit|download&offset&limit` 分页读取摘要，并通过 `GET /api/admin/website-records/:type/:id` 查看单条完整字段；两者同样要求管理员 JWT 和加密通信。原始事件写入 `site_visit_records`、`site_page_view_records`、`download_records`、`device_daily_activity` 表，通过 `ANALYTICS_RETENTION_DAYS`（默认 180 天）每日门禁清理过期数据；官网日 UV 按日期、域名、访客去重，基于 localStorage 访客 ID 加盐哈希（`ANALYTICS_HASH_SALT`）并由数据库唯一索引最终去重；管理后台采用 Recharts 懒加载仪表盘作为默认主页，“官网记录”固定放在左侧菜单第三项。

## 实时通信

- 实时通信模块：`server/src/realtime/` 使用 Socket.IO 绑定 HTTP server；一起听接口挂载 `/api/listen-together`，在线态以内存权威（`server/src/db/listenTogetherStore.ts`）、生命周期与成员历史写入 SQLite（`listen_together_room_records` / `listen_together_room_members` 表）；重启不恢复在线房间，只关闭遗留记录。人数上限读取动态配置 `listen_together_max_people`，仅 `/api/listen-together/config` 默认明文开放。创建房间接口默认不覆盖用户已有房间，客户端确认替换时才传 `replaceExisting=true` 由服务端先退出旧房间再创建。一起听房间队列不存服务端，`listen:queue` / `QUEUE_EVENT` 校验成员/房主/成员操作权限并按 DTO 白名单转发，不持久化队列。云盘 `cloud` 使用共享 UUID，各设备自行取链；歌曲规范化统一清空 URL、剔除本机路径，禁止 `local`，快照、增量和 ADD_AND_PLAY 复用同一校验。

## 接口文档与验证

- 服务端接口文档与索引规范：服务端接口文档存放在 `server/apidoc/`，按模块分目录维护（如 `user/`、`config/`、`device/`、`sync/`、`shares/`、`listenTogether/`、`feedback/`、`faultReports/`、`analytics/`、`admin/`、`system/`、`common/`），统一索引为 `server/apidoc/index.md`。任何新增、修改、重构或删除（CRUD）服务端接口的改动，必须同步更新对应模块下的文档文件（如 `server/apidoc/<module>/<apiName>.md`）及 `server/apidoc/index.md` 索引链接与描述，确保接口定义与文档始终保持一致。
- 服务端改动至少运行 TypeScript 构建，并按影响面检查相关接口。
- 后续所有新增或改造的分页接口统一使用 `offset`、`limit` 获取，返回：`{ code, msg, success, data: { list: [], total, offset, limit, hasMore } }`。
- 公开版本历史与详情接口：`/api/config/releases/history`（支持 `platform=all|pc|desktop|android`、`offset`、`limit` 倒序分页，返回统一分页结构）和 `/api/config/releases/detail`（支持 `platform=pc|desktop|android`、`version=latest` 或忽略前导 `v` 匹配具体版本），均纳入强制明文白名单与简单 IP 限流（`release-query` 60 秒 60 次）；旧全量 `/api/config/update-history` 已移除。管理端 `/api/admin/update-history` 同步改造为统一分页接口并附带 `isCurrent`；新增 `GET /api/admin/update-history/export?format=json|csv` 导出未删除的全量发行记录（`deleted_at IS NULL`）。相关只读查询与导出逻辑拆分在 `db/updates/updateHistoryQueryStore.ts` 与 `services/releaseHistoryService.ts`。

## SQLite / MySQL 5.7 独立部署、安装与复制

- Server 支持 `DB_TYPE=SQLITE|MYSQL`（缺省 SQLITE），`PISA_APP_DB_PATH` 指向 SQLite；MySQL 5.7 通过 `MYSQL_URL` 连接，不允许连接失败自动回退 SQLite。Node 版本要求 `>=22.16.0`。
- 数据库访问层为 `src/db/core/` 的异步 DbClient；Store/Service/Route 必须 await 结果，事务必须绑定同一连接；不再在模块 import 阶段调用未初始化的数据库。
- `DB_TYPE` 唯一选择运行库；不依赖本机迁移记录、旧 `activatedMysql` 或连接串指纹，也不禁止切回 SQLite。另一引擎仅在复制时需要配置。
- MySQL 5.7 建表定义在 `src/db/schema/mysql/`，空专用库可直接建表；`schema_migrations` 当前 v7，已有 v1 库先补 v2 安装元数据，再依次进行 v2→v3 官网域名统计、v3→v4 同步日志保留下限、v4→v5 歌单封面资源、v5→v6 歌曲下载统计与配额、v6→v7 反馈归属字段（`feedback.user_id` / `device_kind` / `device_id` 与历史 `serverDeviceId` 回填，`feedbackMigration.ts`）增量升级。DDL 意图逐步记账，失败阻断业务启动，同任务可幂等续迁；全部结构校验通过才标记 applied。不在生产启动执行破坏性删表，也不以整包DDL哈希相等代替版本升级。
- SQLite 启动升级必须在执行 `CREATE_SQL` 前为已存在的 `feedback` 补齐新索引依赖的列（包含历史 status/processed_at 及 v7 归属字段）；空库由基线建表，索引创建与历史设备回填留在后置迁移，重复启动保持幂等。定向回归见 `src/db/schema/sqlite/feedbackStartup.spec.ts`，不得通过重建旧表或删除数据规避缺列错误。
- 安装标记为库内 `app_installation`，与Schema账本分离；首管、默认配置和标记事务提交。已有管理员库兼容补标记，无管理员走安装令牌保护的向导；接口为 `/api/setup/status`、`/api/setup/complete`，参见[安装文档](../apidoc/system/setup.md)。
- 未安装/复制未完成的库禁止业务HTTP和Socket，不开放重新接管失败目标。管理员及用户JWT绑定安装身份，旧token需重新登录；完整副本保留源身份。
- Admin「系统设置 → 数据迁移」调用 `/api/admin/database-migration/*`；`src/operations/` 支持SQLite↔MySQL全量覆盖。先排空源写入、备份源与目标，再事务替换及逐表摘要校验；目标须停止其他服务写入。不复制Schema账本或文件资产，未知非空数据禁止静默丢弃。
- `sync` 成功恢复源库，`switch` 成功保持维护等待手动改env重启；失败保留备份和报告，目标库持久化 `incomplete`。重试从头执行；离线备份恢复入口为 `scripts/restore-database-backup.cjs`。
- 运行记录存于 `server/data/operations/`，维护状态按引擎与安装身份隔离，不读取旧全局 `state.json`。SQLite备份包含WAL，MySQL导出为含原始DDL的便携SQLite。详见[复制与恢复文档](../apidoc/databaseMigration/overview.md)。
- 隔离验收命令为 `pnpm --dir server verify:databases`；只创建随机测试MySQL库和项目内临时文件，不写env业务库。旧记录人工清理脚本为 `scripts/sql/cleanup-legacy-migration-metadata.sql`，当前Schema与安装标记必须保留。
- 静态 Schema 校验命令：`pnpm --dir server verify:mysql57`；不能替代在真实 MySQL 5.7 上执行 DDL/迁移及人工业务验收。不要把备份 .db 放入公共静态目录，也不得提交 .env 真实密码。

## 官网域名访问统计

- 同源反代保留原始 Host（如 `proxy_set_header Host $host;`），`utils/websiteDomain.ts` 规范化域名，不信任 X-Forwarded-Host，不配置白名单。无效/历史域名使用空串，不从 Referrer 猜测。各节点共享数据库与 `ANALYTICS_HASH_SALT`。
- `/api/analytics/page-view` 明文采集，Service/Store 同事务写入事件 UUID 幂等 PV 和每日每域名访客 UV；旧 site-visit 仅写 UV。PV 位于 `site_page_view_records`，UV 唯一约束为 `(visit_day,domain,visitor_hash)`，下载原有推广归因事务透传域名。三类明细按分析保留期清理。
- Admin `GET /api/admin/website-records/stats` 按 7/30/90 天与可选域名返回零填充趋势、汇总、域名排行及页面 PV 排行；列表增加 domain/startDay/endDay 筛选。Dashboard 统一累计日 UV，允许同人跨域重复。官网普通 PV 与 App 推广归因独立，Android/PC 契约不变。
- 升级发布先停各节点写入并备份，完成当前 Schema v5（含 v3 官网统计、v4 同步保留下限）后发布官网；禁止旧 Server 与新同步清理流程长期混跑。复制表清单与恢复默认值保留新增 domain/PV；静态 DDL 校验不能替代真实 MySQL 5.7 升级与多域名验收。

## 账号收藏同步

- `/api/sync/changes` 按 route → `services/syncService.ts` → `db/syncStore.ts` 分层；服务层接入 `sync.maxChangesPerPush` / `sync.maxChangesPerPull`，负责校验、opId 过滤、同 key 合并、`baseVersion` 因果快进与 LWW 裁决、canonical no-op，并返回 `serverTime`、`logFloor`、`conflicts`、`appliedItems`、`rejectedItems`；Store 负责用户行锁、原子批量版本分配和批量持久化。参数错误 400，快照过期 409，数据库错误 500。
- Schema v4 新增 `users.sync_log_floor`（最后裁剪版本；since==floor 仍可增量），SQLite 与 MySQL 启动增量升级，MySQL 失败保留账本阻断启动。复制描述符包含 floor 默认值 0，保留历史源兼容。
- 新端 GET `protocol=2` 使用 `snapshotVersion` / `cursor` / `hasMore`，快照页在用户行锁内读取；版本变化返回 409 重启累计，末页才对账和推进游标。旧端一次返回包含墓碑的完整快照 changes，避免分页循环。收藏时间 `favoritedAt` 契约见[跨模块同步](../../agents/CROSS_MODULE.md)和[接口说明](../apidoc/sync/getSyncChanges.md)。
- `services/syncCleanup.ts` 启动后每小时检查每日门禁，参与维护排空；默认清理 90 天前且超出每用户最近 1000 条的连续日志前缀，并原子推进 floor；applied_ops 保留 30 天，实体及墓碑长期保留。运行时策略为 `sync.logRetentionDays`、`sync.logMinimumEntries`、`sync.lwwEnabled`。客户端未来时钟限制为当前+5分钟，相同 no-op 也推进冲突时钟。
- 聚焦验收 `pnpm --dir server verify:sync`：内存 SQLite + 配置可连接时随机隔离 MySQL 库；不会使用业务库，连接失败不回退。只跑 SQLite 可在构建后执行 `node server/scripts/verify-sync.cjs --sqlite-only`。

## 歌单同步扩展策略

- `syncPayloadPolicy.ts` 负责sortOrder/coverResource/coverPreset受限合并与LOCAL白名单，`syncChangePlanner.ts` 在用户锁事务权威快照上累计有效操作、处理父墓碑及派生子墓碑；syncService协调LWW/no-op/版本及Store落库，不更改protocol=2或Schema。
- 扩展缺省保留、null显式清除；delete不merge。父删子墓碑与items/log/clocks/applied_ops同事务，派生项占版本不占输入accepted。LOCAL仅允许UUID作用域的安全歌单曲目占位；完整字段限制见[推送契约](../apidoc/sync/pushSyncChanges.md#歌单扩展与-local-占位p1)。资源形状由策略校验，归属/ready/对象uploaded及权威URL由playlistCoverSync在同步事务内校验；无可用资源400整批回滚。

## 用户歌单封面资源

- 用户JWT接口`/api/playlist-covers/upload-token`、`/complete`、`/:resourceId`，Service/Route/Store独立；public-image直传、受控key绑定账号/歌单/uploadId/editGeneration，5MiB JPG/PNG/WebP，stat与imageInfo实际格式/尺寸验证（单边8192、3200万像素），不访问客户端URL。complete仅建立资源，不改权威歌单。DTO见[接口说明](../apidoc/playlistCovers/overview.md)。
- Schema v5：`playlist_cover_resources`共用上传会话+资源生命周期行，`playlist_cover_refs`支持同用户多歌单共享；物理账本复用`file_records(playlist-cover)`，token返回前原子登记pending。SQLite appDb/baseline/runner及MySQL5.7增量DDL账本与结构验证全覆盖；复制/恢复纳入新表，历史v4缺新表补空。
- sync最终胜出项同事务处理权威cover/共享引用，缺字段保留、null解绑、父删释放、no-op验证；资源不可用400，不能任传key。最后解绑或从未引用超过七天、上传token过期后，由既有syncCleanup每日门禁/维护排空有界清理。事务认领deleting+引用复核防并发重引用，612幂等；失败/中断五分钟lease后可重试，保留错误和对象账本。Admin文件删除沿用同一保护。
- 删除用户先在用户锁事务中清引用、撤销资源/会话owner_user_id，再删除身份；保留资源与file_records以七天回收物理对象，不能用用户FK cascade丢弃回收记录。跨数据库复制不传七牛对象，副本不得与源同时启用维护清理。

## 歌曲下载统计与配额 (Schema v6)

- Schema v6 新增 `song_download_quota_states`、`song_download_batches`、`song_download_records` 三表（SQLite `songDownloadSchema.ts`、MySQL 5.7 `mysql/songDownloads.ts`、增量迁移 `songDownloadMigration.ts` 与结构校验 `songDownloadValidation.ts`），同步纳入 `runner.ts` 与 `operations/migrationEngine.ts` 复制/恢复校验。
- 客户端路由 `/api/song-downloads/*`（`routes/songDownloads.ts` → `services/songDownloadService.ts` → `db/songDownloadStore.ts`）必须携带有效 `x-pm-device-token`（`401` 不降级）；已登录账号（`Authorization`）按 `user` 主体共享配额，未登录按 `device` 主体隔离。
- `POST /api/song-downloads/acquire` 通过 `clientBatchId` 幂等防重，在同一事务内按北京时间（`utils/beijingTime.ts`）复位过期日/周（周一 0 点）/月（1 号 0 点）计数器、校验并扣减配额，然后写入批次与单曲明细；不足时只返回实时余量不扣费。
- 默认配额由 `runtime_configs` 的 `songDownload.defaultDailyLimit` / `defaultWeeklyLimit` / `defaultMonthlyLimit` / `defaultTotalLimit` 维护（`-1` 表示不限制，初始默认日/周/月 `-1`、总数 `999999`）。管理端路由挂载 `/api/admin/song-downloads/*`（`routes/adminSongDownloads.ts` → `services/songDownloadAdminService.ts` → `db/songDownloadAdminStore.ts`）；删除用户或设备时同步清理对应 `song_download_quota_states` 覆盖记录，保留历史下载明细。

## 侧栏动态菜单 (Schema v8)

- Schema v8 新增 `sidebar_menu_config`（`id=1` 单行配置 JSON）与 `sidebar_menu_icon_uploads`（七牛上传会话）两张表（SQLite `sidebarMenuSchema.ts`、MySQL 5.7 `mysql/sidebarMenus.ts`、增量迁移 `sidebarMenuMigration.ts`），同步纳入 `runner.ts` 与 `migrationEngine.ts` 复制/恢复校验。
- 存储与业务边界：`db/sidebarMenuStore.ts` → `services/sidebarMenuService.ts` → `routes/adminSidebarMenu.ts`（管理端 `/api/admin/sidebar-menu*`）与 `routes/config.ts`（客户端 `GET /api/config/sidebar-menu?schemaVersion=2` + `services/startupService.ts` `executeAndroidStartup` 并行聚合返回 `sidebarMenu`）。配置兼容旧版单区块结构并升级为 `builtinItems`（4 个内置固定项显隐/改名/改图标）+ 有序多区块 `listSections` + 四宫格 `gridSection`，同时通过 `schemaVersion >= 2` 隔离旧客户端（`< 2` 返回空壳防崩溃）。
- 图标支持 `default`（仅内置项）、`none`、`image`（七牛上传 `file_records.usage_type='sidebar-menu-icon'` 并维护 `referenced_by` 删除保护，或 HTTPS 直链）、`svg`（剥离脚本与外部引用的安全 `<svg>` 源码）与 `preset`（预置图标 key）；入口支持 `web` / `fullscreen_web` 与 13 项 `app_action` 原生跳转；一次性红点通过 `badgeVersion` 控制重新触发语义。

## 公告投放（Schema v9）

- 公告协议版本由服务端管理，历史为 1，新建为 2。SQLite 与 MySQL 5.7 增量补齐公告协议及投放配置，保留公告 ID、图片引用和历史回执。
- 公开 GET 和双端冷启动共用投放判断，按请求支持的公告协议上限、App 版本和平台过滤。管理端保存及升级规则见[公告 API](../apidoc/config/getAnnouncements.md)。
