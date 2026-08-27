# 分页查询官网访问/下载记录摘要

管理后台“官网记录”列表，按类型分页查询日 UV 页面访问记录（`visit`）或安装包下载记录（`download`）摘要。

- **请求方法**：`GET`
- **请求路径**：`/api/admin/website-records`
- **需要鉴权**：是（`Authorization: Bearer <AdminToken>`）
- **加密模式**：端到端加密

---

## 请求参数

### Query Parameters

| 参数名 | 类型 | 必填 | 说明与限制 |
| :--- | :--- | :--- | :--- |
| `type` | `string` | 是 | 记录类型，仅支持 `visit`（访问记录）或 `download`（下载记录） |
| `offset` | `number` | 否 | 分页起始偏移量，默认 0 |
| `limit` | `number` | 否 | 每页条数（默认 20） |

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "type": "visit",
    "items": [
      {
        "id": "rec_123",
        "visitDay": "2026-08-26",
        "path": "/download",
        "language": "zh-CN",
        "timezone": "Asia/Shanghai",
        "screenWidth": 1920,
        "screenHeight": 1080,
        "createdAt": 1700000000000
      }
    ],
    "total": 100,
    "offset": 0,
    "limit": 20
  },
  "success": true
}
```
