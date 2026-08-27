# 分页查询分享记录

管理后台分页查询所有外链/扫码分享记录，支持按类型（`song` / `playlist`）、分享人用户名和有效性（`valid`）筛选，展示累计访问次数。

- **请求方法**：`GET`
- **请求路径**：`/api/admin/shares`
- **需要鉴权**：是（`Authorization: Bearer <AdminToken>`）
- **加密模式**：端到端加密

---

## 请求参数

### Query Parameters

| 参数名 | 类型 | 必填 | 说明与限制 |
| :--- | :--- | :--- | :--- |
| `type` | `string` | 否 | 分享类型：`song` 或 `playlist` |
| `valid` | `string` | 否 | `true`（有效）/ `false`（已失效）/ `all`（全部） |
| `sharer` | `string` | 否 | 分享人用户名关键词 |
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
    "items": [
      {
        "uuid": "8c919a71-6c39-4d87-9eb5-c26693836101",
        "type": "song",
        "source": "wy",
        "sourceId": "186016",
        "title": "晴天",
        "description": "周杰伦 · 叶惠美",
        "coverUrl": "https://p1.music.126.net/...",
        "sharer": {
          "id": "u_abc123456",
          "username": "音乐爱好者",
          "avatarUrl": "/static/account-avatars/default.jpg"
        },
        "createdAt": 1700000000000,
        "updatedAt": 1700000000000,
        "accessCount": 12,
        "valid": true,
        "invalidatedAt": null
      }
    ],
    "total": 1,
    "offset": 0,
    "limit": 20
  },
  "success": true
}
```
