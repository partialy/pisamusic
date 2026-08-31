# 邮箱/手机号验证码注册

使用邮箱收到的注册验证码完成新用户账号注册，注册成功后自动签发 7 天有效的 User Token。

- **请求方法**：`POST`
- **请求路径**：`/api/auth/register`
- **需要鉴权**：否
- **加密模式**：端到端加密

---

## 请求参数

### Request Body (JSON)

| 字段名 | 类型 | 必填 | 说明与限制 |
| :--- | :--- | :--- | :--- |
| `email` | `string` | 与 `phone` 二选一 | 电子邮箱，全局唯一 |
| `phone` | `string` | 与 `email` 二选一 | 11 位大陆手机号，全局唯一 |
| `username` | `string` | 是 | 用户名，2-32 位中文、英文字母、数字、下划线 `_` 或短横线 `-`，全局唯一 |
| `password` | `string` | 是 | 账号密码，长度 6-128 位 |
| `code` | `string` | 是 | 邮箱收到的 `register` 用途验证码 |

### 请求示例

```json
{
  "email": "user@example.com",
  "username": "音乐爱好者",
  "password": "mySecurePassword123",
  "code": "123456"
}
```

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "注册成功",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresAt": 1700604800000,
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
      "lastLoginAt": null
    }
  },
  "success": true
}
```

### 响应字段说明

| 字段名 | 类型 | 说明 |
| :--- | :--- | :--- |
| `token` | `string` | 登录 JWT 凭证，7 天有效，后续请求放入 Header `Authorization: Bearer <token>` |
| `expiresAt` | `number` | 令牌过期时间毫秒时间戳 |
| `user` | `object` | 用户公开信息对象 |
| `user.id` | `string` | 用户唯一 ID |
| `user.email` | `string` | 用户邮箱 |
| `user.username` | `string` | 用户名 |
| `user.avatarKey` | `string` | 头像 Key（默认 `default`） |
| `user.avatarUrl` | `string` | 头像完整/相对访问 URL |
| `user.vip` | `boolean` | 是否为有效 VIP 会员 |
| `user.vipExpiresAt` | `number \| null` | VIP 到期毫秒时间戳，非 VIP 为 `null` |
| `user.createdAt` | `number` | 账号注册毫秒时间戳 |

### 常见错误响应

```json
{
  "code": 400,
  "msg": "验证码错误或已过期",
  "data": null,
  "success": false
}
```

- `400 该邮箱已注册`
- `400 该用户名已被使用`
- `400 验证码错误或已过期`
- `400 密码至少 6 位`
