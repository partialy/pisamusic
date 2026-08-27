# 更新用户资料

修改当前登录用户的昵称、头像 Key 或换绑邮箱。修改成功后自动签发并返回最新 User Token。

- **请求方法**：`PATCH`
- **请求路径**：`/api/auth/profile`
- **需要鉴权**：是（`Authorization: Bearer <UserToken>`）
- **加密模式**：端到端加密

---

## 请求参数

### Request Headers

| Header | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `Authorization` | `string` | 是 | 格式为 `Bearer <token>` |

### Request Body (JSON)

支持按需传递以下修改字段：

| 字段名 | 类型 | 必填 | 说明与限制 |
| :--- | :--- | :--- | :--- |
| `username` | `string` | 否 | 新用户名，2-32 位中文、字母、数字、下划线或短横线 |
| `avatarKey` | `string` | 否 | 新头像 Key，必须为 `default` 或通过 `/api/auth/avatar/upload-token` 分配的合法七牛对象 Key |
| `email` | `string` | 否 | 待换绑的新邮箱（若修改邮箱则必须同时传递 `code`） |
| `code` | `string` | 否 | 新邮箱收到的 `profile_email` 验证码（仅在修改 `email` 时必填） |

### 请求示例

```json
{
  "username": "新昵称",
  "avatarKey": "pisamusic/user-avatars/u_abc123456/1700000000000_avatar.png"
}
```

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "资料已更新",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresAt": 1700604800000,
    "user": {
      "id": "u_abc123456",
      "email": "user@example.com",
      "username": "新昵称",
      "avatar": "pisamusic/user-avatars/u_abc123456/1700000000000_avatar.png",
      "avatarKey": "pisamusic/user-avatars/u_abc123456/1700000000000_avatar.png",
      "avatarUrl": "https://img.pisamusic.example.com/pisamusic/user-avatars/u_abc123456/1700000000000_avatar.png",
      "vip": false,
      "vipExpiresAt": null,
      "createdAt": 1700000000000,
      "lastLoginAt": 1700000050000
    }
  },
  "success": true
}
```

### 注意事项
- 当用户上传并更换新自定义头像后，服务端会自动异步清理并删除旧的七牛头像对象。
- 若修改了邮箱且验证码正确，邮箱将被原子更新。
