# 获取版本更新历史列表（分页）

获取各平台历次发布的历史版本记录及对应的安装包下载摘要，按发布创建时间倒序分页返回，适用于官网或客户端更新历史展示页面。

- **请求方法**：`GET`
- **请求路径**：`/api/config/releases/history`
- **需要鉴权**：否
- **加密模式**：强制明文路径
- **限流策略**：单 IP 每 60 秒最多 60 次

---

## 请求参数

### Query 参数

| 字段名 | 类型 | 必填 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| `platform` | `string` | 否 | `all` | 平台筛选：`all`、`pc`、`desktop`、`android`（`pc` 自动映射为 `desktop`） |
| `offset` | `number` | 否 | `0` | 偏移量（从 0 开始） |
| `limit` | `number` | 否 | `10` | 每页条数（1 ~ 50） |

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "list": [
      {
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
      }
    ],
    "total": 12,
    "offset": 0,
    "limit": 10,
    "hasMore": true
  },
  "success": true
}
```
