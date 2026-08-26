# Server 仪表盘与官网访问分析运维说明

本文档说明 PisaMusic 服务端（`server/`）统计仪表盘、官网日访问（UV）统计、官网下载重定向与设备日活统计的指标口径、数据模型、隐私边界及运维规范。

---

## 1. 指标口径与设计边界

### 1.1 官网日访问量（日 UV）
- **定义**：按 `Asia/Shanghai` 自然日去重的官网独立访客数（UV）。
- **设备近似口径**：Web 端通过浏览器 `localStorage` 持久化一个 UUID 格式的访客标识（`pm_site_visitor_id`）。同一浏览器资料目录在同一自然日内最多计 1 次访问。
- **边界说明**：同一设备若使用不同浏览器、无痕/隐私模式，或清除站点数据后再次访问，会被视为新的访客 ID。
- **防重保障**：前端 `localStorage` 仅用于减少冗余网络请求；服务端数据库在 `(visit_day, visitor_hash)` 上建立了唯一索引，是日 UV 最终去重的权威保障。页面刷新、React StrictMode 重复 effect 不会重复计数。

### 1.2 官网下载量
- **定义**：用户在官网点击 Android 或 PC 下载按钮，进入服务端 `/api/config/download/:platform` 并成功跳转到目标下载地址（七牛临时签名私有链接或手填直链）的次数。
- **边界说明**：
  - PC 客户端自动升级过程中的 `latest.yml`、blockmap 或增量包下载**不计入**官网下载趋势。
  - 下载未开放或配置错误（404 / 500）时不写入下载记录。

### 1.3 设备日活
- **定义**：在某一上海自然日内至少成功上报过一次的 Android 或 PC 设备。
- **记录机制**：在设备上报接口（Android `/api/device/report`、PC `/api/device/desktop/report`）完成后，向 `device_daily_activity` 表按 `(activity_day, device_type, device_id)` 进行 upsert，记录首次与末次活跃时间戳及最新 App 版本。

### 1.4 7 日下载转化率
- **计算公式**：`7日官网下载总数 / 7日官网访客 UV 总数 × 100%`。
- 若 7 日内无官网访客（访客数为 0），转化率显示为 `0%`。

---

## 2. 数据存储与保留期策略

### 2.1 统计数据表
所有原始统计事件存储于服务端 SQLite 统一数据库 `pm.db`：
1. `site_visit_records`：官网日访问记录（访客 hash、规范化 IP、来源、User-Agent、基础屏幕信息等）。
2. `download_records`：官网下载重定向事件（平台、版本、关联文件 ID、规范化 IP 等）。
3. `device_daily_activity`：设备日活跃记录（日期、设备类型、设备 ID、版本、最后活跃时间）。

> **注意**：统计表对设备表与文件表不设置外键约束，以确保当后台删除某台设备或某个发布文件时，历史统计聚合趋势不受影响。

### 2.2 数据保留与每日清理门禁
- **默认保留期**：180 天。
- **可配置范围**：通过环境变量 `ANALYTICS_RETENTION_DAYS` 配置，允许范围为 `90` 至 `730` 天。
- **清理门禁**：在事件写入时检查模块级日期标记，每个上海自然日最多触发一次清理，执行：
  ```sql
  DELETE FROM site_visit_records WHERE created_at < ?;
  DELETE FROM download_records WHERE created_at < ?;
  DELETE FROM device_daily_activity WHERE last_seen_at < ?;
  ```
- **安全保障**：清理仅限于统计事件表，绝不触碰用户、设备、发布、文件记录或业务日志；清理失败仅记录 warning，不阻断正常业务请求。

---

## 3. 隐私与数据安全

1. **访客标识脱敏（Salted Hash）**：
   - 访客 ID 进入数据库前，必须使用 `SHA-256(ANALYTICS_HASH_SALT + visitorId)` 计算哈希值，数据库只存 64 位十六进制 hash，不存储 localStorage 原始 UUID。
   - 生产环境部署必须在 `server/.env` 中配置随机且不可预测的 `ANALYTICS_HASH_SALT`。
   - **运维注意**：若修改 `ANALYTICS_HASH_SALT`，会导致同一访客哈希值变化，被视为新访客。
2. **API 聚合隔离**：
   - 管理后台仪表盘接口 `GET /api/admin/dashboard` 仅返回聚合统计指标、日期序列和分布数据，严禁在响应中暴露任何 IP 地址、访客哈希或明细 User-Agent 字符串。
3. **明文白名单安全**：
   - 公开上报路由 `POST /api/analytics/site-visit` 与下载路由 `GET /api/config/download/*` 设为强制明文路由，因为未登录官网不持有系统 AES 密钥。
   - 管理端仪表盘接口 `/api/admin/dashboard` 必须经过管理员 JWT 鉴权与系统 AES-GCM 加密，不得加入明文白名单。
4. **隐私政策合规**：
   - 运营人员应在后台“内容与协议”管理中，于现有《隐私政策》中如实披露网站使用本地存储标识、IP 地址与基础终端信息用于统计与安全防护的目的及保留期限；服务端代码不得擅自覆盖运营人员已保存的协议正文。

---

## 4. 环境变量配置示例

在 `server/.env` 中配置：
```dotenv
# 官网统计访客 ID 哈希盐（生产环境务必设置高强度独立随机字符串）
ANALYTICS_HASH_SALT=your_custom_secure_hash_salt_here

# 原始统计事件保留天数（允许 90-730，默认 180）
ANALYTICS_RETENTION_DAYS=180
```
