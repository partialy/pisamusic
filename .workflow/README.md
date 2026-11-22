# Gitee Go 流水线说明

本目录承载面向 Gitee Go 的 CI/CD 流水线配置（`.workflow/*.yml`），与仓库内 `deploy/` 共享部署脚本，按模块路径严格隔离触发条件，方便后续独立扩展 Android（`pm/`）与 PC（`yixi/`）流水线。

---

## 一、Server 自动部署（`.workflow/deploy-server.yml`）

- **触发条件**：推送至 `main` 分支，且变更路径命中 `server/.*`、`.workflow/deploy-server.yml` 或 `deploy/deploy-server.sh`。
- **构建逻辑**：
  1. 若运行镜像低于 Node 22，自动从 `npmmirror` 下载安装 Node `v22.22.3`；
  2. 通过 `pnpm` + `npmmirror` 安装依赖并运行 `pnpm --dir server build:release`（`dist/` 排除测试文件 + `admin` Vite 构建）；
  3. 打包纯净发布包并通过 `deploy/deploy-server.sh` 自动完成数据库前置备份、按需依赖更新、`rsync` 原子替换（保护 `.env`、`data/`、`uploads/`、`.user.ini`、`.well-known/`）、宝塔 `pm_server.sh` 重启与健康探活回滚。

### 需在 Gitee Go 流水线配置的环境变量

| 变量名 | 说明 |
| --- | --- |
| `SERVER_HOST` | 目标服务器 IP（如 `114.55.15.1`） |
| `SERVER_PORT` | SSH 端口（如 `52022`） |
| `SERVER_USER` | SSH 登录用户（如 `root`） |
| `SSH_PRIVATE_KEY` | 部署私钥原文（建议勾选私密/隐藏） |

---

## 二、预留客户端流水线扩展结构

后续接入客户端构建流水线时，在 `.workflow/` 下按模块独立增加配置文件即可：
- **Android 打包（预留 `.workflow/build-android.yml`）**：路径匹配 `pm/.*`（或 Tag `android-v.*`），注入 `pm210.jks` 签名环境变量，产出 APK/AAB 制品。
- **PC 客户端打包（预留 `.workflow/build-yixi.yml`）**：路径匹配 `yixi/.*`（或 Tag `yixi-v.*`），构建输出 NSIS `.exe`、`latest.yml` 与 `.blockmap` 制品。
