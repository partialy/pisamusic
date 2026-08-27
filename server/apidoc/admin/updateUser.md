# 更新用户资料与 VIP 权益

管理后台修改用户的用户名、邮箱、系统内置头像，以及配置或关闭用户的 PisaMusic VIP 会员权益。

- **请求方法**：`PUT`
- **请求路径**：`/api/admin/users/:id`
- **需要鉴权**：是（`Authorization: Bearer <AdminToken>`）
- **加密模式**：端到端加密

---

## 请求参数

### Path Parameters

| 参数名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `id` | `string` | 是 | 用户 ID |

### Request Body (JSON)

| 字段名 | 类型 | 必填 | 说明与限制 |
| :--- | :--- | :--- | :--- |
| `username` | `string` | 否 | 新用户名（2-32 位，不可与已有用户重复） |
| `email` | `string` | 否 | 新邮箱（不可与已有用户重复） |
| `avatarKey` | `string` | 否 | 头像 Key（如 `default`） |
| `vipEnabled` | `boolean` | 否 | 是否启用 VIP 权益（若传入 `vipExpiresAt` 则此项必填） |
| `vipExpiresAt` | `number \| null` | 否 | VIP 到期时间戳毫秒数（启用 VIP 时必须晚于当前时间；关闭 VIP 时传 `null`） |

### 请求示例

```json
{
  "vipEnabled": true,
  "vipExpiresAt": 1767225600000
}
```

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "用户资料已保存",
  "data": {
    "id": "u_abc123456",
    "email": "user@example.com",
    "username": "音乐爱好者",
    "avatar": "default",
    "avatarKey": "default",
    "avatarUrl": "/static/account-avatars/default.jpg",
    "vip": true,
    "vipExpiresAt": 1767225600000,
    "createdAt": 1700000000000,
    "lastLoginAt": 1700000050000
  },
  "success": true
}
```

### 常见错误响应

- `400 启用 VIP 时必须设置晚于当前时间的到期时间`
- `400 该邮箱已被注册`
- `400 该用户名已被使用`
