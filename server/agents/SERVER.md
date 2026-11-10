# Server 后端规范

适用于 `server/src/`、后端脚本、SQLite、配置、存储、实时通信和接口文档维护；纯 Admin 或官网页面任务无需读取。继承[根通用规范](../../AGENTS.md)与 [Server 入口](../AGENTS.md)。本文命令及源码路径均相对仓库根目录。

- Node.js / TypeScript 后端集中在 `server/`，不要移回 `pm/server` 或 `yixi`。
- Controller / Route 仅处理参数、基础校验与响应；业务在 Service，持久化在 Store / Repository，不把业务和数据库细节堆进路由。
- 涉及账号、同步、消息、分享、一起听、云盘、发布、故障或听歌统计时，按需查阅[跨模块契约](../../agents/CROSS_MODULE.md)对应章节。

## 运行与构建

- Node 要求：`>=22.5.0`
- 开发：`pnpm --dir server dev`
- 构建：`pnpm --dir server build`
- 全量构建：`pnpm --dir server build:all`，依次构建服务端、管理后台与官网；管理后台产物输出到 `server/web-admin/`，官网产物输出到 `server/web-user/`，两者均为忽略的构建产物，不要提交。
- 启动构建产物：`pnpm --dir server start`
- 默认端口：`53380`
- 官网双端发布接口：`/api/config/releases` 返回 Android 与 PC 当前发布信息；`/api/config/check-update` 保留为 Android 旧更新接口。

## 文件管理、版本发布与云盘资产

- 七牛上传文件统一登记到 `server` SQLite 的 `file_records` 表，后台管理接口为 `GET /api/admin/files` 和 `DELETE /api/admin/files/:id`。
- 旧 `release_files` / `desktop_update_assets` 表已废弃，启动时会删除；发布安装包、PC 自动更新 `latest.yml` / EXE / blockmap 都直接读写 `file_records`，不要恢复旧表或旧表迁移逻辑。
- 文件管理允许删除被历史、当前 Android / PC 发布版本或 active PC 自动更新引用的七牛对象；删除时必须调用七牛删除对象，把本地记录标记为 `deleted`，同步清理 `update_history.release_file_id`、`file_records.referenced_by`、当前发布下载地址和 active 自动更新引用，不要物理删除数据库记录。
- 发布历史的完整删除仅允许非当前版本：`update_history` 使用 `deleted_at` 逻辑删除，Android 同步删除关联安装包，PC 同步删除该版本安装包、`latest.yml` 和 blockmap；七牛对象实际删除，`file_records` 保留并标记为 `deleted`。当前 Android / PC 版本必须先发布替代版本后才能删除。
- 网盘音乐（`source: "cloud"`）独立存储与分发，曲库记录与资产分别登记在 SQLite 的 `cloud_music_tracks` 和 `cloud_music_assets` 表，物理文件登记在 `file_records`（`usage_type='cloud-music'`，支持所有者关联）。上传采用预登记会话 + 七牛私有直传 + `stat` 校验 + 音频元数据（`music-metadata`）解析。公开检索与详情入口为 `/api/cloud-music/*`，播放及歌词链接签发 1 小时私有签名 URL（`disabled` 曲目不可播）；后台管理接口为 `/api/admin/cloud-music/*`，支持状态流转、审核、试听与临时文件一键清理。网盘音乐不参与第三方音乐源聚合。
- 服务端版本发布支持手填直链或后台上传安装包到七牛云。七牛配置使用 `server/.env` 中的 `QINIU_ACCESS_KEY`、`QINIU_SECRET_KEY`、`QINIU_BUCKET`、`QINIU_UPLOAD_URL`、`QINIU_DOMAIN`、`QINIU_DOMAIN_CDN`；`server/.env` 不提交，提交 `server/.env.example` 作为模板。
- 七牛安装包信息统一保存在 `file_records` 表，发布历史通过 `update_history.release_file_id` 记录文件记录 ID。上传到七牛的安装包对外下载地址必须使用服务端 `/api/config/release-files/:id/download` 入口，由服务端生成七牛私有空间临时签名 URL 后跳转，不要把七牛对象直链直接下发给客户端。删除发布记录关联安装包时只删除七牛对象与文件状态，不删除历史记录；如果当前 Android / PC 发布配置正引用该文件下载地址，需要同步清空下载地址并关闭下载状态。
- 七牛安装包上传：管理后台通过 `/api/admin/release-files/upload-token` 获取上传凭证，客户端直传七牛后调用 `/api/admin/release-files/complete` 登记文件，再发布版本；删除历史安装包使用 `/api/admin/update-history/:id/release-file`。

