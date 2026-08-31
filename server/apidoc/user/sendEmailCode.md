# 发送邮箱验证码

向指定邮箱发送验证码，用于账号注册、验证码快捷登录或重置密码。手机号场景请使用 `/api/auth/phone-code`。

- **请求方法**：`POST`
- **请求路径**：`/api/auth/email-code`
- **需要鉴权**：否
- **加密模式**：端到端加密

---

## 请求参数

### Request Body (JSON)

| 字段名 | 类型 | 必填 | 说明与限制 |
| :--- | :--- | :--- | :--- |
| `email` | `string` | 是 | 目标电子邮箱，必须符合邮箱格式且长度不超过 254 |
| `purpose` | `string` | 是 | 验证码用途，可选值：<br>• `register`：注册验证（已注册邮箱会报错）<br>• `login`：登录验证（未注册邮箱可在校验成功后自动注册）<br>• `reset_password`：重置密码（未注册邮箱会报错） |

### 请求示例

```json
{
  "email": "user@example.com",
  "purpose": "register"
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
    "email": "user@example.com",
    "purpose": "register",
    "expiresIn": 600
  },
  "success": true
}
```

### 响应字段说明

| 字段名 | 类型 | 说明 |
| :--- | :--- | :--- |
| `sent` | `boolean` | 是否发送成功 |
| `email` | `string` | 接收验证码的邮箱 |
| `purpose` | `string` | 验证码用途 |
| `expiresIn` | `number` | 验证码有效时长（秒），默认 600 秒（10分钟） |

### 常见错误响应

```json
{
  "code": 400,
  "msg": "该邮箱已注册",
  "data": null,
  "success": false
}
```

- `400 该邮箱已注册`：`purpose` 为 `register` 且邮箱已存在时返回。
- `404 该邮箱尚未注册`：`purpose` 为 `reset_password` 且邮箱不存在时返回。
- `400 邮箱格式不正确`：邮箱校验失败。
- `400 验证码用途不正确`：`purpose` 取值非指定范围。
