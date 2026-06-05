# AGENTS.md

本文件用于指导 Codex / Claude Code 在 `pm/` 手机端 App 项目内协作。外层总规则见 `../AGENTS.md`。

## App 介绍

`pm` 是 PisaMusic 的手机端 Android App，采用单模块 `:app`。项目以 Kotlin 为主，少量 Java，使用 MVVM、Hilt、ViewBinding、Media3 / ExoPlayer 构建音乐播放、搜索、下载、本地音乐、扫码入口、配置拉取、反馈、公告、更新检测等能力。

服务端已经迁移到外层 `../server/`。本项目内不再维护 `server/` 后端代码；凡是涉及系统配置、公告、更新、反馈、设备上报、管理后台、官网或服务端加密逻辑的改动，都应到 `../server/` 中处理，并同步检查 Android 端数据模型和接口调用。

## 项目规则

- 遵守外层 `../AGENTS.md` 的工作区规则，尤其是禁止未经批准批量删除工作区外文件。
- `pm/` 不再是独立 Git 仓库，版本管理统一使用外层根目录 monorepo。修改前在根目录或本目录查看 `git status --short`，不要回退用户已有的无关改动。
- 如果 App 新增功能、调整模块边界、改变构建方式、改变后端契约或迁移关键实现，需要同步更新本文件。
- 不要主动去 `../example/` 搜索参考代码。只有用户明确指定某个模块要参考 `example` 时，才允许读取对应内容。
- Android 端与服务端接口字段保持同步；涉及配置、更新、公告、反馈、设备上报、加密白名单时，同时检查 `../server/`。

## 构建与运行

- Debug 构建：`.\gradlew.bat assembleDebug`
- Release 构建：`.\gradlew.bat assembleRelease`
- 安装 Debug：`.\gradlew.bat installDebug`
- 单元测试：`.\gradlew.bat testDebugUnitTest`
- 清理：`.\gradlew.bat clean`
- macOS / Linux 可使用 `./gradlew ...`

后端环境：

- 外层服务端目录：`../server/`
- 本地服务端默认端口：`53380`
- Android Debug 后端：`http://192.168.9.100:53380/`
- Android Release 后端：`https://pm-server.hs.partialy.cn/`
- `SYSTEM_SERVICE_BASE_URL` 由 `app/build.gradle.kts` 按 build type 注入。

## Android 架构

- 单模块：`:app`
- 主要语言：Kotlin，保留少量 Java
- UI：Activity / Fragment + ViewBinding
- 依赖注入：Hilt
- 播放：Media3 / ExoPlayer / MediaSession
- 状态：优先使用 `StateFlow` / `MutableStateFlow`
- 网络：Retrofit + OkHttp，系统服务端和第三方音乐源客户端分开维护
- 扫码：侧拉抽屉扫码入口使用 JourneyApps ZXing `ScanContract` 拉起扫码界面，结果先回传到 `MainActivity` 处理。

重要目录：

- `activity/`：启动页、搜索、播放器、设置、本地音乐、歌单导入、WebView 等 Activity。
- `ui/`：Fragment、Adapter、BottomSheet、Dialog、Binder、ViewModel 等 UI 层代码。
- `network/`：Retrofit API、Repository、Cookie 登录、加密、网关签名、运行时配置、第三方音乐源。
- `player/`：播放器门面、播放列表、ExoPlayer / MediaSession 包装、播放状态持久化。
- `utils/` 和 `util/`：下载、本地音乐、设置、设备信息、歌词、封面、异常处理等工具。
- `model/`：歌曲、搜索行、系统 API 数据、设备上报、下载音质等模型。
- `service/`：`MusicService` 前台 `MediaSessionService`。
- `assets/`：内置网页资源，例如发现页、本地设置、反馈、歌词颜色等页面。

## 播放器规则

- `MusicController` 是 UI 和 Service 使用的统一播放器门面。
- `PlaylistManager` 管理播放列表、当前下标、下一首队列和 `StateFlow`。
- `PlayerEngine` 管理 ExoPlayer、MediaSession、播放事件、进度、播放模式和状态持久化。
- `MediaItemFactory` 创建延迟解析的 `MediaItem`。
- `PlayUrlGetter` 负责 KG / WY / KW / LOCAL 播放地址解析和音质降级。
- `PlayerStateStore` 使用 SharedPreferences + kotlinx.serialization 持久化跨会话播放状态。

## 本地数据

