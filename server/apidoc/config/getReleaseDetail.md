# 获取指定版本详细信息

按平台与版本号查询单个发布版本的完整更新日志与安装包下载信息；当 `version=latest` 时返回目标平台当前最新生效版本。

- **请求方法**：`GET`
- **请求路径**：`/api/config/releases/detail`
- **需要鉴权**：否
- **加密模式**：强制明文路径
- **限流策略**：单 IP 每 60 秒最多 60 次

---

## 请求参数

### Query 参数

| 字段名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `platform` | `string` | 是 | 目标平台：`pc`、`desktop` 或 `android`（`pc` 自动映射为 `desktop`） |
| `version` | `string` | 是 | 版本号（如 `v1.0.0` 或 `1.0.0`，忽略前导 `v` 容错匹配），传 `latest` 返回当前最新版 |

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "id": "hist_1",
    "platform": "desktop",
    "platformLabel": "PC 版",
    "version": "v2.0.2",
    "updateTime": "2026-11-22 10:00",
    "createdAt": 1732240800000,
    "forceUpdate": false,
    "downloadUrl": "https://pisamusic.partialy.cn/api/config/release-files/f_1/download",
    "officialUrl": "https://pisamusic.partialy.cn",
    "updateContent": "1. 优化界面交互\n2. 修复已知问题",
    "fileSizeText": "89.2MB",
    "available": true,
    "isCurrent": true,
    "releaseFile": {
      "id": "f_1",
      "fileName": "PisaMusic-Setup-2.0.2.exe",
      "fileSize": 93532160,
      "mimeType": "application/x-msdownload",
      "downloadUrl": "https://pisamusic.partialy.cn/api/config/release-files/f_1/download",
      "status": "uploaded"
    }
  },
  "success": true
}
```

### 错误说明

- `400`：`platform` 非法或 `version` 缺失。
- `404`：目标平台无版本记录或未找到对应版本号。
