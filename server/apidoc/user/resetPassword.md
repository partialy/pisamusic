# 邮箱/手机号验证码重置密码

在忘记密码等未登录场景下，使用邮箱接收到的 `reset_password` 验证码重置密码。

- **请求方法**：`POST`
- **请求路径**：`/api/auth/password/reset`
- **需要鉴权**：否
- **加密模式**：端到端加密

---

## 请求参数

### Request Body (JSON)

| 字段名 | 类型 | 必填 | 说明与限制 |
| :--- | :--- | :--- | :--- |
| `email` | `string` | 与 `phone` 二选一 | 注册邮箱 |
| `phone` | `string` | 与 `email` 二选一 | 11 位大陆手机号 |
| `code` | `string` | 是 | 邮箱收到的 `reset_password` 用途验证码 |
| `newPassword` | `string` | 是 | 新密码，长度 6-128 位 |

### 请求示例

```json
{
  "email": "user@example.com",
  "code": "889900",
  "newPassword": "newSecretPassword789"
}
```

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "密码已重置",
  "data": {
    "updated": true
  },
  "success": true
}
```

### 常见错误响应

```json
{
  "code": 400,
  "msg": "验证码错误或已过期",
  "data": null,
  "success": false
}
```

- `404 该邮箱尚未注册`
- `400 验证码错误或已过期`
- `400 密码至少 6 位`
