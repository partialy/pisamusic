# 邮箱/手机号验证码登录

使用邮箱收到的快捷登录验证码完成免密登录。

- **请求方法**：`POST`
- **请求路径**：`/api/auth/login/code`
- **需要鉴权**：否
- **加密模式**：端到端加密

---

## 请求参数

### Request Body (JSON)

| 字段名 | 类型 | 必填 | 说明与限制 |
| :--- | :--- | :--- | :--- |
| `email` | `string` | 与 `phone` 二选一 | 电子邮箱；未注册时校验成功会自动注册 |
| `phone` | `string` | 与 `email` 二选一 | 11 位大陆手机号；未注册时校验成功会自动注册 |
| `code` | `string` | 是 | 邮箱收到的 `login` 用途验证码 |

### 请求示例

```json
{
  "phone": "13800138000",
  "code": "654321"
}
```

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "登录成功",
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
      "lastLoginAt": 1700000060000
    }
  },
  "success": true
}
```

### 常见错误响应

```json
{
  "code": 404,
  "msg": "该邮箱尚未注册",
  "data": null,
  "success": false
}
```

- `400 验证码错误或已过期`
- `400 验证码不能为空`
