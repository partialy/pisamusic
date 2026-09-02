# AGENTS.md

## 后台文件管理与 PC 发布补充

- 七牛上传文件统一登记到 `server` SQLite 的 `file_records` 表，后台管理接口为 `GET /api/admin/files` 和 `DELETE /api/admin/files/:id`。
- 旧 `release_files` / `desktop_update_assets` 表已废弃，启动时会删除；发布安装包、PC 自动更新 `latest.yml` / EXE / blockmap 都直接读写 `file_records`，不要恢复旧表或旧表迁移逻辑。
- PC 发布页的“上传安装包到七牛云”和“PC 自动更新文件 / 安装包 EXE”必须联动复用同一七牛对象；上传任意一处的 EXE 后，需要自动同步另一处的下载地址、文件大小、`releaseFileId` 或 installer 资产状态。
- 文件管理允许删除被历史、当前 Android / PC 发布版本或 active PC 自动更新引用的七牛对象；删除时必须调用七牛删除对象，把本地记录标记为 `deleted`，同步清理 `update_history.release_file_id`、`file_records.referenced_by`、当前发布下载地址和 active 自动更新引用，不要物理删除数据库记录。
- 发布历史的完整删除仅允许非当前版本：`update_history` 使用 `deleted_at` 逻辑删除，Android 同步删除关联安装包，PC 同步删除该版本安装包、`latest.yml` 和 blockmap；七牛对象实际删除，`file_records` 保留并标记为 `deleted`。当前 Android / PC 版本必须先发布替代版本后才能删除。
- 网盘音乐（`source: "cloud"`）独立存储与分发，曲库记录与资产分别登记在 SQLite 的 `cloud_music_tracks` 和 `cloud_music_assets` 表，物理文件登记在 `file_records`（`usage_type='cloud-music'`，支持所有者关联）。上传采用预登记会话 + 七牛私有直传 + `stat` 校验 + 音频元数据（`music-metadata`）解析。公开检索与详情入口为 `/api/cloud-music/*`，播放及歌词链接签发 1 小时私有签名 URL（`disabled` 曲目不可播）；后台管理接口为 `/api/admin/cloud-music/*`，支持状态流转、审核、试听与临时文件一键清理。网盘音乐不参与第三方音乐源聚合。
- Android 首页第二个 Tab 固定为“云盘”，PC 桌面端左侧导航在“收藏”与“我的”之间固定为“云盘”Tab；双端均通过外层 `server` 的 `/api/cloud-music/*` 浏览、搜索和播放独立 `cloud` 音源；列表分页固定每页 20 条，音质只有 `cloud:default`。`active` 可播放，`disabled` 只允许搜索和查看；客户端实际播放、切歌和下载前即时获取签名 URL，不把临时 URL 写入收藏、歌单、分享、播放状态或持久缓存。云盘歌曲当前不支持一起听。

本文件用于指导 Codex / Claude Code 在 `pisamusic` 根工作区内协作。子目录如果有自己的 `AGENTS.md`，以更近的文件为准。

## 项目概览

- `pm/`：手机端 App，Android 项目。具体架构、构建命令、播放器、网络层说明见 `pm/AGENTS.md`。
- `yixi/`：当前 PC 桌面端 App，基于旧版一夕音乐代码继续整理和开发。后续桌面端功能以该目录为准。
- `pm-electron/`：已废弃的桌面端尝试目录，仅作为历史代码保留。除非用户明确要求，不要继续在这里实现新功能。
- `server/`：外层统一服务端，包含 Node.js / TypeScript 后端、管理后台、官网、上传文件与运行数据。不要把服务端代码重新写回 `pm/server` 或 `yixi`。
- `example/`：参考代码。只有用户明确指定某个开发模块需要参考时，才允许进入 `example/` 查找或借鉴代码；用户没有指定时，不要搜索、读取或复制其中实现。
- `SPlayer/`：桌面端产品和工程边界参考项目，已加入忽略。SPlayer 使用 AGPL-3.0，不要直接复制代码、资源或实现细节。
- `pm210.jks`：签名相关文件，视为敏感构建资产。不要移动、删除、上传或改名，除非用户明确要求。

