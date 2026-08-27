# 刷新登录令牌

使用当前有效的 User Token 延长登录有效期，重新签发一个 7 天有效的新 Token。

- **请求方法**：`POST`
- **请求路径**：`/api/auth/refresh`
- **需要鉴权**：是（`Authorization: Bearer <UserToken>`）
- **加密模式**：端到端加密

---

## 请求参数

### Request Headers

| Header | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `Authorization` | `string` | 是 | 格式为 `Bearer <token>` |

### Request Body (JSON)

无需额外请求体字段，可传空对象 `{}`。

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "登录已刷新",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresAt": 1701209600000,
    "user": {
      "id": "u_abc123456",
      "email": "user@example.com",
      "username": "音乐爱好者",
      "avatar": "default",
      "avatarKey": "default",
      "avatarUrl": "/static/account-avatars/default.jpg",
      "vip": false,
      "vipExpiresAt": null,
      "createdAt": 1700000000000,
      "lastLoginAt": 1700000050000
    }
  },
  "success": true
}
```

### 常见错误响应

```json
{
  "code": 401,
  "msg": "未登录或登录已过期",
  "data": null,
  "success": false
}
```
