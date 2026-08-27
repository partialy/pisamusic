# 发送换绑新邮箱验证码

在用户登录状态下，向准备换绑的**新邮箱**发送验证码，用于后续资料更新时确认新邮箱归属。

- **请求方法**：`POST`
- **请求路径**：`/api/auth/profile/email-code`
- **需要鉴权**：是（`Authorization: Bearer <UserToken>`）
- **加密模式**：端到端加密

---

## 请求参数

### Request Headers

| Header | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `Authorization` | `string` | 是 | 格式为 `Bearer <token>` |

### Request Body (JSON)

| 字段名 | 类型 | 必填 | 说明与限制 |
| :--- | :--- | :--- | :--- |
| `email` | `string` | 是 | 待绑定的新电子邮箱（不能与当前邮箱相同，且未被其他账号注册） |

### 请求示例

```json
{
  "email": "new_email@example.com"
}
```

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "验证码已发送",
  "data": {
    "sent": true,
    "email": "new_email@example.com",
    "purpose": "profile_email",
    "expiresIn": 600
  },
  "success": true
}
```

### 常见错误响应

```json
{
  "code": 400,
  "msg": "新邮箱不能与当前邮箱相同",
  "data": null,
  "success": false
}
```

- `400 新邮箱不能与当前邮箱相同`
- `400 该邮箱已被注册`
- `400 邮箱格式不正确`