## 工作区规则

- 根目录是唯一 Git 仓库，按 monorepo 管理 `pm/`、`server/`、`yixi/` 和项目文档。不要在业务子目录内重新初始化独立 Git 仓库。
- 不允许使用脚本批量删除工作区之外的文件或文件夹。删除外部文件、外部工作树、用户目录缓存等，必须先得到用户批准。
- 做新增功能、调整模块边界、迁移框架、改变持久化方式或改变运行流程时，必须同步更新相关 `AGENTS.md`，避免项目记忆与实际代码不一致。
- 修改前先确认目标子项目状态，不要回退、覆盖或清理用户已有的无关改动。
- 新构建 `pm` UI 界面、弹窗、表单、列表行、按钮、开关、卡片等视觉或交互单元前，先查看 `pm/components.md`；有同款或近似 UI 时优先复用对应 layout、drawable、style、Kotlin 封装或交互模式，只有没有合适参考时才新建，新建可复用 UI 后同步补充该索引。
- 跨端或跨服务改动要明确影响面。接口字段、加密规则、配置结构、更新信息、设备上报、公告、反馈等数据契约变更时，需要同步检查 `pm/`、`server/` 和 `yixi/`。
- 官网发布信息支持 Android / PC 双端配置，推荐接口为 `GET /api/config/releases`；旧 `GET /api/config/check-update` 必须保持 Android 更新信息兼容，不要改成多端结构。
- 服务端版本发布支持手填直链或后台上传安装包到七牛云。七牛配置使用 `server/.env` 中的 `QINIU_ACCESS_KEY`、`QINIU_SECRET_KEY`、`QINIU_BUCKET`、`QINIU_UPLOAD_URL`、`QINIU_DOMAIN`、`QINIU_DOMAIN_CDN`；`server/.env` 不提交，提交 `server/.env.example` 作为模板。
- 七牛安装包信息统一保存在 `file_records` 表，发布历史通过 `update_history.release_file_id` 记录文件记录 ID。上传到七牛的安装包对外下载地址必须使用服务端 `/api/config/release-files/:id/download` 入口，由服务端生成七牛私有空间临时签名 URL 后跳转，不要把七牛对象直链直接下发给客户端。删除发布记录关联安装包时只删除七牛对象与文件状态，不删除历史记录；如果当前 Android / PC 发布配置正引用该文件下载地址，需要同步清空下载地址并关闭下载状态。
- PC 自动升级使用 `electron-updater` 的 generic feed，服务端公开 `/api/config/desktop-updates/win32/x64/latest.yml` 和同目录文件下载入口；自动更新资源统一存储在 `file_records` 表，由后台上传 `latest.yml`、安装包 EXE 和可选 blockmap 后启用，不要手写 `latest.yml`。
- 手机端与桌面端账号由外层 `server/` 的 `/api/auth/*` 提供服务，支持邮箱/手机号验证码注册、用户名/邮箱/手机号密码登录、邮箱/手机号验证码登录和 7 天 token 刷新。收藏/歌单同步由 `/api/sync/*` 提供服务，使用账号 `Authorization: Bearer <userToken>` 鉴权并按用户隔离数据；两端同步入口均基于账号登录，账号切换时同步游标必须按账号隔离并重新 seed 本地 outbox；旧同步码绑定空间流程已废弃，不要恢复 `/api/sync/spaces*`。
- 账号资料由 `/api/auth/profile*` 提供服务，支持修改昵称、头像 key 和经新邮箱验证码确认后的邮箱；公开用户字段包含 `id`、`username`、`email`、`avatarKey`、`avatarUrl`、`vip`、`vipExpiresAt`、`createdAt`。`vip` 与 `vipExpiresAt` 主要用于客户端内部音质/功能权益判断；允许的前端展示仅包括 Android“我的”页为有效 VIP 在邮箱下显示金色纯到期时间标签，以及 PC Header 昵称尾部的金色斜体方块 `V` 和用户资料页“特权到期时间”，不得扩展展示 VIP 等级、会员名称或其他标识。默认头像固定使用 `server/static/account-avatars/default.jpg`；自定义头像通过 `/api/auth/avatar/upload-token` 获取七牛 token 后由客户端直传到 `QINIU_PUBLIC_IMAGE_BUCKET` 公开图片空间，用户表 `avatar_key` 记录七牛对象 key，`avatarUrl` 直接返回公开直链；旧的多张内置头像自选功能已废弃，不要恢复。
- PisaMusic 系统账号 VIP 与 KG / WY 第三方音乐账号 VIP 完全分离。系统权益仅存 `users.vip_enabled`、`users.vip_expires_at`：有效 VIP 必须同时启用且到期毫秒时间戳晚于当前时间，公开 DTO 的 `vip` 由服务端实时计算并保留 `vipExpiresAt` 原值；不支持永久 VIP。后台仅可通过 `PUT /api/admin/users/:id` 以 `vipEnabled` 与未来的 `vipExpiresAt` 设置，关闭时必须写入 `0 / NULL`，不要把第三方 Cookie、VIP 字段或展示逻辑混入系统账号。
- 服务端邮箱验证码通过后台“系统配置”里的 `email.serviceUrl` 和 `email.provider` 配置发送，默认 `https://gateway.partialy.cn/auth-service/api/send/email`，body 固定为 `{ provider, type: "verify_code", code, to }`；默认 provider 为 `aliyun`，后台可维护 provider 列表，默认包含 `aliyun / 阿里云` 和 `resend / Resend`；网关验签复用 bootstrap `gatewaySign` 配置，签名算法与桌面端 `gatewaySigner` 保持一致。“API 网关与服务端点”支持仅替换全部端点 URL 的 hostname，协议、端口和路径保持不变，替换后仍需通过“保存端点”提交。
- 手机端和桌面端启动时如果外层服务不可用、没网或后台关闭 `appAvailable`，应进入本地模式并在主界面给非阻塞提示；设备被封禁仍然阻止进入。
- 桌面端设备上报使用服务端 `desktop_device_info` 表和 `/api/device/desktop/report`，不要复用 Android 的 `device_info` 表；后台通过 `/api/admin/desktop-device/*` 管理 PC 设备。
- 服务端历史 JSON 导入 SQLite 迁移已结束，不要恢复 `jsonImport.ts` 或启动时读取 `server/data/*.json` 自动导入数据库的逻辑。
- Android 播放控制统一依据 `playWhenReady` 维护明确意图；部分场景共存恢复仅对自身临时暂停有效，硬暂停（用户/通知栏/系统/耳机 noisy/定时/一起听）统一撤销恢复资格与异步待播放任务；播放诊断事件由 `pm_local_music.db` 的 `playback_diagnostic_events` 本地保留最多 300 条，不落敏感信息。
- 服务端接口文档与索引规范：服务端接口文档存放在 `server/apidoc/`，按模块分目录维护（如 `user/`、`config/`、`device/`、`sync/`、`shares/`、`listenTogether/`、`feedback/`、`faultReports/`、`analytics/`、`admin/`、`system/`、`common/`），统一索引为 `server/apidoc/index.md`。任何新增、修改、重构或删除（CRUD）服务端接口的改动，必须同步更新对应模块下的文档文件（如 `server/apidoc/<module>/<apiName>.md`）及 `server/apidoc/index.md` 索引链接与描述，确保接口定义与文档始终保持一致。
- 生成或修改构建产物、数据库、日志、上传文件前，先判断它们是否应被 Git 跟踪；运行时产物默认不要纳入源码变更。

