# 管理员登录

管理后台用户登录，校验管理员账号与密码，签发 7 天有效期的 Admin JWT 凭据。

- **请求方法**：`POST`
- **请求路径**：`/api/admin/login`
- **需要鉴权**：否
- **加密模式**：端到端加密

---

## 请求参数

### Request Body (JSON)

| 字段名 | 类型 | 必填 | 说明与限制 |
| :--- | :--- | :--- | :--- |
| `username` | `string` | 是 | 管理员用户名 |
| `password` | `string` | 是 | 管理员密码 |

### 请求示例

```json
{
  "username": "admin",
  "password": "adminSecretPassword"
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
    "username": "admin"
  },
  "success": true
}
```

### 响应字段说明

| 字段名 | 类型 | 说明 |
| :--- | :--- | :--- |
| `token` | `string` | 管理员 JWT 凭据（7 天有效，后续放入 `Authorization: Bearer <token>`） |
| `username` | `string` | 登录的管理员用户名 |

### 常见错误响应

```json
{
  "code": 401,
  "msg": "用户名或密码错误",
  "data": null,
  "success": false
}
```