- 自建本地歌单及其歌曲关系以 `pm_local_music.db` SQLite 数据库为主存储，由 `LocalPlaylistDbStore` 管理。
- 收藏歌曲以 `pm_local_music.db` 的 `favorite_songs` 表为主存储，由 `LoveManager` 管理；旧版 `loveList.json` 仅用于迁移、导入导出兼容和备份镜像。
- `PlaylistCollectionManager` 仍是收藏/自建歌单的统一入口；网络歌单收藏写入 `favorite_playlists`，自建歌单写入本地歌单表。旧版 `collected_playlists.json` 与 `songs_<playlistId>.json` 会在加载时迁移到 SQLite。
- 本地歌单与收藏 JSON 文件仅用于导入导出兼容和备份镜像，不要再作为新的运行时主存储。
- 酷狗 / 网易第三方登录态统一由 `MusicCookieManager` 管理，存储在 `pm_local_music.db` 的 `third_party_login_sessions` 表；Cookie 与用户摘要（昵称、用户名、VIP、头像、背景图等）都从该入口读取，不要恢复 `kugou_cookie_user.json`、`wy_cookie_user.json` 或侧栏 profile JSON 缓存作为运行时来源。
- 酷狗手机验证码 / 扫码登录成功后，以登录响应里的 `token`、`userid` 作为主凭据调用 `/login/token` 补齐 `vip_type`、`vip_token`；`vip_token` 允许为空，最终合成 `KUGOU_API_PLATFORM=undefined; token=...; userid=...; vip_type=...; vip_token=...` 后仍统一写入 `MusicCookieManager`。
- 歌词与封面映射以 `pm_media_index.db` SQLite 数据库建索引，由 `LocalMediaIndexDbStore` 管理；歌词文本可入库，保存当前音源可用的最优原文歌词（KG 优先 KRC，WY 优先 YRC，失败再 LRC），封面大图/内嵌图仍保留在文件或音频标签中，数据库只记录来源和引用。
- 歌词解析统一走 `cn.partialy.pm.lyric.LyricParser`，输出 `LyricContent` / `LyricLine` / `LyricWord`。播放页 RecyclerView 使用 `lineText` 保持单行展示，卡拉 OK View 和状态栏歌词在“使用逐字歌词”开关开启且存在逐字时间时使用 `words` 做精准颜色过渡。
- 播放页卡拉 OK View 支持用户上下滑动浏览歌词，浏览时中线行可点击跳转播放；用户无操作 3 秒后恢复自动滚动。歌词样式设置中包含“播放时候逐字放大”开关，默认关闭，仅影响卡拉 OK View 当前逐字渲染效果。
- 状态栏歌词由 `MusicService` 驱动，设置页使用 WebView 加载 `assets/status_bar_lyric/`，悬浮歌词本体使用原生 `WindowManager` + 自绘 View；设置页可临时显示真实悬浮窗预览，调整宽度时悬浮窗会短暂显示容器背景作为宽度提示；不要把常驻悬浮窗实现绑定到播放器 Activity 生命周期。

## 网络与服务端契约

- KG：`KgApiService`、`KgUrlProxyApiService`、`KgRepository`、`DfidInterceptor`
- WY：`WyApiService`、`WyUrlProxyApiService`、`WyRepository`
- KW：`KwSearchApiService`、`KwUrlProxyApiService`、`KwRepository`
- `ConfigManager` 从外层系统服务端获取启动配置，并动态提供 KG / WY / KW / proxy 端点、歌曲 URL 端点和网关签名配置。
- 首页推荐页由 `RecommendedSongsViewModel` 聚合 KG 每日推荐 / 推荐歌单与 WY `/personalized` 推荐歌单、`/personalized/newsong` 推荐新歌；新增首页推荐来源时需要补齐模型、Repository 映射、`SongType`/`CollectedPlaylistType` UI 分流和播放 URL 解析。
- KG / WY 已登录且本地存在对应 Cookie 时，非播放 URL 的数据接口（搜索、推荐、歌单、歌词等）必须优先走 `KugouCookieRepository` / `WyCookieRepository` 的 Cookie 请求，失败后回退匿名 Retrofit；播放和下载 URL 仍只走现有 `KgUrlProxyApiService` / `WyUrlProxyApiService` 代理链路，不带 Cookie。
- 修改 endpoint 字段时，检查 Android `SystemData.kt` / `ConfigManager.kt`，以及 `../server/` 中的配置存储、类型和管理后台表单。
- 修改发现页字段时，检查 Android `DiscoverInfo` / `DiscoverFragment`，以及 `../server/` 的 discover 配置和管理后台系统页。

