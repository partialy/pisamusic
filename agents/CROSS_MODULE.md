# 跨模块契约

本文件是客户端、Admin、Server 共同遵守的协议约束，只在修改相关接口或业务流程时按对应章节读取。各端实现细节保留在自己的 AGENTS.md，不要求日常任务通读本文件。以下源码路径均相对仓库根目录；接口详细定义见 [服务端接口索引](../server/apidoc/index.md)。

## 账号、权益与同步

- Server管理员与用户JWT均绑定当前数据库的 `installationId`。独立安装的数据库隔离登录态，完整复制保留源身份；升级前不带该字段的旧token需要重新登录，用户DTO与同步协议不变。未安装或复制未完成时业务HTTP/Socket返回不可用，安装流程仅由Admin处理，见[首次安装](../server/apidoc/system/setup.md)。

- 手机端与桌面端账号由外层 `server/` 的 `/api/auth/*` 提供服务，支持邮箱/手机号验证码注册、用户名/邮箱/手机号密码登录、邮箱/手机号验证码登录和 7 天 token 刷新。收藏/歌单同步由 `/api/sync/*` 提供服务，使用账号 `Authorization: Bearer <userToken>` 鉴权并按用户隔离数据；两端同步入口均基于账号登录，账号切换时同步游标必须按账号隔离并重新 seed 本地 outbox；旧同步码绑定空间流程已废弃，不要恢复 `/api/sync/spaces*`。
- 账号资料由 `/api/auth/profile*` 提供服务，支持修改昵称、头像 key 和经新邮箱验证码确认后的邮箱；公开用户字段包含 `id`、`username`、`email`、`avatarKey`、`avatarUrl`、`vip`、`vipExpiresAt`、`createdAt`。`vip` 与 `vipExpiresAt` 主要用于客户端内部音质/功能权益判断；允许的前端展示仅包括 Android“我的”页为有效 VIP 在邮箱下显示金色纯到期时间标签，以及 PC Header 昵称尾部的金色斜体方块 `V` 和用户资料页“特权到期时间”，不得扩展展示 VIP 等级、会员名称或其他标识。默认头像固定使用 `server/static/account-avatars/default.jpg`；自定义头像通过 `/api/auth/avatar/upload-token` 获取七牛 token 后由客户端直传到 `QINIU_PUBLIC_IMAGE_BUCKET` 公开图片空间，用户表 `avatar_key` 记录七牛对象 key，`avatarUrl` 直接返回公开直链；旧的多张内置头像自选功能已废弃，不要恢复。
- PisaMusic 系统账号 VIP 与 KG / WY 第三方音乐账号 VIP 完全分离。系统权益仅存 `users.vip_enabled`、`users.vip_expires_at`：有效 VIP 必须同时启用且到期毫秒时间戳晚于当前时间，公开 DTO 的 `vip` 由服务端实时计算并保留 `vipExpiresAt` 原值；不支持永久 VIP。后台仅可通过 `PUT /api/admin/users/:id` 以 `vipEnabled` 与未来的 `vipExpiresAt` 设置，关闭时必须写入 `0 / NULL`，不要把第三方 Cookie、VIP 字段或展示逻辑混入系统账号。
- 手机端和桌面端启动时如果外层服务不可用、没网或后台关闭 `appAvailable`，应进入本地模式并在主界面给非阻塞提示；设备被封禁仍然阻止进入。
- 桌面端设备上报使用服务端 `desktop_device_info` 表和 `/api/device/desktop/report`，不要复用 Android 的 `device_info` 表；后台通过 `/api/admin/desktop-device/*` 管理 PC 设备。
- 服务协议与隐私政策统一为纯文本，正文中的换行由 Android 原生页面、PC 弹窗和官网按原文显示；服务协议/隐私政策返回 `version`，标题或正文实际修改时递增，重复保存不递增。Android 启动协议接受状态必须绑定版本，PC 启动协议状态同样绑定版本。
- 账号接口：`/api/auth/email-code` 与 `/api/auth/phone-code` 发送注册/登录/重置密码验证码；`/api/auth/register` 支持邮箱或手机号注册；`/api/auth/login/password` 支持用户名/邮箱/手机号+密码登录；`/api/auth/login/code` 支持邮箱或手机号验证码登录，未注册联系人校验成功后自动注册；`/api/auth/password/change` 登录态修改密码；`/api/auth/password/reset` 支持邮箱或手机号验证码重置密码；`/api/auth/refresh` 刷新 7 天 token；`/api/auth/me` 获取当前账号；`/api/auth/profile/email-code`、`/api/auth/profile/phone-code` 和 `PATCH /api/auth/profile` 修改资料或绑定手机号。
- 同步接口：`/api/sync/changes` 通过账号 token 拉取/推送增量，DTO 以 PC 端 `Song` / `CommonPlaylist` 字段为准；旧同步码创建、加入、重置和解绑设备接口已移除。
- 歌单同步扩展统一使用 `sortOrder?:number|null`、`coverResource?:{resourceId:string}|null`、`coverPreset?:string|null`；缺字段保留、null清除，基础字段仍覆盖，delete不合并。排序同位按外层权威version再trackKey；封面类型切换显式清互斥字段，旧端仍读取cover。服务端在同步同一用户事务内校验资源本人归属、ready状态与对象可引用性，将cover规范化为权威公共URL并更新共享引用；失败整批回滚。
- 用户歌单封面使用 `/api/playlist-covers/upload-token`、`/complete`、`/:resourceId`，仅本人JWT访问。会话绑定用户/歌单/编辑代次，真实JPG/PNG/WebP不超过5MiB，完成先核验对象和图像信息，只产生资源、不提前改歌单。`file_records`为唯一对象账本，资源/引用见Server Schema v5；最后解除引用或未引用完成满七天且上传Token过期后才认领回收。deleting不可重新引用，失败留账重试；Admin删除与账号硬删除不得绕过引用和保护期。接口DTO见[封面契约](../server/apidoc/playlistCovers/overview.md)。
- LOCAL仅同步自建歌单安全占位：source=local，id为deviceScopeUuid:localSongUuid，urlParam=id，itemKey为playlistId|local:id；私有播放ID与文件映射留客户端，不传真实绝对路径/盘符路径/UNC/URI/歌词/Token/临时链接；公开元信息允许普通斜杠或反斜杠（如AC/DC），不得要求改写名称。新LOCAL发送可选durationMs（非负有限毫秒），消费端优先它并显式转换本机单位；duration仅保留旧字段兼容，不猜或改变在线旧payload的duration单位。白名单及长度见[推送契约](../server/apidoc/sync/pushSyncChanges.md#歌单扩展与-local-占位p1)。
- 父歌单delete同事务派生所有存活曲目墓碑；最终父墓碑阻止迟到/同批子upsert，不依赖输入顺序。派生日志各占权威version，并使用父opId与实体身份确定性派生的独立opId。accepted/skipped仅计输入，不能据push版本推进pull游标。
- 收藏歌曲同步 payload 可选 `favoritedAt`（毫秒时间戳），表示收藏关系的创建时间；新增和 seed 从持久化记录取值，下行用于排序，缺失兼容旧端。元数据更新不得无故重置收藏时间。
- 新端以 `protocol=2` 拉取同步；`mode=delta` 按实际返回的日志版本推进游标，不能直接跳到账号全局 `version` 或 push 返回版本。`mode=snapshot` 必须完整收集同一 `snapshotVersion` 的全部分页后再对账，版本变化时重启；快照含有的项更新、本地多余且无 pending 的项移除，未完成分页不能删除本地数据。同账号同 key 的本机待同步操作优先。
- 服务端兼容旧端 `changes` 字段；旧端无快照能力声明时，日志不足需返回可完整消费的兼容快照。回声过滤只应用于 delta，快照必须包含本设备来源的权威状态。设备标识使用稳定持久化身份，不能以厂商和型号作为去重身份。
- Android“删除全部数据”只清本机，不删除云端；同时清理本机 pending 并将当前账号游标重置到 0、保持无需重新 seed，下次同步可恢复云端数据。收藏备份 ZIP 继续使用 `loveList.json` 条目，由 SQLite 按需生成，应用不再维护该文件的运行时镜像。

## 公告与专属消息

- 系统公告存储在 `announcements`，通过 `enabled` 控制客户端是否拉取；停用只是不返回公开公告列表，不删除公告或历史回执。客户端确认公告后通过加密 `POST /api/announcements/:id/read` 提交已读，使用设备上报返回的 30 天 `messageToken` 作为 `x-pm-device-token`，可选绑定 User Token；回执记录用户与设备公开快照，后台通过 `/api/admin/announcements/:id/reads` 分页查看，禁止使用原始设备 UUID、设备 ID 或 token 作为客户端凭据。
- 专属消息统一存储在 `server` SQLite 的 `direct_messages` 表；每条消息只可指向一个接收方（账号、Android 设备或桌面设备）。后台用 `/api/admin/messages` 发送和分页查看，客户端用加密的 `/api/messages/unread`、`/api/messages/:id/read` 读取与确认。未读查询合并有效账号与当前设备的消息，`read_at` 是唯一权威已读状态；不要新增客户端永久已读表。设备消息只能使用设备上报返回的 30 天 `messageToken` 作为 `x-pm-device-token`，不得传或暴露原始设备 UUID。
- 管理后台支持通过加密 `DELETE /api/admin/messages/:id` 删除用户、Android 设备或 PC 设备留言；删除为硬删除，不提供客户端撤回语义，前后端接口文档同步维护。

## 发布、更新与云盘

- 官网发布信息支持 Android / PC 双端配置，推荐接口为 `GET /api/config/releases`；旧 `GET /api/config/check-update` 必须保持 Android 更新信息兼容，不要改成多端结构。
- PC 自动升级使用 `electron-updater` 的 generic feed，服务端公开 `/api/config/desktop-updates/win32/x64/latest.yml` 和同目录文件下载入口；自动更新资源统一存储在 `file_records` 表，由后台上传 `latest.yml`、安装包 EXE 和可选 blockmap 后启用，不要手写 `latest.yml`。
- Android 首页第二个 Tab 固定为“云盘”，PC 桌面端左侧导航在“收藏”与“我的”之间固定为“云盘”Tab；双端均通过外层 `server` 的 `/api/cloud-music/*` 浏览、搜索和播放独立 `cloud` 音源；列表分页固定每页 20 条，音质只有 `cloud:default`。`active` 可播放，`disabled` 只允许搜索和查看；客户端实际播放、切歌和下载前即时获取签名 URL，不把临时 URL 写入收藏、歌单、分享、播放状态或持久缓存。云盘歌曲支持一起听，使用 `source=cloud` 与稳定 UUID 作为歌曲身份，各设备独立签发播放地址，房间歌曲及队列不得携带临时播放 URL 或本地路径；LOCAL 音源仍禁止一起听。

## 扫码、音乐分享与一起听

- 一起听二维码统一编码 `https://pisamusic.partialy.cn/scan?type=listen-together-join&roomId=<房间号>`；Android App 与 `yixi/` 桌面端同时识别 `pisamusic://scan` Scheme。官网 `server/frontend/public/scan/` 负责浏览器唤起、复制房间号及安装后继续加入引导，`public/download/` 只按 Windows / Android 设备类型跳转官网并推荐对应下载项，不直接下载安装包；有效邀请参数需要贯穿下载页并可返回 `/scan/` 继续加入。
- 歌曲 / 歌单分享同样走统一扫码外链入口：二维码内容为 `https://pisamusic.partialy.cn/scan?type=music-share&uuid=<uuid>`，App 唤起为 `pisamusic://scan?type=music-share&uuid=<uuid>`，不要新增 `pisamusic://share` 或顶层 `/share` 分发路径。服务端接口挂载 `/api/shares`：`POST /api/shares` 走系统 AES-GCM 加密并要求账号 `Authorization`，创建或复用 `share_records` 记录；同一分享人、类型和 `subject_key=<source>:<id>` 的有效分享只保留一条 uuid，不同分享人各自独立。`GET /api/shares/public/:uuid` 是公开明文读取接口并递增访问次数，仅 `/api/shares/public/*` 允许进入明文白名单。官网 `server/frontend/public/scan/` 同时承载一起听和音乐分享展示。
- 扫码单曲分享可跳转 `/listen/?share=<uuid>` 网页试听；浏览器只以公开分享 DTO 中的 `wy` / `kg` / `kw` 单曲作为播放输入，歌单、云盘和本地歌曲仍走客户端。
- 一起听歌曲身份只允许 `listen:change_song` / `CHANGE_SONG` 改写；`PLAY`、`PAUSE`、`SEEK`、`ENDED` 必须携带当前 `songRef { source, id }`，服务端发现与 `room.song` 不一致时返回 `applied=false` 且不得修改版本、进度或广播。切歌使用 `transitionId` 关联成员命令、房主执行、广播与 ACK，`CHANGE_SONG` 同时携带 `queueItemId` 作为房间队列当前指针的权威标识。

## App 推广与归因

- 分享来源支持权威设备Token的 `android` / `desktop`，不同来源的相同设备ID隔离查询；Admin的 `deviceKind=all|android|desktop` 同时作用于列表、汇总、趋势和CSV。分享来源与实际Android/Windows下载平台独立，不能把PC分享码的所有下载都算PC下载。
- PC通过main的 `system:get-app-share` 请求上述原接口，renderer无JWT/设备Token。设备与账号/游客复合缓存仅在main内存保留，不跨身份复用；每次打开重新校验，离线同身份缓存标为未校验并禁用二维码/复制。401只做一次合法身份恢复，不移除凭据降游客；关闭/身份变化丢弃迟到响应。Header与关于共用App推广弹窗，和音乐分享弹窗独立。

- App 推广分享与歌曲/歌单分享独立：配置存于 SQLite 单条 `app_share_config`，获取入口仍为 `GET /api/config/app-share`。旧无设备凭证请求返回通用配置；新版通过 `x-pm-device-token` 和显式账号 Authorization 绑定设备与账号（游客独立），幂等获取六位 Base62 短码，不新增获取链接接口，认证失败不得降级游客。响应 `private, no-store`，新增 `shareCode` / `trackingEnabled`，原 `qrCodeText` / `copyText` 由服务端统一渲染专属链接。管理员通过 `/api/admin/app-share` 保存配置和上传图标，二维码地址仅允许本站 HTTPS `/app-share/`，禁止手填 code。图标核验后登记 `file_records`（`usage_type='app-share-icon'`），保存才切换引用，当前图标禁止删除。Android 按账号和设备隔离缓存，首次获取前禁用二维码、复制和系统分享，关闭或身份变化时丢弃迟到响应，不引入微信/QQ SDK。
- App 推广追踪独立使用 `app_share_records`、`app_share_visits`、`app_share_downloads`、`app_share_daily_stats` 四表；只有 `/app-share/` 页面成功上报 `/api/app-share/visits` 才计 PV/日 UV，`/download/`、首页、音乐分享和一起听不计推广访问。公开短码校验为 `/api/app-share/public/:code`；明文白名单只开放这两个浏览器接口，管理接口仍需 JWT 和加密。官网下载原入口 `/api/config/download/:platform` 在成功跳转时追加推广下载触发，显式 code 优先（无效码禁止回退 Cookie），否则使用 7 天签名 Cookie 的最后有效触点；不向外部安装包地址透传 code。下载触发不等于安装、注册或邀请成功。主记录和日报长期保留，明细按分析保留期清理；全站日 UV 单独去重，跨天汇总称累计日 UV。

## 故障上报与听歌统计

- 故障上报统一使用加密 `POST /api/fault-reports`：Android `playback_fault_logs` 以 `scene=play_url` 上报 KG / WY / KW 取链和播放器失败；PC `network_error_records` 以 `scene=desktop_network` 上报经过脱敏的主进程网络错误。两端均允许匿名提交，有效账号 token 只绑定用户 ID，成功后只按本批日志 UUID 精确标记；服务端 `fault_reports` / `fault_report_logs` 按客户端日志 UUID 去重，并通过 `platform/arch` 区分 Android 与 PC。后台 `/api/admin/fault-reports` 支持两种场景筛选、详情、`pending` / `processed` 状态流转、单条 JSON、批次 ZIP 和级联删除。
- 听歌时长与等级模块：服务端 `server/src/routes/listening.ts -> services/listeningService.ts -> db/listeningStore.ts` 保存不可变播放片段，并通过 `/api/listening/fragments/batch`、`/summary`、`/tracks` 提供账号级上报与查询；用户 ID 只取 User JWT，批量上报的设备 ID 只取必填 `x-pm-device-id`，V1 请求固定 `schemaVersion=1`、`platform=android|desktop`，不得携带播放器框架或本地路径等平台实现字段。时间统一为毫秒半开区间 `[startedAtMs, endedAtMs)`；权威总时长是同一用户所有设备、所有歌曲区间的并集，单曲统计是同一 `source + songId` 跨设备区间的并集，故单曲时长之和可以大于总时长。等级不写入用户表，后台 `/api/admin/listening/levels` 以 `expectedVersion` 乐观并发整组维护整数分钟闭区间：第一档从 0 开始、相邻档 `next.minMinutes=previous.maxMinutes+1`、只有最后一档为 `maxMinutes=null`，默认仅 Lv 1（0 分钟至无上限）；用户等级按 `floor(totalMs / 60000)` 动态推导。Android 与 PC 已接入同一 V1 契约，采集、补传与展示细节分别见 `pm/AGENTS.md` 和 `yixi/AGENTS.md`；不得再将其描述为尚未接入。
