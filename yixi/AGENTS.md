# AGENTS.md

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
- renderer 侧 `src/utils/api/musicAPI.ts` 是音乐搜索、取链、歌词获取、歌单基础接口和动态封面的过渡入口，旧 `directAPI` / `proxyAPI` 仅用于尚未迁移的登录、账号等模块或失败兜底。

## 主题规则补充

- 桌面端主题统一由 `src/store/theme.ts` 管理，持久化写入 SQLite settings 的 `app-theme`，不要在组件里直接读写 `localStorage("pisa-theme")` 或 `localStorage("theme")`。
- Naive UI 主题只通过 `NConfigProvider` 绑定 `useThemeStore().naiveTheme` 和 `naiveThemeOverrides`，不要在单个组件里硬编码 Naive UI 默认绿色或重复覆盖 primary token。
- 项目自有视觉变量集中写在 `src/base.css`，浅色/深色分别使用 `:root[data-theme="light"]` 与 `:root[data-theme="dark"]`；新增变量时写中文注释，方便后续调整颜色。
- 强调色通过 `--color-primary` 等运行时变量和 Naive UI overrides 同步，新增播放控件、选中态、进度条时优先使用这些变量。

本文件用于指导 `yixi/` 桌面端 App 的开发。根目录规则仍然有效；本文件只补充桌面端自己的边界和约定。

## 项目定位

- `yixi/` 是 PisaMusic 当前 PC 桌面端 App 的主开发目录，旧 `pm-electron/` 不再继续作为桌面端实现目标。
- 项目源自早期一夕音乐代码，目前目标是整理结构、接入外层 `server/`、补齐 SQLite 本地数据、验签、加密和后端配置能力。
- 产品形态优先 Windows，后续兼容 macOS / Linux；打包使用 electron-builder。
- UI 可以保留已有设计资产和交互思路，但代码需要逐步工程化、模块化，避免把旧逻辑继续堆在单个大文件里。

## 技术栈

- 框架：Electron + Vue 3 + TypeScript + electron-vite。
- UI：Naive UI、Vue 组件、Pinia 状态管理。
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
- renderer 侧本地曲库相关读写统一经过 `src/store/library.ts`，负责把旧 localStorage 数据兼容迁移到 SQLite。
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
- 旧的无用代码、调试接口、废弃 API 和硬编码配置要在确认无依赖后清理。
- 涉及后端请求、加密、验签、音源解析的逻辑要集中封装，避免散落在组件里。
- 修改项目框架、持久化方案、IPC 契约或服务端契约时，必须同步更新本文件。

## 常用命令

- 安装依赖：`pnpm --dir yixi install`
- 开发：`pnpm --dir yixi dev`
- 构建：`pnpm --dir yixi build`
- 类型检查加构建：`pnpm --dir yixi build:t`
- Windows 打包：`pnpm --dir yixi build:win`
