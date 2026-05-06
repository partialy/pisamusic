# AGENTS.md

本文件用于指导 Codex / Claude Code 在 `pm/` 手机端 App 项目内协作。外层总规则见 `../AGENTS.md`。

## App 介绍

`pm` 是 PisaMusic 的手机端 Android App，采用单模块 `:app`。项目以 Kotlin 为主，少量 Java，使用 MVVM、Hilt、ViewBinding、Media3 / ExoPlayer 构建音乐播放、搜索、下载、本地音乐、配置拉取、反馈、公告、更新检测等能力。

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

## 网络与服务端契约

- KG：`KgApiService`、`KgUrlProxyApiService`、`KgRepository`、`DfidInterceptor`
- WY：`WyApiService`、`WyUrlProxyApiService`、`WyRepository`
- KW：`KwSearchApiService`、`KwUrlProxyApiService`、`KwRepository`
- `ConfigManager` 从外层系统服务端获取启动配置，并动态提供 KG / WY / KW / proxy 端点、歌曲 URL 端点和网关签名配置。
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
