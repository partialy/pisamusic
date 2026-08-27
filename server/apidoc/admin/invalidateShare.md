# 标记指定分享失效

管理后台将违规或过期的单条分享记录标记为失效（`valid = false`）。标记后保留原始 JSON 历史与访问计数，但公开接口 `/api/shares/public/:uuid` 将无法再访问并返回 404。

- **请求方法**：`PATCH`
- **请求路径**：`/api/admin/shares/:uuid/invalid`
- **需要鉴权**：是（`Authorization: Bearer <AdminToken>`）
- **加密模式**：端到端加密

---

## 请求参数

### Path Parameters

| 参数名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `uuid` | `string` | 是 | 分享记录 UUID |

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "Share record invalidated",
  "data": {
    "uuid": "8c919a71-6c39-4d87-9eb5-c26693836101",
    "type": "song",
    "source": "wy",
    "sourceId": "186016",
    "title": "晴天",
    "valid": false,
    "invalidatedAt": 1700000060000
  },
  "success": true
}
```

### 常见错误响应

- `404 Share record not found`
- `400 Invalid share uuid`