## 编码规范

- 优先组件化、模块化，按职责拆分文件和目录。
- 提取重复方法，一个方法只做一件事。
- 中文注释保持可读性，只解释不明显的业务意图或复杂逻辑。
- 除非确有必要，单文件代码行数尽量不超过 1000 行；Android、Vue、React、Express 等大文件要及时拆分。
- 后端代码必须清晰分层，不允许在 controller / route 中直接堆业务逻辑或持久化细节。
- 前端代码尽量复用组件，避免出现上千行的大组件。
- 新增公共工具、类型、组件或 API 封装时，优先复用项目已有命名、目录和风格。

## 常用命令

手机端 App：

- 目录：`pm/`
- Debug 构建：`.\gradlew.bat assembleDebug`
- Release 构建：`.\gradlew.bat assembleRelease`
- 安装 Debug：`.\gradlew.bat installDebug`
- 单元测试：`.\gradlew.bat testDebugUnitTest`

服务端：

- 目录：`server/`
- Node 要求：`>=22.5.0`
- 开发：`pnpm --dir server dev`
- 构建：`pnpm --dir server build`
- 全量构建：`pnpm --dir server build:all`，依次构建服务端、管理后台与官网；管理后台产物输出到 `server/web-admin/`，官网产物输出到 `server/web-user/`，两者均为忽略的构建产物，不要提交。
- 启动构建产物：`pnpm --dir server start`
- 默认端口：`53380`
- 官网双端发布接口：`/api/config/releases` 返回 Android 与 PC 当前发布信息；`/api/config/check-update` 保留为 Android 旧更新接口。
- 动态配置模块：公开读取接口为 `GET /api/config/get?id=xxx`，返回 `{ id, type, content }`；后台管理接口挂载在 `GET/POST/PUT/DELETE /api/admin/dynamic-configs`。
- 动态配置类型：固定为 `html`、`string`、`number`、`url`，数据存储在 SQLite `dynamic_configs` 表；新增实现优先放独立 store / route / admin 组件文件，不要继续堆进通用大文件。
- 后台“加密白名单”页包含浏览器本地解密工具：输入 `encData` 或 `{ isEnc, encData }` 加密 JSON，再输入对应响应头 `x-pm-random` 后由 `server/admin/src/api/crypto.ts` 的解密逻辑在前端本地解密；不要为该工具新增服务端解密接口，也不要改变现有加密协议。
- 实时通信模块：`server/src/realtime/` 使用 Socket.IO 绑定 HTTP server；一起听接口挂载 `/api/listen-together`，房间状态由 `server/src/db/listenTogetherStore.ts` 内存维护，人数上限读取动态配置 `listen_together_max_people`，仅 `/api/listen-together/config` 默认明文开放。创建房间接口默认不覆盖用户已有房间，客户端确认替换时才传 `replaceExisting=true` 由服务端先退出旧房间再创建。一起听房间队列不存服务端，`listen:queue` / `QUEUE_EVENT` 只做房间成员校验和转发。
- 一起听二维码统一编码 `https://pisamusic.partialy.cn/scan?type=listen-together-join&roomId=<房间号>`；Android App 与 `yixi/` 桌面端同时识别 `pisamusic://scan` Scheme。官网 `server/frontend/public/scan/` 负责浏览器唤起、复制房间号及安装后继续加入引导，`public/download/` 只按 Windows / Android 设备类型跳转官网并推荐对应下载项，不直接下载安装包；有效邀请参数需要贯穿下载页并可返回 `/scan/` 继续加入。
- 歌曲 / 歌单分享同样走统一扫码外链入口：二维码内容为 `https://pisamusic.partialy.cn/scan?type=music-share&uuid=<uuid>`，App 唤起为 `pisamusic://scan?type=music-share&uuid=<uuid>`，不要新增 `pisamusic://share` 或顶层 `/share` 分发路径。服务端接口挂载 `/api/shares`：`POST /api/shares` 走系统 AES-GCM 加密并要求账号 `Authorization`，创建或复用 `share_records` 记录；同一分享人、类型和 `subject_key=<source>:<id>` 的有效分享只保留一条 uuid，不同分享人各自独立。`GET /api/shares/public/:uuid` 是公开明文读取接口并递增访问次数，仅 `/api/shares/public/*` 允许进入明文白名单。官网 `server/frontend/public/scan/` 同时承载一起听和音乐分享展示。
- 分享记录后台管理接口挂载在 `/api/admin/shares`，支持按 `type=song|playlist`、分享人关键词和 `valid=true|false|all` 分页筛选，并展示访问次数和最近更新时间；操作列可按现有 `/scan?type=music-share&uuid=<uuid>` 契约预览公开页或复制分享链接；单条分享只能通过 `PATCH /api/admin/shares/:uuid/invalid` 标记失效，必须保留 `share_records` 历史记录，不删除 `raw_json`，也不要改变 `GET /api/shares/public/:uuid` 的公开读取契约。
- 桌面端 `yixi/` 复用同一分享契约：详情页入口为 `/media/detail`，创建/读取分享必须经 main 侧 `share:*` IPC 访问外层 `server`，renderer 不直接持有 server 地址、账号 token 或加密细节。
- 桌面端 `/media/detail` 分享态不展示或强调音源：歌曲展示歌手、歌名、专辑、时长和访问次数；歌单展示描述、分享人和访问次数。本地详情入口继续保留原有来源与本地统计语义。
- 一起听歌曲身份只允许 `listen:change_song` / `CHANGE_SONG` 改写；`PLAY`、`PAUSE`、`SEEK`、`ENDED` 必须携带当前 `songRef { source, id }`，服务端发现与 `room.song` 不一致时返回 `applied=false` 且不得修改版本、进度或广播。切歌使用 `transitionId` 关联成员命令、房主执行、广播与 ACK，`CHANGE_SONG` 同时携带 `queueItemId` 作为房间队列当前指针的权威标识。
- 用户管理模块：后台接口挂载在 `/api/admin/users*`，支持用户分页查询、资料编辑、详情统计和硬删除；详情统计读取 `user_sync_items` 中未删除的 `favorite_song`、`favorite_playlist`、`user_playlist` 以及 `user_track_stats` / `user_listening_stats` 听歌统计，详情表格数据通过 `/api/admin/users/:id/library` 按分类（含 `favoriteSongs`、`favoritePlaylists`、`userPlaylists`、`listeningHistory`）分页加载，默认每页 30 条；不要暴露 `password_hash`，不要把用户管理逻辑继续堆进通用 admin 大文件。
- 反馈管理模块：客户端继续通过 `POST /api/feedback` 提交反馈，记录保存在 SQLite 的 `feedback` / `feedback_images` 表，图片位于 `server/uploads/feedback/` 并通过 `/uploads/feedback/*` 访问；后台鉴权接口挂载在 `GET /api/admin/feedback`、`GET /api/admin/feedback/:id` 和 `PATCH /api/admin/feedback/:id/status`，支持类型、状态、关键词筛选及 `pending` / `processed` 两态处理流转。反馈持久化和后台查询统一放在独立 feedback store，不要重新堆进通用 `configStore` 或 `admin.ts`。
- 故障上报统一使用加密 `POST /api/fault-reports`：Android `playback_fault_logs` 以 `scene=play_url` 上报 KG / WY / KW 取链和播放器失败；PC `network_error_records` 以 `scene=desktop_network` 上报经过脱敏的主进程网络错误。两端均允许匿名提交，有效账号 token 只绑定用户 ID，成功后只按本批日志 UUID 精确标记；服务端 `fault_reports` / `fault_report_logs` 按客户端日志 UUID 去重，并通过 `platform/arch` 区分 Android 与 PC。后台 `/api/admin/fault-reports` 支持两种场景筛选、详情、`pending` / `processed` 状态流转、单条 JSON、批次 ZIP 和级联删除。
- 七牛安装包上传：管理后台通过 `/api/admin/release-files/upload-token` 获取上传凭证，客户端直传七牛后调用 `/api/admin/release-files/complete` 登记文件，再发布版本；删除历史安装包使用 `/api/admin/update-history/:id/release-file`。
- 账号接口：`/api/auth/email-code` 与 `/api/auth/phone-code` 发送注册/登录/重置密码验证码；`/api/auth/register` 支持邮箱或手机号注册；`/api/auth/login/password` 支持用户名/邮箱/手机号+密码登录；`/api/auth/login/code` 支持邮箱或手机号验证码登录，未注册联系人校验成功后自动注册；`/api/auth/password/change` 登录态修改密码；`/api/auth/password/reset` 支持邮箱或手机号验证码重置密码；`/api/auth/refresh` 刷新 7 天 token；`/api/auth/me` 获取当前账号；`/api/auth/profile/email-code`、`/api/auth/profile/phone-code` 和 `PATCH /api/auth/profile` 修改资料或绑定手机号。
- 验证码记录模块：发送验证码（邮箱/短信）统一持久化到 SQLite 的 `verification_code_records` 表，记录通道（`email` / `phone`）、目标联系人、用途（`register` / `login` / `reset_password` / `profile_email` / `profile_phone`）、验证码、触发用户（若有）、触发设备 ID（`x-pm-device-id`）、客户端 IP、发送状态（`sent` / `verified` / `expired` / `failed`）及时间；验证成功时自动将对应记录流转为 `verified` 并记录 `verified_at`。后台管理接口为 `GET /api/admin/verification-codes` 与 `DELETE /api/admin/verification-codes/:id`，前端作为“验证码记录”置于左侧菜单用户管理下方，支持多维筛选与分页。
- 同步接口：`/api/sync/changes` 通过账号 token 拉取/推送增量，DTO 以 PC 端 `Song` / `CommonPlaylist` 字段为准；旧同步码创建、加入、重置和解绑设备接口已移除。
- 听歌时长与等级模块：服务端 `server/src/routes/listening.ts -> services/listeningService.ts -> db/listeningStore.ts` 保存不可变播放片段，并通过 `/api/listening/fragments/batch`、`/summary`、`/tracks` 提供账号级上报与查询；用户 ID 只取 User JWT，批量上报的设备 ID 只取必填 `x-pm-device-id`，V1 请求固定 `schemaVersion=1`、`platform=android|desktop`，不得携带播放器框架或本地路径等平台实现字段。时间统一为毫秒半开区间 `[startedAtMs, endedAtMs)`；权威总时长是同一用户所有设备、所有歌曲区间的并集，单曲统计是同一 `source + songId` 跨设备区间的并集，故单曲时长之和可以大于总时长。等级不写入用户表，后台 `/api/admin/listening/levels` 以 `expectedVersion` 乐观并发整组维护整数分钟闭区间：第一档从 0 开始、相邻档 `next.minMinutes=previous.maxMinutes+1`、只有最后一档为 `maxMinutes=null`，默认仅 Lv 1（0 分钟至无上限）；用户等级按 `floor(totalMs / 60000)` 动态推导。当前 Android 仅保留后续实现计划，尚未接入采集或展示；落地时应使用同一 V1 契约，15 分钟批量上报，并在账号 session 恢复/登录成功后每个启动周期对当前账号最多主动补传一次。未来 PC 直接复用同一 V1 契约。
- 统计与仪表盘模块：公开接口为 `POST /api/analytics/site-visit`（强制明文，日 UV 上报）与 `GET /api/config/download/:platform`（强制明文，官网安装包下载重定向与统计）；管理端聚合接口挂载在 `GET /api/admin/dashboard?days=7|30|90`（需 JWT 鉴权与加密，返回 7/30/90 天零填充日序列与聚合汇总，严禁返回单条 IP、访客 hash 或明细 User-Agent）。后台“官网记录”通过 `GET /api/admin/website-records?type=visit|download&offset&limit` 分页读取摘要，并通过 `GET /api/admin/website-records/:type/:id` 查看单条完整字段；两者同样要求管理员 JWT 和加密通信。原始事件写入 `site_visit_records`、`download_records`、`device_daily_activity` 表，通过 `ANALYTICS_RETENTION_DAYS`（默认 180 天）每日门禁清理过期数据；官网日 UV 基于 localStorage 访客 ID 加盐哈希（`ANALYTICS_HASH_SALT`）并由数据库唯一索引最终去重；管理后台采用 Recharts 懒加载仪表盘作为默认主页，“官网记录”固定放在左侧菜单第三项。
- 运行时策略管理与下载保护：服务端策略常量由 SQLite `runtime_configs` 表（包含 `key`、`name` 中文说明、`value_json`、`updated_at`）与内存 `configManager` 单例统一维护，启动时优先初始化全表加载，提供 0 数据库 IO 高性能同步读取与原子批量提交。安装包与 PC 自动更新七牛私有下载链接 TTL 统一由 `storage.releaseDownloadUrlTtlSeconds` 维护（默认 300 秒），云盘播放/歌词签名 TTL 保持 3600 秒；官网下载入口 `/api/config/download/*` 经由明显爬虫拦截中间件对脚本 UA（`python/`、`aiohttp/`、`curl/`、`wget/` 等）返回 403；下载相关入口共享 IP 滑动窗口限流中间件（默认 60 秒内 5 次），超限返回 429 与 `Retry-After`。后台管理接口为 `GET/PATCH /api/admin/runtime-config`。
- 服务端接口文档与索引维护：服务端所有对外及管理端接口必须在 `server/apidoc/` 下保持最新。接口有新增、变更字段/规则、重构或删除（CRUD）时，必须同步更新对应模块文档文件（如 `server/apidoc/<module>/<apiName>.md`）及 `server/apidoc/index.md` 索引链接与描述，禁止代码与接口文档脱节。

