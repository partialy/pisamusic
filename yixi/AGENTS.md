# AGENTS.md

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

## 数据规则

- SQLite 保存用户设置、主题设置、搜索历史、播放历史、队列快照等本地数据。
- 关键业务数据不要继续使用 localStorage 作为唯一持久化来源；迁移时可保留兼容读取，但写入目标应转向 SQLite。
- 数据库、日志、运行目录、打包产物不纳入 Git。
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
