# Task 4：实时通信、头像与独立更新恢复链路报告

## 实现

- 一起听 Socket.IO 改用服务发现快照的 `realtimeBaseUrl`，账号鉴权和 WebSocket transport 规则保持不变。
- 一起听成员头像与默认头像的相对路径统一基于发现快照的 `apiBaseUrl` 解析；外部 HTTP(S)、`data:`、`blob:` 地址保持原样。
- 新增 `resolveUpdaterFeedCandidates()`：bootstrap 更新源优先，与服务发现更新源合并、标准化、去重，并拒绝非 HTTPS 地址。
- 自动更新移除静态业务域名和 API 本地模式禁用条件。手动检查与启动检查共用候选 feed 回退循环；单个源失败会尝试下一个，全部失败后才写入最终错误状态。
- 候选源循环期间的 `autoUpdater` error 事件仅记录日志，避免提前将 UI 固定为错误状态。
- 审查修复：手动 IPC 与启动定时器通过模块级 in-flight Promise 复用同一条更新检查链，检查中的后续请求仅等待结果，不会并发改写 feed、manual 状态或提前结束候选回退保护。
- 审查修复：准备候选源、HTTPS 校验和检查请求的异常均由同一最终错误处理落为 `status=error`；更新关闭时先返回 disabled 状态，不解析可能无效的 bootstrap feed。

## 验证结果

- `pnpm --dir yixi test:service-discovery`：通过（4 files / 22 tests）。
- `pnpm --dir yixi build:t`：通过（`vue-tsc -b` 与 `electron-vite build`）。
- `git diff --check`：通过；仅输出了用户既有 Android 文件的 CRLF 提示。

## 变更文件

- `yixi/electron/listenTogether/listenTogetherSocketClient.ts`
- `yixi/electron/listenTogether/listenTogetherAvatar.ts`
- `yixi/electron/updater/updaterConfig.ts`
- `yixi/electron/updater/updaterConfig.test.ts`
- `yixi/electron/updater/updaterService.ts`
- `.superpowers/sdd/task-4-report.md`

## 提交

- `功能：实时通信和更新接入服务发现`（本次提交）

## 自审

- 已确认更新服务不再包含旧业务更新域名、`FALLBACK_FEED_BASE_URL` 或 `getStartupServiceState()`。
- 已确认更新候选顺序为 bootstrap 配置在前、服务发现候选在后，尾部斜杠规范化后去重。
- 已确认 `autoUpdater.checkForUpdates()` 只在候选回退函数内调用，手动与启动入口均复用该链路。
- 已确认 in-flight Promise 在唯一检查结束后才清理，后续手动/启动请求不会并发进入 `setFeedURL()` 或 `checkForUpdates()`。
- 已确认非法更新源异常与候选耗尽均不会导致手动 IPC reject，而是统一更新最终错误状态。
- 未修改或暂存用户既有的 `pm/` 变更；未启动应用或执行安装包打包。

## Concerns

- 未在真实 Windows 已安装包环境执行更新服务器切换验证；已完成纯函数、TypeScript 和 Electron 构建验证。
