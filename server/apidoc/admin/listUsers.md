# 分页查询用户列表

管理后台分页查询所有注册用户列表，支持按用户名/邮箱模糊搜索，返回用户公开信息、VIP 状态及最近登录时间。

- **请求方法**：`GET`
- **请求路径**：`/api/admin/users`
- **需要鉴权**：是（`Authorization: Bearer <AdminToken>`）
- **加密模式**：端到端加密

---

## 请求参数

### Query Parameters

| 参数名 | 类型 | 必填 | 说明与限制 |
| :--- | :--- | :--- | :--- |
| `keyword` | `string` | 否 | 用户名或邮箱搜索关键词 |
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
    "users": [
      {
        "id": "u_abc123456",
        "email": "user@example.com",
        "username": "音乐爱好者",
        "avatar": "default",
        "avatarKey": "default",
        "avatarUrl": "/static/account-avatars/default.jpg",
        "vip": true,
        "vipExpiresAt": 1735689600000,
        "createdAt": 1700000000000,
        "lastLoginAt": 1700000050000
      }
    ],
    "total": 1,
    "offset": 0,
    "limit": 20
  },
  "success": true
}
```