管理后台与官网：

- 管理后台目录：`server/admin/`
- 官网目录：`server/frontend/`
- 两端仍可通过各自 `package.json` 的 `build` 单独构建；不要恢复旧的 `build:web`、`deploy:web` 或复制到 `server/web/` 的流程。如果脚本或部署方式变化，需要同步更新本文档。

PC 桌面端 App：

- 目录：`yixi/`
- 技术栈：Electron + Vue 3 + TypeScript + Naive UI + Pinia + howler + electron-vite + electron-builder。
- 正式包先读取第 0 层服务发现文件 `https://pisamusic.partialy.cn/pm-config/config-v1.json`；维护该 JSON 时先修改地址，再递增 `configVersion`，最后更新 `publishedAt`，`configVersion` 只能单调递增，不能通过恢复旧数字回滚。
- 发现文档的 `serviceOrigins` 按 `priority` 从小到大选择，客户端按 `environment/development → remote → cache → embedded` 解析；缓存只存 main-only SQLite `service_discovery_cache` 表，不得放入 renderer 可通过 settings IPC 访问的通用 key，更低版本远程文档不得覆盖缓存或内存快照。
- `serviceOrigins[].apiBaseUrl`、`realtimeBaseUrl` 和开发环境变量覆盖必须是纯 origin：仅 HTTPS（开发 localhost 可用 HTTP），且不得包含认证信息、路径、query 或 hash；自动更新 feed 允许路径，但仍只允许不含认证信息、query、hash 的 HTTPS URL，后台保存时执行同样校验。
- `systemClient`、一起听 Socket、相对账号头像和 updater 必须读取服务发现快照；不得在调用方重新硬编码业务域名，renderer 不得取得服务端 base URL。
- 远程发现或业务 API 故障进入本地模式时，自动更新仍可使用发现快照中的更新 feed；`minimumSupportedVersion` 目前仅是发现元数据，不在本轮强制升级。
- PC 在线歌曲播放缓存由 `yixi/electron/mediaCache/` 独立管理：renderer 只使用 `pisacache://media/<cacheKey>`，main 负责源站取链、Range 流式转发、分片落盘、独立 SQLite 索引和 LRU；缓存身份为 `source + songId + qualityKey`。
- PC 播放缓存只写入用户缓存目录下的 `.pisamusic-cache/v1`，空配置回退 `userData/data/media-cache`；`cacheLimitGb=0` 关闭缓存，清理操作不得影响下载、本地歌曲、Chromium Cache 或业务数据库。
- 开发：`pnpm --dir yixi dev`
- 类型检查 / 构建：优先使用 `yixi/package.json` 中现有脚本，例如 `pnpm --dir yixi build:t`。
- 媒体缓存聚焦测试：`pnpm --dir yixi test:media-cache`
- Windows 打包：`pnpm --dir yixi build:win`

## 验证要求

- Android 改动优先运行对应 Gradle 构建或单元测试；UI 流程需要真机或模拟器手动验证。
- 服务端改动至少运行 TypeScript 构建，并按影响面检查相关接口。
- 管理后台、官网或 PC 桌面端前端改动需要运行对应构建；涉及视觉或交互时要做浏览器或 Electron 窗口检查。
- 跨端接口改动要做最小联调验证，确保旧字段兼容或迁移路径清晰。
