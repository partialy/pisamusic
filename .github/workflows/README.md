# GitHub Actions 流水线说明

本目录承载 monorepo 的 CI/CD 流水线，按模块路径严格隔离触发条件，避免跨端相互误触发。

---

## 一、Server 自动部署（`deploy-server.yml`）

- **触发条件**：推送至 `main` 分支且改动命中 `server/**`（或部署脚本自身），或手动执行 `workflow_dispatch`。
- **构建产物**：
  - `server/dist/`（基于 `server/tsconfig.build.json`，排除 `*.spec.ts` / `*.case.ts` / `*.test.ts`）
  - `server/web-admin/`（Admin 管理后台）
  - `server/frontend-html/`（静态官网）
  - `server/static/`、`server/discover/`、`package.json`、`pnpm-lock.yaml`、`.env.example`
- **服务器部署拓扑（`/www/wwwroot/node/pm-server`）**：
  - 后端服务与静态站均位于 `/www/wwwroot/node/pm-server`：
    - 后端运行目录：`/www/wwwroot/node/pm-server`（宝塔 Node 脚本 `/www/server/nodejs/vhost/scripts/pm_server.sh`）
    - Admin 后台：`pm.hs.partialy.cn` -> `/www/wwwroot/node/pm-server/web-admin`
    - 官网：`pisamusic.partialy.cn` -> `/www/wwwroot/node/pm-server/frontend-html`
  - 部署脚本 `.github/scripts/deploy-server.sh` 自动保护 `.env`、`data/`、`uploads/`、`.user.ini`、`.well-known/`，部署前自动备份 MySQL/SQLite（保留近 5 份于 `/www/wwwroot/node/pm-server-backups/db/`），保留近 3 版产物快照并在健康检查失败时自动回滚。

### 需配置的 GitHub Secrets（Environment: `ali-deploy`）

在 GitHub 仓库的 `Settings → Environments → ali-deploy`（`deploy-server.yml` 通过 `environment: ali-deploy` 绑定）中配置以下 Secrets：

| Secret 名称 | 说明 | 示例 / 当前值参考 |
| --- | --- | --- |
| `SERVER_HOST` | 目标服务器 IP 或域名 | `114.55.15.1` |
| `SERVER_PORT` | SSH 端口 | `52022` |
| `SERVER_USER` | SSH 登录用户 | `root` |
| `SSH_PRIVATE_KEY` | Ed25519/RSA 私钥全文（建议单独生成部署密钥并写入服务器 `~/.ssh/authorized_keys`） | `-----BEGIN OPENSSH PRIVATE KEY----- ...` |

---

## 二、预留客户端打包流水线兼容规范

后续接入 `pm/`（Android）与 `yixi/`（PC Electron）构建发布流水线时，遵循以下隔离约定：

1. **Android 打包（预留 `build-android.yml`）**
   - 触发路径：`paths: ["pm/**"]`（支持 Tag 如 `android-v*` 或 `workflow_dispatch`）。
   - Runner：`ubuntu-latest` + JDK 17 / Android SDK。
   - 签名 Secrets 预留：`ANDROID_KEYSTORE_BASE64`（对应 `pm210.jks`）、`ANDROID_KEYSTORE_PASSWORD`、`ANDROID_KEY_ALIAS`、`ANDROID_KEY_PASSWORD`。
2. **PC 客户端打包（预留 `build-yixi.yml`）**
   - 触发路径：`paths: ["yixi/**"]`（支持 Tag 如 `yixi-v*` 或 `workflow_dispatch`）。
   - Runner：`windows-latest` + Node 22 + pnpm（输出 NSIS `.exe`、`latest.yml`、`.blockmap`）。
   - 可选上传 GitHub Release 或对接 Admin 发布接口完成自动更新资产入库。
