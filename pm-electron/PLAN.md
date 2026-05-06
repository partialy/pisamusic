# PisaMusic Desktop 计划书

## 目标

`pm-electron` 是 PisaMusic 的桌面端 App。它继承手机端 `pm` 的三音源聚合能力，但不做手机端的简单放大版；桌面端优先提供更适合 PC 的搜索、播放、队列、托盘和本地数据体验。

参考项目为根目录 `../SPlayer/`。参考范围仅限产品体验、工程边界和模块组织思路，不直接复制代码、资源或具体实现。

## 已定技术栈

- Electron + React + TypeScript
- electron-vite
- shadcn/ui + Tailwind CSS + Radix UI + lucide-react
- howler
- SQLite，优先使用 main 进程封装访问
- electron-builder
- Windows 优先，后续兼容 macOS / Linux

## 首版功能

- 三音源聚合搜索：KG / WY / KW。
- 搜索结果按音源分组展示，交互参考手机端 `pm`。
- 播放歌曲、暂停、上一首、下一首、进度、音量、播放队列。
- 播放地址解析失败时提示“播放失败，可尝试切换其他音源”，然后自动下一曲。
- 歌词先做获取能力，并写入 store，首版暂不展示。
- SQLite 保存播放历史、搜索历史、队列、用户设置等本地数据。
- 复用外层 `server` 的配置、公告、反馈接口。
- 配置每次从服务端拉取，不持久化到 SQLite。
- 托盘：显示 / 隐藏窗口、播放 / 暂停、上一首、下一首、退出。
- 默认主题使用 Pisa Blue，不使用 shadcn/ui 默认黑白中性色风格。
- 预留 App 内主题配色修改能力，后续可在设置中调整主题色、浅色 / 深色模式和部分外观参数。

首版不做：

- 登录 / Cookie 导入。
- 下载、本地音乐扫描。
- 歌词展示页。
- 自动更新。
- 全局快捷键、媒体键、迷你播放器。
- 手机端功能的完全对齐。

## 模块边界

建议目录：

```text
pm-electron/
  electron/
    main/
      index.ts
      windows/
      tray/
      ipc/
      db/
      services/
      player/
      utils/
    preload/
      index.ts
  src/
    app/
    components/
    features/
      search/
      player/
      queue/
      settings/
      announcements/
      feedback/
    hooks/
    lib/
    stores/
    styles/
    types/
  shared/
    ipc/
    music/
    system/
```

职责：

- `electron/main`：窗口、托盘、SQLite、服务端请求、音源请求、播放地址解析、日志。
- `electron/preload`：暴露最小安全 IPC API。
- `src`：React UI、shadcn 组件组合、页面和 renderer 状态。
- `shared`：跨进程类型、IPC contract、音源统一模型、系统 API 类型。

## 音源策略

- 统一 `MusicSource`：`kg`、`wy`、`kw`。
- 统一 `TrackSearchResult`，字段覆盖歌曲名、歌手、专辑、封面、时长、来源、源内 ID、可选音质信息。
- 搜索结果按音源分组，不做首版跨源去重。
- 播放地址解析封装为 source service，renderer 不直接关心每个音源的请求细节。
- 播放失败不自动切换其他音源，只提示并自动下一曲。

## 播放器策略

- howler 作为播放器核心。
- 播放器封装为独立 service / store，不直接散在组件里。
- 远程歌曲优先按流式播放场景设计，避免后续从普通 Audio 迁移。
- 首版状态包括：当前歌曲、播放中、加载中、错误、进度、时长、音量、队列、当前下标。
- 歌词获取结果进入 store，后续歌词 UI 直接消费该状态。

## 数据策略

SQLite 存储：

- 用户设置。
- 最近搜索。
- 播放历史。
- 播放队列快照。
- 歌词缓存可后续加入，首版可先只存内存 store。

不存储：

- 服务端配置。配置每次启动或需要时重新拉取。
- 公告内容长期缓存。可以短期内存缓存，但不作为持久化数据。

## 服务端复用

复用 `../server/`：

- 配置。
- 公告。
- 反馈。

独立实现：

- 桌面端本地设置。
- 桌面端播放历史。
- 桌面端队列。
- 后续桌面端设备信息。
- 后续桌面端更新逻辑。

## UI 规划

主界面：

- 左侧导航：搜索、播放队列、历史、设置。
- 顶部：搜索框、音源筛选、基础窗口状态。
- 中央：搜索结果、空状态、错误状态、加载状态。
- 右侧：当前队列或歌曲详情，首版可作为可收起区域。
- 底部：播放控制栏，包含封面、歌名、歌手、播放控制、进度、音量。

