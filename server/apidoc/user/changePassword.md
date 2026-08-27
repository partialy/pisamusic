# 登录态修改密码

在用户登录状态下，通过校验旧密码修改为新密码。

- **请求方法**：`POST`
- **请求路径**：`/api/auth/password/change`
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
| `currentPassword` | `string` | 是 | 当前原密码 |
| `newPassword` | `string` | 是 | 新密码，长度 6-128 位，且不能与当前密码相同 |

### 请求示例

```json
{
  "currentPassword": "oldPassword123",
  "newPassword": "newPassword456"
}
```

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "密码已修改",
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
  "msg": "当前密码错误",
  "data": null,
  "success": false
}
```

- `400 当前密码错误`
- `400 新密码不能与当前密码相同`
- `400 密码至少 6 位`
- `401 未登录或令牌无效`
