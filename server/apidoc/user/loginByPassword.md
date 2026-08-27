# 用户名/邮箱密码登录

使用用户名或注册邮箱搭配密码进行登录，登录成功后更新最近登录时间并返回 User Token。

- **请求方法**：`POST`
- **请求路径**：`/api/auth/login/password`
- **需要鉴权**：否
- **加密模式**：端到端加密

---

## 请求参数

### Request Body (JSON)

| 字段名 | 类型 | 必填 | 说明与限制 |
| :--- | :--- | :--- | :--- |
| `identifier` | `string` | 是 | 账号标识（可输入用户名或邮箱地址） |
| `password` | `string` | 是 | 账号密码 |

### 请求示例

```json
{
  "identifier": "user@example.com",
  "password": "mySecurePassword123"
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
  "msg": "账号或密码错误",
  "data": null,
  "success": false
}
```

- `400 请输入用户名/邮箱和密码`
- `401 账号或密码错误`
