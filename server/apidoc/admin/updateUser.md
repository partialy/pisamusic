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
| `vipLevel` | `number` | 否 | 隐藏 VIP 档位等级（`>= 1`，默认 `1`；仅后台管理与后端配额判定使用，不向客户端暴露） |

---

## 批量 VIP 查询与赋予（`POST /api/admin/users/vip/resolve` & `POST /api/admin/users/vip/batch`）

1. **查询待赋予用户 (`POST /api/admin/users/vip/resolve`)**：请求 `{ identifiers: string[] }`（支持用户 ID 或邮箱，自动去重且最多 500 项），返回 `{ matched: AdminUserItem[], notFound: string[] }`；未匹配项跳过并列出。
2. **确认批量赋予 (`POST /api/admin/users/vip/batch`)**：请求 `{ userIds: string[], vipEnabled: boolean, durationDays?: number, vipExpiresAt?: number | null, vipLevel?: number }`。启用时若已有效 VIP 则在原到期时间上叠加时长，且档位按 `max(原 vipLevel, 新 vipLevel)` 升级；停用时保留历史 `vipLevel` 并清空到期时间。

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