## 配置、邮件与历史迁移边界

- 服务发现配置的后台保存校验必须与客户端一致：`serviceOrigins[].apiBaseUrl`、`realtimeBaseUrl` 为纯 origin，仅 HTTPS（开发 localhost 可用 HTTP），禁止认证信息、路径、query、hash；自动更新 feed 可含路径，但必须为无认证信息、query、hash 的 HTTPS URL。客户端细节见 [PC 规范](../../yixi/AGENTS.md)。
- 服务端邮箱验证码通过后台“系统配置”里的 `email.serviceUrl` 和 `email.provider` 配置发送，默认 `https://gateway.partialy.cn/auth-service/api/send/email`，body 固定为 `{ provider, type: "verify_code", code, to }`；默认 provider 为 `aliyun`，后台可维护 provider 列表，默认包含 `aliyun / 阿里云` 和 `resend / Resend`；网关验签复用 bootstrap `gatewaySign` 配置，签名算法与桌面端 `gatewaySigner` 保持一致。“API 网关与服务端点”支持仅替换全部端点 URL 的 hostname，协议、端口和路径保持不变，替换后仍需通过“保存端点”提交。
- 服务端历史 JSON 导入 SQLite 迁移已结束，不要恢复 `jsonImport.ts` 或启动时读取 `server/data/*.json` 自动导入数据库的逻辑。
- 动态配置模块：公开读取接口为 `GET /api/config/get?id=xxx`，返回 `{ id, type, content }`；后台管理接口挂载在 `GET/POST/PUT/DELETE /api/admin/dynamic-configs`。
- 动态配置类型：固定为 `html`、`string`、`number`、`url`，数据存储在 SQLite `dynamic_configs` 表；新增实现优先放独立 store / route / admin 组件文件，不要继续堆进通用大文件。
- 运行时策略管理与下载保护：服务端策略常量由 SQLite `runtime_configs` 表（包含 `key`、`name` 中文说明、`value_json`、`updated_at`）与内存 `configManager` 单例统一维护，启动时优先初始化全表加载，提供 0 数据库 IO 高性能同步读取与原子批量提交。安装包与 PC 自动更新七牛私有下载链接 TTL 统一由 `storage.releaseDownloadUrlTtlSeconds` 维护（默认 300 秒），云盘播放/歌词签名 TTL 保持 3600 秒；官网下载入口 `/api/config/download/*` 经由明显爬虫拦截中间件对脚本 UA（`python/`、`aiohttp/`、`curl/`、`wget/` 等）返回 403；下载相关入口共享 IP 滑动窗口限流中间件（默认 60 秒内 5 次），超限返回 429 与 `Retry-After`。网页版音乐使用独立可配置 IP 滑动窗口：`/api/web/music/url` 默认 5 分钟 10 次，`/search` 与 `/lyric` 共享默认 5 分钟 30 次；后台管理接口为 `GET/PATCH /api/admin/runtime-config`。

## 管理接口的后端职责

