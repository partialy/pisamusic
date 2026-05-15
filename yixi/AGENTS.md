# AGENTS.md

## 登录 Cookie 模块规则补充

- KG / WY 登录 Cookie 能力统一放在 `electron/cookie/` 与 `electron/ipc/cookieIpc.ts`，IPC 前缀使用 `cookie:*`；不要把登录 Cookie 逻辑写回 `music:*`、`proxyAPI` 或页面组件。
- Cookie 持久化使用 `app.getPath("userData")/data` 下的 JSON 文件：`kugou_cookie_user.json`、`wy_cookie_user.json`，结构为 `{ "cookies": [{ "name", "value", "path", "expires" }] }`。
- WY Cookie JSON 只允许保存 `MUSIC_U`；登录窗口、接口响应或旧文件里出现的其它网易 Cookie 都要在 main 侧过滤掉。
- Cookie 存储采用内存优先：首次访问从 JSON 文件加载到 main 进程 Map，后续请求读取内存；只有登录、退出、Cookie 更新、过期/非法项清理时写盘。
- KG Cookie 刷新由 main 侧 `refreshKgCookieIfNeeded()` 统一处理，刷新时间戳写入 SQLite settings 的 `cookie-kg-refresh-state`；12 小时内不要重复请求 `/login/token`，启动时可静默检查一次。
- renderer 只能通过 preload 暴露的 typed API 和 `src/utils/api/cookieMusicAPI.ts` 访问登录、Cookie、账号资料与用户歌单；不要再用 localStorage 保存 KG/WY 登录态。
- 需要 Cookie 的 KG/WY 请求直接访问 runtime endpoints 中的 `kgServer` / `wyServer`，并在 main 端通过 `requestSignedGatewayWithCookie()` 追加 Cookie 与签名；不要走 `proxy-service`。
- 侧边栏 KG / WY 入口是登录态动态菜单：renderer 统一通过 `src/composables/useCookieAccountStatus.ts` 读取账号资料并共享状态；只有对应 Cookie 账号已登录时才显示 `/kg`、`/wy` 入口。
- `我的` 页使用类似收藏页的标题 + tab 结构，tab 固定为账号、KG云盘、WY云盘、KG歌单、WY歌单；账号页承载 KG / WY 登录卡片，云盘页先放 `SongList` 占位，歌单页通过 Cookie API 拉取用户歌单并复用 `PlaylistCollect` 排版。设置页不再展示账号设置 tab，只保留应用配置与调试能力。
- WY 云盘歌曲通过 `cookie:wy-cloud-songs` IPC 调用 `/user/cloud`，renderer 转成 `Song[]` 后复用 `SongList`；云盘歌曲本身不带播放 URL，播放时仍交给现有 WY 取链逻辑处理。

## Electron IPC 与桌面歌词规则补充

- main 侧 IPC 必须按职责模块化注册：窗口控制放在 `electron/ipc/windowIpc.ts`，日志放在 `electron/ipc/logIpc.ts`，音乐、持久化、system 继续使用各自 `ipc/*` 模块，不要再把新 IPC 堆回 `electron/main.ts`。
- preload 只暴露最小 typed API，不要恢复旧的 `store-get/store-set`、`get-request-url`、`open-kg-window`、cookie 读取等兼容入口；登录 Cookie 后续需要重新设计专用能力。
- 桌面歌词统一由 `electron/desktopLyricManager.ts` 管理，窗口必须是透明、置顶、`skipTaskbar: true` 的悬浮层；打开窗口时必须推送最近歌词快照，不能依赖切歌后才刷新。
- 桌面歌词状态用快照同步，包含当前歌曲、歌词、播放进度、播放状态、样式和锁定状态；renderer 更新歌词时即使窗口未打开，也要把最新歌词送到 main 缓存。
- 桌面歌词样式和锁定状态持久化统一使用 SQLite settings 的 `desktop-lyric-setting`；设置页、托盘和歌词窗口必须通过同一份 main 快照同步，不要新增独立 localStorage 或 electron-store 设置来源。
- renderer 捕获请求、收藏、播放、歌词等错误时，UI 只显示简洁提示，同时必须通过 `reportError()` / `electronAPI.reportError()` 写入 main 日志，便于查询堆栈和上下文。

