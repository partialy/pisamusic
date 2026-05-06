# AGENTS.md

本文件用于指导 Codex / Claude Code 在 `pm-electron/` 桌面端 App 项目内协作。外层总规则见 `../AGENTS.md`。

## App 定位

`pm-electron` 是 PisaMusic 的 PC 桌面端 App。它是手机端 `pm` 的桌面版本，但不要求功能和界面完全一致；桌面端应有自己的窗口布局、播放体验、托盘能力、桌面歌词和长期扩展空间。

当前改造方向是以根目录 `../yixi/` 旧版桌面端为产品底座进行工程化重整。`yixi/` 只作为迁移源，不直接提交到主仓库；迁移时只取源码、资源和可复用设计，不迁入旧 `.git`、`node_modules`、`out`、`app`、`logs`、打包产物或运行数据。

参考方向包括旧版 `yixi/`、根目录 `../SPlayer/` 与主流桌面音乐播放器体验。`../SPlayer/` 只参考产品体验、页面组织、交互边界和工程思路，不复制代码或资源。`../example/` 只有在用户明确指定时才允许参考。

## 技术选型

- 框架：Electron + Vue 3 + TypeScript
- 构建：electron-vite
- UI：Naive UI + SCSS / CSS variables
- 状态：Pinia
- 播放：howler
- 本地数据：SQLite，必须在 main 进程封装访问
- 打包：electron-builder
- 平台：Windows 优先，保留 macOS / Linux 扩展空间

## 构建与运行

- 安装依赖：`pnpm install`
- 开发：`pnpm dev`
- 预览构建产物：`pnpm start` 或项目脚本中的 preview/start 等价命令
- 类型检查：`pnpm typecheck`
- 构建：`pnpm build`
- Windows 打包：`pnpm build:win`

脚本名称以当前 `package.json` 为准；如果迁移脚本时发生变化，必须同步更新本文件和 `PLAN.md`。

## 首版范围

- 三音源聚合搜索和播放，结果按酷狗、网易云、酷我分组展示。
- 公开搜索播放优先；登录 / Cookie 导入后续补，不作为当前工程化第一阶段阻塞点。
- 保留旧版可用的播放器栏、播放模式、播放队列、歌词能力和桌面歌词设计。
- 播放失败时提示“播放失败，可尝试切换其他音源”，然后自动下一曲。
- 复用外层 `../server/` 的配置、公告、反馈、设备上报、更新检查接口。
- 桌面端独立实现本地设置、播放历史、搜索历史、队列、收藏、歌词设置和后续设备信息等能力。
- 服务端配置每次启动或需要时从服务端拉取，不作为长期真源写入 SQLite。
- 首版桌面能力包含无边框窗口、系统托盘、基础播放控制；全局快捷键、自动更新、媒体键等后续扩展。

## 架构规则

- main 进程负责窗口、托盘、SQLite、文件系统、系统能力、服务层、服务端请求、音源请求、加密和验签。
- preload 只暴露类型安全的 IPC API，不暴露完整 Node 能力。
- renderer 只负责 Vue UI、Pinia UI 状态、howler 播放运行态和页面组合。
- shared 放公共类型、IPC contract、音源统一模型和跨进程常量。
- 三音源搜索、播放地址解析、歌词获取、服务端配置、公告、反馈、设备上报 API 应封装为 main service，不要散落在组件或 store 里。
- howler 播放控制可运行在 renderer，但播放地址解析、音源请求和敏感配置必须走 main IPC。
- SQLite 访问不要直接写在 Vue 组件或 Pinia store 中，必须通过 main IPC 或服务层。
- Pinia store 不直接调用真实 baseURL，不直接拼验签参数，不直接保存关键数据到 localStorage。
- 旧版 `window.electronAPI` 需要逐步迁移到统一的 `window.pisa`，迁移期如需兼容必须集中封装，不要在组件里到处判断。

## 服务端配置、加密与验签

- main 启动时通过 server 拉取 bootstrap、公告、更新信息和必要服务端配置。
- bootstrap 中的 endpoints 是音源和服务端地址来源，不允许在 renderer 中硬编码 `gateway.partialy.cn` 等真实地址。
- `gatewaySign.secret` 和 `gatewaySign.as` 只能留在 main 服务内存或安全封装中，不暴露给 renderer。
- 对接 server 的 AES-GCM 加密协议时，应集中封装为 `EncryptedHttpClient`：
  - `x-pm-random`
  - `x-pm-enc-ver`
  - `ts`
  - `nonce`
  - `p`
- 旧版 `x-key: partialy` 这类硬编码必须移除，改为统一验签 client。

## SQLite 规则

SQLite 推荐表：

- `settings`：主题、关闭行为、音量、播放模式、歌词设置
- `search_history`：搜索历史
- `play_history`：播放历史
- `queue_snapshot`：播放队列快照
- `favorites`：收藏歌曲 / 歌单
- `lyrics_cache`：歌词缓存
- `device_profile`：桌面端设备 ID、上报状态
- `migrations`：迁移版本

迁移旧数据时可以读取旧 localStorage / electron-store，但迁移完成后关键数据应写入 SQLite。

## UI 方向

- 主体采用桌面音乐播放器布局：左侧导航、顶部搜索与频道 / 功能入口、中央内容区、底部固定播放器栏。
- 主窗口使用无边框窗口，renderer 提供自定义最小化、最大化 / 还原、关闭按钮；顶部头部整体应尽量可拖动，按钮、搜索框等交互控件必须使用 `app-no-drag`。
- 当前视觉方向参考旧版 `yixi` 的播放器设计和用户提供的酷狗音乐截图：简洁白底、浅蓝强调、轻量边框、圆角卡片、底部播放器工具栏。
- 不做后台管理风格，不做网页 landing page；启动后第一屏就是可用的播放器体验。
- 默认主题为 Pisa Blue，主色为淡蓝 / 天青蓝，整体要有清晰的音乐播放器色彩识别。
- 颜色必须通过 CSS variables / 主题 token 管理；业务组件内允许少量用于推荐卡片的语义色，但不要把主题色写死到核心控件。
- 前端组件要拆分清楚，避免出现上千行大组件；页面入口只做组合，复杂逻辑放 composable、store 或 service facade。

## 清理规则

- 不提交 `yixi/` 原始目录。
- 不提交旧 `.git`、`node_modules`、`out`、`app`、`logs`、打包 exe、blockmap、运行日志。
- 不保留无用 demo、无用调试页、无用图片、重复播放器实现。
- 清理前要确认代码没有被当前迁移步骤引用；删除在工作区内可以执行，但不要批量删除工作区外文件。
- 每次改变项目框架、目录职责或服务边界，都要同步更新本文件。

## 验证要求

- 开发阶段至少运行 TypeScript 检查和构建脚本。
- UI 改动需要启动 Electron 或浏览器预览检查核心页面。
- 涉及播放器时要验证播放、暂停、切歌、进度、音量和失败降级。
- 涉及 SQLite 时要验证首次启动建表、重复启动幂等、读写路径正确。
- 涉及服务端契约时，同步检查 `../server/` 和手机端 `../pm/` 是否受影响。
