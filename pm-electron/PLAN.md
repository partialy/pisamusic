# PisaMusic Desktop 整体改造计划

## 目标

`pm-electron` 改为以旧版 `yixi/` 为产品底座，保留它已经形成的播放器体验、歌词能力、队列、音源封装和桌面交互，同时按当前项目标准重整工程结构、安全边界、SQLite 数据层、后端配置、加密和验签。

这不是简单复制旧代码，而是把旧版可用资产正规化为 PisaMusic 桌面端。

## 基本决策

- 桌面端底座改为：Electron + Vue 3 + TypeScript + Naive UI + Pinia + howler。
- `yixi/` 只作为迁移源目录，不直接提交到 monorepo。
- `pm-electron/` 是最终桌面端工程目录。
- renderer 不再直接访问真实后端、音源网关、SQLite、文件系统或 Node 能力。
- main 进程负责服务端配置、加密请求、验签、音源请求、SQLite、窗口、托盘和系统能力。
- preload 只暴露类型安全的 `window.pisa` API。
- 服务端配置每次启动拉取；本地 SQLite 只保存桌面端用户数据和必要的短期状态，不把服务端配置当长期真源持久化。

## 最终目录方向

```text
pm-electron/
  electron/
    main/
      index.ts
      windows/
      tray/
      ipc/
      db/
      repositories/
      services/
        config/
        music/
        library/
        settings/
        feedback/
        device/
      security/
      utils/
    preload/
      index.ts
  shared/
    ipc.ts
    music.ts
    settings.ts
    system.ts
    server.ts
  src/
    app/
    layouts/
    pages/
    features/
      player/
      search/
      playlist/
      lyric/
      settings/
      feedback/
    stores/
    services/
    components/
    icons/
    assets/
    styles/
```

## 分阶段计划

### 1. 迁移准备

- 把 `yixi/` 加入根 `.gitignore`，避免旧项目 `.git`、`node_modules`、`out`、`app`、日志和运行数据污染主仓库。
- 用本文档替代旧的 React 版计划，明确桌面端新方向。
- 保留当前 React 版提交历史作为可回滚点。
- 更新 `pm-electron/AGENTS.md`，说明桌面端将从 React/shadcn 转为 Vue/Naive UI 底座。

### 2. 底座切换

- 清空或替换 `pm-electron/` 中 React/shadcn 相关实现。
- 从 `yixi/` 迁入源码、Electron 配置、Vue 入口、资源、图标和必要类型。
- 不迁入 `node_modules`、`out`、`app`、`logs`、旧 `.git`、旧打包产物。
- 统一包管理器为 `pnpm`。
- 修复启动、构建、类型检查和 Windows 打包配置。

### 3. 工程结构重整

- 拆分旧 `electron/main.ts`，按窗口、托盘、IPC、服务、数据库、安全模块分层。
- 拆分旧 `src/components` 和 `src/views`，按 feature / page / layout 归类。
- 修复乱码文案，所有用户可见中文恢复为正常 UTF-8。
- 清理旧 demo、debugger、无用图片、无用工具函数、重复播放器实现。
- 保留旧版 UI 中成熟的播放器、歌词、搜索、队列体验。

### 4. IPC 和安全边界

- 建立 `shared/ipc.ts` 作为唯一 IPC contract。
- preload 暴露 `window.pisa`，废弃旧 `window.electronAPI` 或做临时兼容层。
- renderer 只能通过 `window.pisa.*` 调用系统能力。
- 移除 renderer 中直接使用真实 baseURL、`x-key`、验签 secret、Node API 的代码。
- Electron 默认关闭 `nodeIntegration`，启用 `contextIsolation`。
- 对桌面歌词等特殊窗口单独评估权限，不复用宽松默认配置。

### 5. SQLite 数据层

- 在 main 进程接入 SQLite。
- 建立 migrations，保证重复启动幂等。
- 建立 repositories：
  - settings
  - search history
  - play history
  - queue snapshot
  - favorites
  - lyric cache
  - device profile
- 迁移旧 localStorage / electron-store 数据到 SQLite，迁移后 renderer 不再直接持久化关键数据。

### 6. 服务端配置、加密和验签

- main 启动时拉取 `server` 的 `/api/config/bootstrap`、公告、更新信息。
- 实现 `EncryptedHttpClient`，对接 server 当前 AES-GCM 协议：
  - `x-pm-random`
  - `x-pm-enc-ver`
  - `ts`
  - `nonce`
  - `p`
- 实现 `GatewaySignClient`，从 bootstrap 读取 `gatewaySign.secret` 和 `gatewaySign.as`。
- 替换旧 renderer 中的 `x-key: partialy` 和硬编码 `gateway.partialy.cn`。
- 所有音源网关 baseURL 从服务端 bootstrap endpoints 获取。
- 服务端配置不作为长期真源写入 SQLite；最多保留短期 last-known fallback，并标注来源和过期时间。

### 7. 音源服务重整

- 把 KG / WY / KW 搜索、播放地址解析、歌词获取移动到 main service。
- 建立统一类型：
  - `MusicSource = "kg" | "wy" | "kw"`
  - `TrackSearchResult`
  - `PlayUrlResult`
  - `LyricResult`
- renderer 不关心每个音源的请求参数，只消费统一结果。
- 播放失败统一提示“播放失败，可尝试切换其他音源”，然后自动下一曲。

### 8. 播放器和 UI 收束

- 保留 howler 在 renderer 的播放引擎。
- 保留旧版播放器栏、歌词页、桌面歌词、播放模式等可用设计。
- 播放状态和队列用 Pinia 管理，持久化通过 IPC 写 SQLite。
- 主布局参考旧版和用户截图，走简洁音乐播放器风格。
- 设置页接入主题、关闭行为、歌词配置、反馈入口。

### 9. 验证与提交

- 每个阶段保持小提交。
- 每次结构性变更后运行：
  - `pnpm typecheck`
  - `pnpm build`
  - Electron 启动预览
- 涉及 SQLite 时验证首次启动建表和重复启动。
- 涉及服务端时验证 bootstrap、公告、反馈、设备上报。
- 涉及播放时验证搜索、解析、播放、暂停、上一首、下一首、进度、音量、失败降级。

## 近期执行清单

1. 提交迁移准备文档和 `.gitignore`。
2. 更新 `pm-electron/AGENTS.md` 为 Vue/Naive UI 迁移方向。
3. 替换 `pm-electron` 底座为清理后的 `yixi` 源码。
4. 跑通 `pnpm install`、`pnpm typecheck`、`pnpm build`。
5. 拆分 main 进程，建立新的 IPC contract。
6. 接入 SQLite 并迁移旧持久化点。
7. 接入 server bootstrap、加密 client 和验签 client。
