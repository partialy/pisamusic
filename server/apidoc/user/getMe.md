# 获取当前登录用户信息

根据请求 Header 中的 User Token 获取当前登录账号的完整公开信息，包括 VIP 状态、头像直链等。

- **请求方法**：`GET`
- **请求路径**：`/api/auth/me`
- **需要鉴权**：是（`Authorization: Bearer <UserToken>`）
- **加密模式**：端到端加密

---

## 请求参数

### Request Headers

| Header | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `Authorization` | `string` | 是 | 格式为 `Bearer <token>` |

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
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
  },
  "success": true
}
```

### 响应字段说明

| 字段名 | 类型 | 说明 |
| :--- | :--- | :--- |
| `id` | `string` | 用户 ID |
| `email` | `string` | 用户邮箱 |
| `username` | `string` | 用户名 |
| `avatarKey` | `string` | 用户头像唯一 Key（七牛 key 或 `default`） |
| `avatarUrl` | `string` | 完整的头像访问地址（公开图片 CDN 直链或内置头像路径） |
| `vip` | `boolean` | 是否为有效 VIP（由服务端根据 `vipEnabled` 与 `vipExpiresAt` 实时计算） |
| `vipExpiresAt` | `number \| null` | VIP 到期毫秒时间戳 |
| `createdAt` | `number` | 注册时间戳 |
| `lastLoginAt` | `number \| null` | 最近登录时间戳 |

### 常见错误响应

```json
{
  "code": 401,
  "msg": "未登录或登录已过期",
  "data": null,
  "success": false
}
```
