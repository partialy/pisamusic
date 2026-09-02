# 发送专属消息

管理后台向一个用户、Android 设备或桌面设备发送一条专属消息。每条记录只允许一个接收方，消息正文最长 2000 个字符。

- **请求方法**：`POST`
- **请求路径**：`/api/admin/messages`
- **需要鉴权**：是（`Authorization: Bearer <AdminToken>`）
- **加密模式**：端到端加密

## 请求参数

### Headers

| Header | 必填 | 说明 |
| :--- | :--- | :--- |
| `Authorization` | 是 | `Bearer <AdminToken>`。创建人由 JWT 中的管理员用户名自动记录，Body 不允许指定。 |

### Request Body

| 字段 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `targetKind` | `user \| android_device \| desktop_device` | 是 | 接收方类型。 |
| `targetId` | `string` | 是 | 对应用户或设备的服务端 UUID。 |
| `content` | `string` | 是 | 去首尾空白后的消息正文，长度 `1-2000`。 |

```json
{
  "targetKind": "user",
  "targetId": "8c76172b-c4e3-4ae3-9f5a-0d7b1ab1ed2f",
  "content": "你的账号已开通新功能，欢迎体验。"
}
```

## 返回数据

```json
{
  "code": 0,
  "msg": "消息已发送",
  "data": {
    "id": "806ce22e-87bd-4af0-8395-983ad24a1b8c",
    "targetKind": "user",
    "targetId": "8c76172b-c4e3-4ae3-9f5a-0d7b1ab1ed2f",
    "content": "你的账号已开通新功能，欢迎体验。",
    "createdAt": 1756780800000,
    "createdByAdmin": "admin",
    "read": false,
    "readAt": null,
    "readPlatform": null,
    "readDeviceId": null
  },
  "success": true
}
```

## 错误响应

| HTTP 状态 | 说明 |
| :--- | :--- |
| `400` | `targetKind` 不支持、接收方 ID/正文为空或正文超过 2000 字符。 |
| `401` | 管理员 Token 缺失、无效或过期。 |
| `404` | 指定用户或设备不存在。 |
| `500` | 服务端写入失败。 |