安全与加密：

- `SystemEncryptionInterceptor` 只用于 App 自有 `SystemApiService` 链路。
- 系统服务端请求会写入 `x-pm-random` / `x-pm-enc-ver`，把 JSON body 加密为 `{isEnc, encData}`，并解密加密响应。
- 服务端 AES-GCM、明文路径、时间戳校验和 nonce 防重放逻辑位于 `../server/src/middleware/encryption.ts`。
- `GatewaySignInterceptor` 只签名匹配 `GatewaySignRuntime` 的第三方网关请求。
- KG / WY / KW 第三方源 API 不使用系统 AES-GCM 客户端，但可能使用网关签名。

## 开发规范

- 优先组件化、模块化，避免把业务堆进 Activity / Fragment。
- ViewModel 负责 UI 状态和调度，Repository 负责数据来源，播放器逻辑放在 `player/`。
- 提取重复逻辑，一个方法只做一件事。
- 中文注释保持可读性，避免无意义注释。
- 单文件尽量不超过 1000 行；大型 Activity、Fragment、Adapter、工具类要拆分。
- 新增音乐源时，需要同时包含模型、API、Repository、搜索映射、播放地址解析和 UI 来源标识。
- 保持系统后端 Retrofit client 与第三方音乐源 client 分离，不要把系统 AES-GCM 拦截器混入 KG / WY / KW。

## 验证要求

- Android 构建：`.\gradlew.bat assembleDebug`
- Android 单元测试：`.\gradlew.bat testDebugUnitTest`
- 涉及 Release 配置或签名时再运行 `.\gradlew.bat assembleRelease`
- 涉及后端契约时，配合 `../server/` 验证 `/api/health`、`/api/config/check-update`、`/api/config/discover` 和加密配置接口。
- UI 密集流程仍需要真机或模拟器手动测试，例如播放、搜索、下载、发现页、反馈、更新弹窗。

## 同步字段模型补充

- 收藏歌曲、收藏歌单和自建歌单持久化需要同时写入与桌面端一致的 canonical 字段：歌曲使用 `id/source/urlParam/name/singer/album/cover/coverSize/duration/size/vip`，歌单使用 `id/source/name/desc/cover/coverSize/tags/song_count/play_count/collect_count`。
- `SongInfo`、`CollectedPlaylist` 可以作为 Android 播放和旧 UI 的兼容模型，但新增收藏、歌单和同步相关逻辑必须优先通过 `CanonicalSong` / `CanonicalPlaylist` 或对应转换方法处理，避免继续扩散 `artist`、`coverUrl`、`intro` 等旧字段名。
- `pm_local_music.db` 的收藏与自建歌单表已补齐 canonical 列和 `payload_json`；新增迁移时必须保持旧字段可读，确保历史数据升级后仍能显示和播放。

## 收藏与歌单同步

- 账号接口通过 `ConfigManager` / `SystemApiService` 访问外层服务端 `/api/auth/*`，继续走系统服务端 AES-GCM 加密链路；登录 token 由 `AccountSessionStore` 持久化并同步到 `TokenManager`。`LoginActivity` 只承载用户名/邮箱密码登录和邮箱验证码登录；注册账号、找回密码由 `AccountAssistActivity` 通过 `assets/account-assist/` 承载，并分别调用注册验证码、注册和 `reset_password` 重置密码接口。
- 同步接口通过外层服务端 `/api/sync/*` 拉取/推送增量，使用账号 `Authorization: Bearer <userToken>` 鉴权；旧同步码创建、加入、重置和解绑设备流程已移除。
- `SyncManager` 是手机端账号同步编排入口，负责登录后 seed 本地 outbox、拉取/推送增量和应用远端 tombstone；未登录时只记录本地 outbox，不主动推送；同步游标按账号隔离，账号切换时必须重置游标并重新 seed 本地 outbox。
- `sync_outbox` 表保存本地待推送 op，收藏歌曲、收藏歌单、自建歌单和自建歌单曲目变更必须写入 outbox；已登录账号时由 `SyncWorkRunner` 触发后台增量同步。
- `sync_outbox` 按账号 `account_id` 隔离读取和推送；账号切换、退出登录或 refresh 失效时必须清理旧账号/未归属 outbox，避免把上一账号待同步操作推给新账号。
- 同步 payload 只允许使用 `CanonicalSong` / `CanonicalPlaylist` 字段；不要同步 `source=local` 歌曲，不要同步播放 URL、filePath、歌词正文、内嵌封面。本地文件封面在自建歌单同步时置空，另一端应显示默认封面。

