# 分页查询验证码记录列表

管理后台分页查询系统发送的验证码流水记录，支持按通道（邮箱/手机）、验证类型、状态及关键词进行多维筛选，返回验证码、关联用户、触发设备 ID、客户端 IP、发送与验证时间等信息。

- **请求方法**：`GET`
- **请求路径**：`/api/admin/verification-codes`
- **需要鉴权**：是（`Authorization: Bearer <AdminToken>`）
- **加密模式**：端到端加密

---

## 请求参数

### Query Parameters

| 参数名 | 类型 | 必填 | 说明与限制 |
| :--- | :--- | :--- | :--- |
| `channel` | `string` | 否 | 发送通道：`email`（邮箱）、`phone`（手机号）、`all`（全部） |
| `purpose` | `string` | 否 | 验证类型：`register`（注册）、`login`（登录）、`reset_password`（重置密码）、`profile_email`（换绑邮箱）、`profile_phone`（换绑手机） |
| `status` | `string` | 否 | 状态：`sent`（有效中）、`verified`（已验证）、`expired`（已过期）、`failed`（发送失败）、`all`（全部） |
| `keyword` | `string` | 否 | 关键词搜索（支持邮箱、手机号、设备 ID、用户 ID、IP 模糊匹配） |
| `offset` | `number` | 否 | 分页起始偏移量，默认 0 |
| `limit` | `number` | 否 | 每页条数（默认 20，上限 100） |

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "items": [
      {
        "id": "e987b21a-3c4d-5e6f-7a8b-9c0d1e2f3a4b",
        "channel": "email",
        "target": "user@example.com",
        "purpose": "login",
        "code": "839201",
        "userId": "u_abc123456",
        "user": {
          "id": "u_abc123456",
          "email": "user@example.com",
          "username": "音乐爱好者",
          "avatar": "default",
          "avatarKey": "default",
          "avatarUrl": "/static/account-avatars/default.jpg",
          "vip": true,
          "vipExpiresAt": 1735689600000,
          "createdAt": 1700000000000,
          "lastLoginAt": 1700000050000
        },
        "deviceId": "dev_win_x64_001",
        "clientIp": "192.168.1.100",
        "userAgent": "Mozilla/5.0 PisaMusic/1.0.0",
        "status": "verified",
        "errorMessage": "",
        "createdAt": 1700000000000,
        "expiresAt": 1700000300000,
        "verifiedAt": 1700000035000
      }
    ],
    "total": 1,
    "offset": 0,
    "limit": 20
  },
  "success": true
}
```