## 收藏与侧栏规则补充

- 收藏歌曲、收藏歌单统一写入 SQLite 的 `favorite_songs` / `favorite_playlists`，renderer 通过 `library:favorites:*` IPC 和 `useCollectStore` 访问，不再新增文件式 `collect/*.json` 收藏持久化。
- 旧收藏 IPC（如 `collect-song`、`collected-songs`、`collect-list`）和旧 `/mine/collect*` 收藏页已经移除，不要恢复或新增兼容调用。
- 收藏键使用 `source:id`，组件判断收藏状态必须调用 `containsSong(song)` / `containsPlaylist(playlist)`，不要直接用裸 `id` 查询 `songMap` 或 `playlistMap`。
- 歌曲收藏只能传递规范化后的 `Song` 纯 DTO；进入 IPC / SQLite 前必须经过 `normalizeSong()`，避免 Vue Proxy、嵌套响应式对象或运行时 `url` 字段进入收藏持久化。
- 歌单收藏只能传递规范化后的 `CommonPlaylist` 纯 DTO；进入 IPC / SQLite 前必须经过 `normalizePlaylist()`，禁止把 Vue Proxy、原始接口对象、函数字段或裸 `id` 直接传入收藏链路。
- 左侧菜单保持扁平结构：首页、歌单、收藏、我的、本地与下载、设置；不要恢复旧的自建歌单/收藏歌单侧栏区或 Netease 分组入口。
- `我的`、`本地与下载` 当前是占位页，后续接登录、本地音乐或下载功能时再扩展对应页面。

## 请求与配置规则补充

- `electron/system/systemClient.ts` 是桌面端访问外层 `server/` 的统一入口：bootstrap/runtime endpoints 默认只做内存缓存，只有缓存为空时才拉取；需要强制刷新时才调用 `refreshBootstrap()` 或带 `fresh=true` 的 `system:get-runtime-endpoints`。
- system API 请求需要对齐手机端 PM 的加解密规则：main 侧统一添加 `x-pm-random`、`x-pm-enc-ver`，JSON 请求体使用 `{ isEnc, encData }` 信封，响应如果返回加密信封必须在 main 侧解密后再交给 renderer。
- renderer 不要在页面、store 或 API 工具中直接向 `server` 获取 baseURL，也不要持有 AES 派生逻辑、网关签名密钥或真实音源端点；音源请求统一走 main 侧 `music:*` IPC。

## 当前补充规则

- `electron/music/` 封装 KG / WY / KW 三源歌曲搜索、搜索建议、播放地址解析、歌词获取，以及主页推荐、KG/WY 歌单搜索、列表、详情、歌曲列表、动态封面等基础接口，renderer 通过 `music:*` IPC 调用；验签、运行端点和后续加密逻辑保留在 main 侧。
- `music:playlist-tracks` 支持 `page/pageSize` 旧分页参数，也支持可选 `offset` 精确偏移；歌单详情页首屏固定快速加载 30 首，后台按最大 1000 首一批继续补齐，避免大量小分页请求。
- renderer 侧 `src/utils/api/musicAPI.ts` 是音乐搜索、取链、歌词获取、歌单基础接口和动态封面的过渡入口，旧 `directAPI` / `proxyAPI` 仅用于尚未迁移的登录、账号等模块或失败兜底。
- WY 歌词获取统一只调用 `/lyric/new`，该接口响应中的 `yrc.lyric` 和 `lrc.lyric` 分别作为逐字歌词与普通歌词来源；不要再为同一首歌额外请求 `/lyric`。
- Electron 主进程网络请求失败统一写入 SQLite `network_error_records`，当前覆盖 `systemClient.ts` 内的系统接口、反馈提交和签名网关请求；默认只保留最近 1000 条。高级设置中的 Debug 网络错误面板只允许在未打包环境展示，并通过 debug IPC 分页读取、查看详情和导出 JSON。

## 设置与目录选择规则补充