## 同步设置页补充

- 同步设置入口在 `SettingsActivity` 中展示账号同步摘要；未登录时跳转 `LoginActivity`，已登录时执行立即同步，不再提供同步码输入、同步码复制、同步码生成或解绑设备入口。
- `AuthInterceptor` 必须保留请求上已有的 `Authorization` 头，避免覆盖同步或其他显式鉴权请求。
- 自有账号主入口在“我的”页头像区域，不再放在侧拉栏；未登录点击头像打开 `LoginActivity`，已登录点击头像打开 `AccountProfileActivity`。
- “我的”页头像、昵称和邮箱优先读取 `AccountSessionStore` 中服务端账号字段；账号头像使用服务端 `avatarKey/avatarUrl`，相对路径按 `SYSTEM_SERVICE_BASE_URL` 拼接。
- `LoginActivity`、`AccountAssistActivity`、`AccountProfileActivity` 使用同类 edge-to-edge 全屏 WebView 容器；Native 统一注入 `--native-status-bar-height` 与 `--native-navigation-bar-height` CSS 变量，WebView 本身不要再额外设置系统栏 padding。个人资料页顶部 headerbar 由 `assets/account-profile/` 内的网页实现；资料修改走 `/api/auth/profile/email-code` 与 `PATCH /api/auth/profile`，成功后必须覆盖本地账号 session。

## 启动本地模式补充

- `SplashActivity` 启动检查遇到没网、服务不可用或服务端 `appAvailable=false` 时进入本地模式，由 `MainActivity` 以非阻塞提示告知用户；设备封禁仍必须阻止进入。
- 设置-关于中的“联系我们”通过 `/api/config/get?id=pm-contact-us` 获取 HTML 片段并用 WebView 渲染；服务协议和隐私政策页面只显示内容，不显示接口返回的 `title` 字段。

## 一起听补充

- Android 端一起听代码集中在 `listen/` 模块，包含 HTTP 仓库、Socket.IO 客户端、状态管理和服务端字段模型；播放器页只负责展示入口、房间面板和播放控制意图转发。
- 一起听 HTTP 接口沿用外层服务端地址；`GET /api/listen-together/config` 是明文接口，使用独立明文 Retrofit client；`POST /api/listen-together/rooms` 和 `GET /api/listen-together/rooms/:roomId` 继续走 `SystemApiService` 的 AES-GCM 加密链路。创建房间遇到 `USER_ALREADY_HAS_ROOM` 时先由播放器弹确认框，用户确认后才带 `replaceExisting=true` 重新创建。
- 一起听实时连接使用 `io.socket:socket.io-client`，连接时通过 Socket.IO `auth.token` 传 `Bearer <userToken>`；账号切换、退出房间、被踢出或房间销毁时必须断开 socket 并清空本地一起听状态。
- 一起听只支持在线歌曲，不支持 `SongType.LOCAL`；创建房间默认 `memberOperation=false`，房主可在房间面板切换“成员可操作”。成员未获授权时必须提示无权限并向服务端同步房间状态，不要本地抢控制权。
- 一起听开启后播放器队列面板展示房间专属队列，不能再使用本地 `MusicController.playList` 作为上一首、下一首、点歌或删除依据。房间队列不落服务端，由房主设备维护权威队列；服务端 `listen:queue` / `QUEUE_EVENT` 只负责校验成员并转发快照、增量和成员命令。
- 新成员加入时由房主通过 `QUEUE_EVENT` 分片发送队列快照，单片默认 200 首；常规队列变更由房主广播 `QUEUE_DELTA`，自然播放结束只允许房主决定下一首并发送 `listen:change_song`。

## 通用 UI 组件补充

- 居中确认类弹窗优先使用 `cn.partialy.pm.ui.dialog.PmMinimalDialog`；它是 280dp 简约卡片样式，支持单/双按钮、隐藏标题、确认按钮文字颜色和深浅色资源自动适配。
- 旧 `ModernDialog` 仍保留给下载进度、底部弹窗和单选弹窗等既有场景；不要为了普通确认弹窗继续扩展它。