- Admin「运营与发布 → 分享记录」使用 `/api/admin/app-share-records` 提供筛选、排序、详情事件分页、趋势、CSV 导出和单向失效；失效记录保留，同身份再次获取产生新码，不支持删除、恢复或修改计数。生产部署需设置独立 `APP_SHARE_ATTRIBUTION_SECRET`，并由管理员通过现有内容管理发布推广隐私条款；不在数据库迁移中覆盖管理员政策，发布说明见 `docs/app-share/tracking-release.md`。
- PC 发布页的“上传安装包到七牛云”和“PC 自动更新文件 / 安装包 EXE”必须联动复用同一七牛对象；上传任意一处的 EXE 后，需要自动同步另一处的下载地址、文件大小、`releaseFileId` 或 installer 资产状态。
- 分享记录后台管理接口挂载在 `/api/admin/shares`，支持按 `type=song|playlist`、分享人关键词和 `valid=true|false|all` 分页筛选，并展示访问次数和最近更新时间；操作列可按现有 `/scan?type=music-share&uuid=<uuid>` 契约预览公开页或复制分享链接；单条分享只能通过 `PATCH /api/admin/shares/:uuid/invalid` 标记失效，必须保留 `share_records` 历史记录，不删除 `raw_json`，也不要改变 `GET /api/shares/public/:uuid` 的公开读取契约。
- 一起听房间后台管理接口挂载在 `/api/admin/listen-together/*`，支持在线房间列表/详情、历史房间分页/详情以及在线房间安全解散（`POST /api/admin/listen-together/online/:recordId/dissolve`）；解散时向房间广播 `ROOM_DESTROYED`、清理成员映射和离线定时器，并在历史表记录 `admin_dissolved` 与操作管理员，不污染普通用户接口契约。
- 用户管理模块：后台接口挂载在 `/api/admin/users*`，支持用户分页查询、资料编辑、详情统计和硬删除；详情统计读取 `user_sync_items` 中未删除的 `favorite_song`、`favorite_playlist`、`user_playlist` 以及 `user_track_stats` / `user_listening_stats` 听歌统计，详情表格数据通过 `/api/admin/users/:id/library` 按分类（含 `favoriteSongs`、`favoritePlaylists`、`userPlaylists`、`listeningHistory`）分页加载，默认每页 30 条；不要暴露 `password_hash`，不要把用户管理逻辑继续堆进通用 admin 大文件。
- 反馈管理模块：客户端继续通过 `POST /api/feedback` 提交反馈，记录保存在 SQLite 的 `feedback` / `feedback_images` 表，图片位于 `server/uploads/feedback/` 并通过 `/uploads/feedback/*` 访问；后台鉴权接口挂载在 `GET /api/admin/feedback`、`GET /api/admin/feedback/:id`、`PATCH /api/admin/feedback/:id/status` 和 `DELETE /api/admin/feedback/:id`，支持类型、状态、关键词筛选、`pending` / `processed` 两态处理流转及记录与附件级联删除。反馈持久化和后台查询统一放在独立 feedback store，不要重新堆进通用 `configStore` 或 `admin.ts`。
- 验证码记录模块：发送验证码（邮箱/短信）统一持久化到 SQLite 的 `verification_code_records` 表，记录通道（`email` / `phone`）、目标联系人、用途（`register` / `login` / `reset_password` / `profile_email` / `profile_phone`）、验证码、触发用户（若有）、触发设备 ID（`x-pm-device-id`）、客户端 IP、发送状态（`sent` / `verified` / `expired` / `failed`）及时间；验证成功时自动将对应记录流转为 `verified` 并记录 `verified_at`。后台管理接口为 `GET /api/admin/verification-codes` 与 `DELETE /api/admin/verification-codes/:id`，前端作为“验证码记录”置于左侧菜单用户管理下方，支持多维筛选与分页。
- 统计与仪表盘模块：公开接口为 `POST /api/analytics/site-visit`（强制明文，日 UV 上报）与 `GET /api/config/download/:platform`（强制明文，官网安装包下载重定向与统计）；管理端聚合接口挂载在 `GET /api/admin/dashboard?days=7|30|90`（需 JWT 鉴权与加密，返回 7/30/90 天零填充日序列与聚合汇总，严禁返回单条 IP、访客 hash 或明细 User-Agent）。后台“官网记录”通过 `GET /api/admin/website-records?type=visit|download&offset&limit` 分页读取摘要，并通过 `GET /api/admin/website-records/:type/:id` 查看单条完整字段；两者同样要求管理员 JWT 和加密通信。原始事件写入 `site_visit_records`、`download_records`、`device_daily_activity` 表，通过 `ANALYTICS_RETENTION_DAYS`（默认 180 天）每日门禁清理过期数据；官网日 UV 基于 localStorage 访客 ID 加盐哈希（`ANALYTICS_HASH_SALT`）并由数据库唯一索引最终去重；管理后台采用 Recharts 懒加载仪表盘作为默认主页，“官网记录”固定放在左侧菜单第三项。

