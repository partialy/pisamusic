# 查询专属消息记录

管理后台分页查询专属消息发送记录，可按单一接收方筛选。用户详情的“消息记录”Tab 使用同一数据契约读取对应用户的发送、已读状态和已读设备。

- **请求方法**：`GET`
- **请求路径**：`/api/admin/messages`
- **需要鉴权**：是（`Authorization: Bearer <AdminToken>`）
- **加密模式**：端到端加密

## 请求参数

### Headers

| Header | 必填 | 说明 |
| :--- | :--- | :--- |
| `Authorization` | 是 | `Bearer <AdminToken>`。 |

### Query Parameters

| 参数 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `targetKind` | `user \| android_device \| desktop_device` | 否 | 接收方类型。与 `targetId` 必须同时提供。 |
| `targetId` | `string` | 否 | 接收方服务端 UUID。与 `targetKind` 必须同时提供。 |
| `offset` | `number` | 否 | 分页偏移量，默认 `0`。 |
| `limit` | `number` | 否 | 每页条数，范围 `1-100`，默认 `30`。 |

## 返回数据

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "items": [
      {
        "id": "806ce22e-87bd-4af0-8395-983ad24a1b8c",
        "targetKind": "android_device",
        "targetId": "550e8400-e29b-41d4-a716-446655440000",
        "content": "请检查网络连接。",
        "createdAt": 1756780800000,
        "createdByAdmin": "admin",
        "read": true,
        "readAt": 1756780920000,
        "readPlatform": "android",
        "readDeviceId": "550e8400-e29b-41d4-a716-446655440000"
      }
    ],
    "total": 1,
    "offset": 0,
    "limit": 30
  },
  "success": true
}
```

记录按 `createdAt DESC, id DESC` 返回。`readAt` 是全局权威已读状态：一台设备或一个账号确认后，该记录不再被任何拥有者返回为未读；`readPlatform` 和 `readDeviceId` 仅用于审计首次读取来源。

## 错误响应

| HTTP 状态 | 说明 |
| :--- | :--- |
| `400` | `targetKind` 与 `targetId` 未同时提供、接收方类型不支持或分页参数不合法。 |
| `401` | 管理员 Token 缺失、无效或过期。 |
| `500` | 服务端查询失败。 |
