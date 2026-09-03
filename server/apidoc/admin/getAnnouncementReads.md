# 获取公告已读列表

管理后台分页查看指定公告的已读回执，包含用户信息和设备信息快照。

- **请求方法**：`GET`
- **请求路径**：`/api/admin/announcements/:id/reads`
- **需要鉴权**：是（`Authorization: Bearer <AdminToken>`）
- **加密模式**：端到端加密

## 请求参数

### Query Parameters

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| `offset` | `number` | 否 | `0` | 偏移量，最小为 `0` |
| `limit` | `number` | 否 | `20` | 每页数量，范围 `1-100` |

### Path Parameters

| 参数名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `id` | `string` | 是 | 公告 ID |

## 响应数据

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "items": [
      {
        "id": "read-record-id",
        "announcementId": "anno_202608",
        "platform": "android",
        "readAt": 1788000000123,
        "createdAt": 1787999999000,
        "user": {
          "id": 8,
          "username": "partial",
          "email": "user@example.com",
          "vip": false
        },
        "device": {
          "id": "device-id",
          "platform": "android",
          "name": "Pixel 9",
          "model": "Pixel 9",
          "systemVersion": "Android 16",
          "appVersion": "2.1.0",
          "arch": "arm64-v8a"
        }
      }
    ],
    "total": 1,
    "offset": 0,
    "limit": 20
  },
  "success": true
}
```

匿名回执的 `user` 为 `null`，但仍保留设备信息。接口只返回用户和设备公开快照，不返回密码、设备消息 token、设备指纹或客户端 IP 等敏感凭据。