- “跟随歌曲自动换色”属于主题设置的一部分，统一写入 SQLite settings 的 `app-theme.followSongAccent`，默认关闭；renderer 监听当前歌曲时必须先判断该开关，再决定是否根据封面更新强调色。
- “本地设置”统一通过 `src/store/settingStore.ts` 管理，并写入 SQLite settings 的 `local-setting`；当前字段包含本地扫描目录、缓存目录、缓存大小上限、下载目录和歌曲命名方式。
- 目录选择能力统一走 `dialog:select-directory` IPC，由 `electron/ipc/dialogIpc.ts` 注册、preload 暴露 typed API；不要在 renderer 侧直接接触 Electron 原始 `dialog` 对象。
- 当前“本地设置”只负责配置保存与界面联动，不提前实现扫描、缓存清理、下载落盘或命名规则消费逻辑。

## 主题规则补充

- 桌面端主题统一由 `src/store/theme.ts` 管理，持久化写入 SQLite settings 的 `app-theme`，不要在组件里直接读写 `localStorage("pisa-theme")` 或 `localStorage("theme")`。
- Naive UI 主题只通过 `NConfigProvider` 绑定 `useThemeStore().naiveTheme` 和 `naiveThemeOverrides`，不要在单个组件里硬编码 Naive UI 默认绿色或重复覆盖 primary token。
- 项目自有视觉变量集中写在 `src/base.css`，浅色/深色分别使用 `:root[data-theme="light"]` 与 `:root[data-theme="dark"]`；新增变量时写中文注释，方便后续调整颜色。
- 强调色通过 `--color-primary` 等运行时变量和 Naive UI overrides 同步，新增播放控件、选中态、进度条时优先使用这些变量。
- 主题背景渐变由 `src/store/theme.ts` 统一管理并写入 `--color-bg-track`；自动背景开启时根据主题色生成，关闭后才允许自定义渐变方向和最多 5 个颜色，不要在组件里直接硬编码应用轨道背景。

本文件用于指导 `yixi/` 桌面端 App 的开发。根目录规则仍然有效；本文件只补充桌面端自己的边界和约定。

## 项目定位

- `yixi/` 是 PisaMusic 当前 PC 桌面端 App 的主开发目录，旧 `pm-electron/` 不再继续作为桌面端实现目标。
- 项目源自早期一夕音乐代码，目前目标是整理结构、接入外层 `server/`、补齐 SQLite 本地数据、验签、加密和后端配置能力。
- 产品形态优先 Windows，后续兼容 macOS / Linux；打包使用 electron-builder。
- UI 可以保留已有设计资产和交互思路，但代码需要逐步工程化、模块化，避免把旧逻辑继续堆在单个大文件里。

## 技术栈

- 框架：Electron + Vue 3 + TypeScript + electron-vite。
- UI：Naive UI、Vue 组件、Pinia 状态管理；Tailwind CSS 已接入但关闭 preflight，并使用 `tw-` 前缀避免影响旧样式。
- 播放：howler 放在 renderer 播放层封装。
- 数据：SQLite 由 main 进程统一管理，renderer 通过 preload 暴露的安全 IPC 调用。
- 构建：electron-builder，优先保障 Windows 构建。

## 架构规则

- main 负责系统能力、SQLite、服务端配置拉取、验签、加密、音源请求、托盘、窗口管理。
- preload 只暴露稳定、最小化的 typed API，不暴露 Node、Electron 原始对象或内部密钥。
- renderer 负责 UI、交互状态和播放控制，不直接读取真实 baseURL、密钥、文件系统或数据库。
- shared 类型应抽离到明确目录，IPC 入参和返回值必须有统一类型。
- 旧代码里从 IPC 获取 baseURL、读取本地 `data/electronConfig.json` 或在 renderer 硬编码网关地址的逻辑，需要逐步迁移到 main 统一服务端 bootstrap。
- 配置、公告、反馈复用外层 `server/` 的接口；服务端配置每次拉取，不写入 SQLite 持久化。
- 外层服务端地址由 main 侧读取环境变量 `PISA_SERVER_URL` / `PM_SERVER_URL`，默认 `http://127.0.0.1:53380`。
- system 能力通过 `system:*` IPC 暴露，包括 bootstrap、runtime endpoints、公告、反馈；旧 `getServerPort` / `getRequestUrl` 仅作为兼容入口保留。
- 服务端加密、网关验签只允许在 main 侧封装，renderer 不直接持有 `gatewaySign.secret` 或 AES 派生逻辑。
- main 侧音源请求统一使用 `requestSignedGateway()`，它会从外层 `server` 每次拉取的 bootstrap 中读取 `gatewaySign`，并按 Android 端一致规则添加 `res-dec=1`、`t`、`n`、`s` 签名信息。
- renderer 启动后通过 `src/store/runtimeConfig.ts` 拉取 bootstrap/runtime endpoints，并统一应用到现有 `directAPI` / `proxyAPI` 实例；不要在页面里散落硬编码音源 URL。

