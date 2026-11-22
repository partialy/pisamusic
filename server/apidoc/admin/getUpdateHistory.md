# 读取后台发布更新历史（分页）

管理后台分页查询版本发布历史列表，支持按平台筛选，按发布创建时间倒序返回，包含当前版本标识与关联的七牛安装包记录。

- **请求方法**：`GET`
- **请求路径**：`/api/admin/update-history`
- **需要鉴权**：是（`Authorization: Bearer <AdminToken>`）
- **加密模式**：端到端加密

---

## 请求参数

### Query 参数

| 字段名 | 类型 | 必填 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| `platform` | `string` | 否 | `all` | 平台筛选：`all`、`pc`、`desktop`、`android` |
| `offset` | `number` | 否 | `0` | 偏移量（从 0 开始） |
| `limit` | `number` | 否 | `15` | 每页条数（1 ~ 100） |

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
        "version": "v2.0.2",
        "updateTime": "2026-11-22 10:00",
        "forceUpdate": false,
        "downloadUrl": "/api/config/release-files/f_2/download",
        "officialUrl": "https://pisamusic.partialy.cn",
        "updateContent": "更新说明",
        "createdAt": 1732240800000,
        "isCurrent": true,
        "releaseFileId": "f_2",
        "releaseFile": {
          "id": "f_2",
          "fileName": "PisaMusic-Setup-2.0.2.exe",
          "fileSize": 93532160,
          "mimeType": "application/x-msdownload",
          "status": "uploaded"
        }
      }
    ],
    "total": 12,
    "offset": 0,
    "limit": 15,
    "hasMore": false
  },
  "success": true
}
```
