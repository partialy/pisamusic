# 发布新版本 (Android / PC)

发布 Android 或 PC 桌面端新版本。发布后会自动更新系统当前发布配置，写入发布历史记录，若指定了七牛安装包 ID 则自动关联并更新文件引用。

- **请求方法**：`POST`
- **请求路径**：`/api/admin/publish-update`
- **需要鉴权**：是（`Authorization: Bearer <AdminToken>`）
- **加密模式**：端到端加密

---

## 请求参数

### Request Headers

| Header | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `Authorization` | `string` | 是 | 格式为 `Bearer <admin_token>` |

### Request Body (JSON)

| 字段名 | 类型 | 必填 | 说明与限制 |
| :--- | :--- | :--- | :--- |
| `platform` | `string` | 是 | 平台：`android` 或 `desktop` |
| `latestVersion` | `string` | 是 | 版本号（如 "2.2.0"） |
| `updateTime` | `string` | 是 | 发布时间（如 "2026-08-27"） |
| `forceUpdate` | `boolean` | 否 | 是否强制更新 |
| `downloadUrl` | `string` | 是 | 下载链接（手填直链或七牛文件服务入口 `/api/config/release-files/:id/download`） |
| `officialUrl` | `string` | 是 | 官网链接 |
| `updateContent` | `string` | 是 | 版本更新日志 |
| `platformLabel` | `string` | 否 | 平台标签（默认 "Android" 或 "PC 桌面版"） |
| `fileSizeText` | `string` | 否 | 文件大小文本说明（如 "45.8 MB"） |
| `available` | `boolean` | 否 | 是否开放下载 |
| `releaseFileId` | `string` | 否 | 关联的统一七牛文件记录 ID（`file_records` 主键） |

### 请求示例

```json
{
  "platform": "desktop",
  "latestVersion": "1.6.0",
  "updateTime": "2026-08-27",
  "forceUpdate": false,
  "downloadUrl": "/api/config/release-files/f_desktop_160/download",
  "officialUrl": "https://pisamusic.partialy.cn",
  "updateContent": "1. 全新界面风格\n2. 优化音质输出",
  "platformLabel": "PC 桌面版",
  "fileSizeText": "92.4 MB",
  "available": true,
  "releaseFileId": "f_desktop_160"
}
```

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "发布成功",
  "data": {
    "id": "hist_new_uuid",
    "platform": "desktop",
    "update": {
      "latestVersion": "1.6.0",
      "updateTime": "2026-08-27",
      "forceUpdate": false,
      "downloadUrl": "/api/config/release-files/f_desktop_160/download",
      "officialUrl": "https://pisamusic.partialy.cn",
      "updateContent": "1. 全新界面风格\n2. 优化音质输出",
      "platformLabel": "PC 桌面版",
      "fileSizeText": "92.4 MB",
      "available": true
    }
  },
  "success": true
}
```
