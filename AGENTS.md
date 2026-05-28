# AGENTS.md

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
- 跨端或跨服务改动要明确影响面。接口字段、加密规则、配置结构、更新信息、设备上报、公告、反馈等数据契约变更时，需要同步检查 `pm/`、`server/` 和 `yixi/`。
- 官网发布信息支持 Android / PC 双端配置，推荐接口为 `GET /api/config/releases`；旧 `GET /api/config/check-update` 必须保持 Android 更新信息兼容，不要改成多端结构。
- 服务端版本发布支持手填直链或后台上传安装包到七牛云。七牛配置使用 `server/.env` 中的 `QINIU_ACCESS_KEY`、`QINIU_SECRET_KEY`、`QINIU_BUCKET`、`QINIU_UPLOAD_URL`、`QINIU_DOMAIN`、`QINIU_DOMAIN_CDN`；`server/.env` 不提交，提交 `server/.env.example` 作为模板。
- 七牛安装包信息保存在 `release_files` 表，并通过 `update_history.release_file_id` 关联发布历史。上传到七牛的安装包对外下载地址必须使用服务端 `/api/config/release-files/:id/download` 入口，由服务端生成七牛私有空间临时签名 URL 后跳转，不要把七牛对象直链直接下发给客户端。删除发布记录关联安装包时只删除七牛对象与文件状态，不删除历史记录；如果当前 Android / PC 发布配置正引用该文件下载地址，需要同步清空下载地址并关闭下载状态。
- PC 自动升级使用 `electron-updater` 的 generic feed，服务端公开 `/api/config/desktop-updates/win32/x64/latest.yml` 和同目录文件下载入口；自动更新资源存储在 `desktop_update_assets`，由后台上传 `latest.yml`、安装包 EXE 和可选 blockmap 后启用，不要手写 `latest.yml`。
- 手机端与桌面端账号由外层 `server/` 的 `/api/auth/*` 提供服务，支持邮箱验证码注册、用户名/邮箱密码登录、邮箱验证码登录和 7 天 token 刷新。收藏/歌单同步由 `/api/sync/*` 提供服务，使用账号 `Authorization: Bearer <userToken>` 鉴权并按用户隔离数据；旧同步码绑定空间流程已废弃，不要恢复 `/api/sync/spaces*`。
- 账号资料由 `/api/auth/profile*` 提供服务，支持修改昵称、头像 key 和经新邮箱验证码确认后的邮箱；公开用户字段包含 `id`、`username`、`email`、`avatarKey`、`avatarUrl`、`createdAt`。共享头像资源固定放在 `server/static/account-avatars/` 并通过 `/static/account-avatars/*` 下发，不走用户上传。
- 服务端邮箱验证码通过后台“System Status”里的 `email.serviceUrl` 和 `email.provider` 配置发送，默认 `https://gateway.partialy.cn/auth-service/api/send/email`，body 固定为 `{ provider, type: "verify_code", code, to }`；默认 provider 为 `aliyun`，后台可维护 provider 列表，默认包含 `aliyun / 阿里云` 和 `resend / Resend`；网关验签复用 bootstrap `gatewaySign` 配置，签名算法与桌面端 `gatewaySigner` 保持一致。
- 手机端和桌面端启动时如果外层服务不可用、没网或后台关闭 `appAvailable`，应进入本地模式并在主界面给非阻塞提示；设备被封禁仍然阻止进入。
- 桌面端设备上报使用服务端 `desktop_device_info` 表和 `/api/device/desktop/report`，不要复用 Android 的 `device_info` 表；后台通过 `/api/admin/desktop-device/*` 管理 PC 设备。
- 服务端历史 JSON 导入 SQLite 迁移已结束，不要恢复 `jsonImport.ts` 或启动时读取 `server/data/*.json` 自动导入数据库的逻辑。
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
- 启动构建产物：`pnpm --dir server start`
- 默认端口：`53380`
- 官网双端发布接口：`/api/config/releases` 返回 Android 与 PC 当前发布信息；`/api/config/check-update` 保留为 Android 旧更新接口。
- 动态配置模块：公开读取接口为 `GET /api/config/get?id=xxx`，返回 `{ id, type, content }`；后台管理接口挂载在 `GET/POST/PUT/DELETE /api/admin/dynamic-configs`。
- 动态配置类型：固定为 `html`、`string`、`number`、`url`，数据存储在 SQLite `dynamic_configs` 表；新增实现优先放独立 store / route / admin 组件文件，不要继续堆进通用大文件。
- 七牛安装包上传：管理后台通过 `/api/admin/release-files/upload-token` 获取上传凭证，客户端直传七牛后调用 `/api/admin/release-files/complete` 登记文件，再发布版本；删除历史安装包使用 `/api/admin/update-history/:id/release-file`。
- 账号接口：`/api/auth/email-code` 发送注册/登录/重置密码邮箱验证码，其中重置密码用途为 `reset_password`；`/api/auth/register` 注册；`/api/auth/login/password` 支持用户名/邮箱+密码登录；`/api/auth/login/code` 仅支持邮箱验证码登录；`/api/auth/password/change` 登录态修改密码；`/api/auth/password/reset` 邮箱验证码重置密码；`/api/auth/refresh` 刷新 7 天 token；`/api/auth/me` 获取当前账号；`/api/auth/profile/email-code` 和 `PATCH /api/auth/profile` 修改资料。
- 同步接口：`/api/sync/changes` 通过账号 token 拉取/推送增量，DTO 以 PC 端 `Song` / `CommonPlaylist` 字段为准；旧同步码创建、加入、重置和解绑设备接口已移除。

管理后台与官网：

- 管理后台目录：`server/admin/`
- 官网目录：`server/frontend/`
- 以各自 `package.json` 的脚本为准；如果脚本或部署方式变化，需要同步更新本文档。

PC 桌面端 App：

- 目录：`yixi/`
- 技术栈：Electron + Vue 3 + TypeScript + Naive UI + Pinia + howler + electron-vite + electron-builder。
- 开发：`pnpm --dir yixi dev`
- 类型检查 / 构建：优先使用 `yixi/package.json` 中现有脚本，例如 `pnpm --dir yixi build:t`。
- Windows 打包：`pnpm --dir yixi build:win`

## 验证要求

- Android 改动优先运行对应 Gradle 构建或单元测试；UI 流程需要真机或模拟器手动验证。
- 服务端改动至少运行 TypeScript 构建，并按影响面检查相关接口。
- 管理后台、官网或 PC 桌面端前端改动需要运行对应构建；涉及视觉或交互时要做浏览器或 Electron 窗口检查。
- 跨端接口改动要做最小联调验证，确保旧字段兼容或迁移路径清晰。