## 数据规则

- SQLite 保存用户设置、主题设置、搜索历史、播放历史、队列快照等本地数据。
- 关键业务数据不要继续使用 localStorage 作为唯一持久化来源；迁移时可保留兼容读取，但写入目标应转向 SQLite。
- renderer 侧通用历史/队列读写统一经过 `src/store/library.ts`；本地扫描曲库读写统一经过 `src/store/localLibrary.ts` 和 `library:local:*` IPC。
- 搜索历史、播放历史、队列快照已经接入 SQLite；新增同类数据不要再新增散落的 localStorage key。
- 数据库、日志、运行目录、打包产物不纳入 Git。
- Electron 运行数据统一写入 `app.getPath("userData")/data`，不要依赖源码目录下被忽略的 `yixi/data/`。
- 迁移脚本必须幂等，重复启动不能重复建表或重复写入默认数据。

## 音乐与播放规则

- 音源优先保持 `kg`、`wy`、`kw` 三源分组搜索，不做跨源去重。
- 播放失败统一提示“播放失败，可尝试切换其他音源”，然后自动下一曲。
- 歌词可以先获取并进入 store，不要求首版展示歌词 UI。
- 需要保留 howler 作为播放引擎，避免后续再迁移。

## 代码整理规则

- 新增或重构代码优先按 `main / preload / renderer / shared` 边界拆分。
- 大型 Vue 组件要拆成页面、业务组件、基础组件和 hooks / store，不继续扩大单文件。
- 新增 Tailwind 样式类时使用 `tw-` 前缀，例如 `tw-flex`、`tw-gap-2`；不要改回无前缀或开启 preflight，避免冲突 Naive UI 和旧全局样式。
- 旧的无用代码、调试接口、废弃 API 和硬编码配置要在确认无依赖后清理。
- 涉及后端请求、加密、验签、音源解析的逻辑要集中封装，避免散落在组件里。
- 修改项目框架、持久化方案、IPC 契约或服务端契约时，必须同步更新本文件。

## 常用命令

- 安装依赖：`pnpm --dir yixi install`
- 开发：`pnpm --dir yixi dev`
- 构建：`pnpm --dir yixi build`
- 类型检查加构建：`pnpm --dir yixi build:t`
- Windows 打包：`pnpm --dir yixi build:win`
## 本地曲库与下载页规则补充

- “本地与下载”页面位于 `src/views/localDownload.vue`，首版包含“本地歌曲 / 下载歌曲”两个 tab；下载歌曲暂为空态，不要在没有下载落盘链路前伪造下载记录。
- 本地扫描目录统一存入 SQLite settings 的 `local-setting.scanDirectories`，最多 10 个；旧 `scanDirectory` 读取时只能作为兼容迁移来源，不要继续写入旧字段。
- 本地曲库扫描只允许在 main 侧实现，入口集中在 `electron/localLibrary/localLibraryService.ts` 和 `library:local:*` IPC；renderer 不直接访问文件系统或 SQLite。
- 本地歌曲写入 SQLite `local_songs`，扫描指纹写入 `local_library_scan_meta`；启动时智能扫描，设置变更和页面“立即刷新”强制重建。扫描失败必须保留旧库，不要先清空旧数据。
- 本地歌曲来源使用 `source: "local"`，播放时通过 `music:resolve-playable-url` 直接转换本地文件路径，不要走 KG/WY/KW 在线取链。