## 实时通信

- 实时通信模块：`server/src/realtime/` 使用 Socket.IO 绑定 HTTP server；一起听接口挂载 `/api/listen-together`，在线态以内存权威（`server/src/db/listenTogetherStore.ts`）、生命周期与成员历史写入 SQLite（`listen_together_room_records` / `listen_together_room_members` 表）；重启不恢复在线房间，只关闭遗留记录。人数上限读取动态配置 `listen_together_max_people`，仅 `/api/listen-together/config` 默认明文开放。创建房间接口默认不覆盖用户已有房间，客户端确认替换时才传 `replaceExisting=true` 由服务端先退出旧房间再创建。一起听房间队列不存服务端，`listen:queue` / `QUEUE_EVENT` 只做房间成员校验和转发。

## 接口文档与验证

- 服务端接口文档与索引规范：服务端接口文档存放在 `server/apidoc/`，按模块分目录维护（如 `user/`、`config/`、`device/`、`sync/`、`shares/`、`listenTogether/`、`feedback/`、`faultReports/`、`analytics/`、`admin/`、`system/`、`common/`），统一索引为 `server/apidoc/index.md`。任何新增、修改、重构或删除（CRUD）服务端接口的改动，必须同步更新对应模块下的文档文件（如 `server/apidoc/<module>/<apiName>.md`）及 `server/apidoc/index.md` 索引链接与描述，确保接口定义与文档始终保持一致。
- 服务端改动至少运行 TypeScript 构建，并按影响面检查相关接口。

## SQLite / MySQL 5.7 双数据库与迁移运维

- Server 支持 `DB_TYPE=SQLITE|MYSQL`（缺省 SQLITE），`PISA_APP_DB_PATH` 指向 SQLite；MySQL 5.7 通过 `MYSQL_URL` 连接，不允许连接失败自动回退 SQLite。Node 版本要求 `>=22.16.0`。
- 数据库访问层为 `src/db/core/` 的异步 DbClient；Store/Service/Route 必须 await 结果，事务必须绑定同一连接；不再在模块 import 阶段调用未初始化的数据库。
- MySQL 5.7 建表定义在 `src/db/schema/mysql/`，版本账本为 `schema_migrations`；不得在生产启动时运行破坏性自动删表。业务存储仍保留 SQLite 兼容模式。
- Admin 数据迁移接口为 `/api/admin/database-migration/*`，页面位于「系统设置 → 数据迁移」。迁移器在 `src/operations/`：空 MySQL 目标库、完整 SQLite Backup 快照、逐表校验和失败保护。API 说明见 [数据库迁移文档](../apidoc/databaseMigration/overview.md)。
- 维护状态存于 `server/data/operations/`；普通业务请求直接 503、Socket.IO 连接被拒绝，数据库模式切换只能通过配置并重启。完整备份包含 WAL 已提交数据，原始 `pm.db` 永不自动删除。
- 静态 Schema 校验命令：`pnpm --dir server verify:mysql57`；不能替代在真实 MySQL 5.7 上执行 DDL/迁移及人工业务验收。不要把备份 .db 放入公共静态目录，也不得提交 .env 真实密码。