视觉原则：

- 参考主流音乐播放器与 SPlayer 的优秀布局，不复制其界面。
- PisaMusic 自有风格：干净、轻盈、桌面感、适合长时间使用。
- 不做后台管理 UI，不做网页式首页。
- shadcn/ui 负责基础组件，Tailwind 负责整体视觉系统。
- shadcn/ui 只作为组件基础，不沿用默认黑白主题；所有核心组件必须接入 PisaMusic 的主题 token。

## 主题系统

默认主题：Pisa Blue。

基础方向：

- 主色使用淡蓝 / 天青蓝，而不是黑色。
- 背景使用冷白、浅蓝灰和低饱和蓝色面板。
- 深色模式使用深海蓝 / 墨蓝，不使用纯黑。
- 播放进度、选中导航、主按钮、Slider、焦点环使用主题色。
- 危险、成功、警告等语义色独立定义，不直接复用主色。

建议初始色板：

```text
primary: #5AB8FF
primaryActive: #1686D9
background: #F6FBFF
surface: #FFFFFF
surfaceSoft: #EAF6FF
text: #102033
mutedText: #6B7C8F
border: #D8E8F5
danger: #EF5A72
success: #35C58A
```

实现规则：

- shadcn/ui 初始化时启用 CSS variables。
- 全局样式提供 `:root` 和 `.dark` 两套基础 token。
- 主题 token 至少覆盖 `background`、`foreground`、`card`、`popover`、`primary`、`secondary`、`muted`、`accent`、`destructive`、`border`、`input`、`ring`、`sidebar`、`chart`。
- 不在业务组件里写死大面积颜色；业务组件优先使用语义 token 或封装后的主题工具。
- 播放器专属颜色使用独立 token，例如 `--player-accent`、`--player-progress`、`--player-surface`，避免后续主题修改影响不可控。
- 后续 App 内主题修改通过写入 CSS 变量实现，renderer 启动时从设置读取并应用到 `document.documentElement`。
- 用户主题配置存入 SQLite 的 settings 表，不与服务端配置混用。
- 主题配置结构需要版本号，方便后续迁移。

建议主题配置类型：

```ts
type ThemeMode = "light" | "dark" | "system";

interface AppThemeSettings {
  version: 1;
  mode: ThemeMode;
  preset: "pisa-blue" | "custom";
  primaryColor: string;
  radius: number;
  useAlbumAccent: boolean;
}
```

预留能力：

- 主题预设：Pisa Blue、后续可扩展 Mint、Violet、Rose 等。
- 自定义主题色：用户选择主色后生成相关 token。
- 跟随专辑封面取色：首版可只预留 `useAlbumAccent` 字段，不实现自动取色。
- 浅色 / 深色 / 跟随系统：首版骨架应保留 mode 字段和切换入口。

## 阶段计划

阶段 1：项目骨架

- 初始化 electron-vite + React + TypeScript。
- 接入 Tailwind、shadcn/ui、lucide-react。
- 建立 Pisa Blue 主题 token、浅色 / 深色基础变量和主题设置类型。
- 配置 electron-builder。
- 建立 main / preload / renderer / shared 边界。
- 建立基础 IPC contract。

阶段 2：基础壳和 UI

- 实现窗口、应用壳、左侧导航、底部播放栏。
- 实现搜索页静态结构和音源分组列表。
- 实现播放队列面板。
- 建立全局 store。

阶段 3：服务和数据

- 建立 SQLite 初始化和 migrations。
- 实现设置、搜索历史、播放历史、队列快照。
- 实现主题设置读取、保存和 renderer 运行时应用。
- 接入 server 配置、公告、反馈接口。
- 建立三音源 service 抽象。

阶段 4：搜索和播放

- 实现 KG / WY / KW 聚合搜索。
- 实现播放地址解析。
- 接入 howler 播放控制。
- 实现播放失败提示和自动下一曲。
- 获取歌词并写入 store。

阶段 5：桌面能力和打包

- 实现系统托盘菜单。
- 完成 Windows 打包配置。
- 补齐基础日志和错误提示。
- 做首版端到端验证。

## 待后续扩展

- 登录 / Cookie 导入。
- 歌词展示和桌面歌词。
- 下载和本地音乐扫描。
- 自动更新。
- 全局快捷键和媒体键。
- 迷你播放器。
- 更多主题预设、专辑封面取色和高级外观设置。
- 跨平台打包细节。
