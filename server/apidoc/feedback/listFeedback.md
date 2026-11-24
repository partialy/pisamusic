# 查询我的反馈记录

分页查询当前账号或当前设备提交的用户反馈记录与处理状态，按创建时间倒序返回；不支持客户端删除。

- **请求方法**：`GET`
- **请求路径**：`/api/feedback`
- **需要鉴权**：是（至少携带有效用户 `Authorization: Bearer <UserToken>` 或设备凭证 `x-pm-device-token` 之一；若显式携带了凭证但已失效，返回 `401` 不降级）
- **加密模式**：受系统 AES-GCM 响应加密保护（客户端携带 `x-pm-random` 与 `x-pm-enc-ver: 1`）

---

## 请求参数

### Headers

| 请求头 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `Authorization` | `string` | 否 | `Bearer <UserToken>`；与 `x-pm-device-token` 至少提供其一，同时提供时返回账号或当前设备提交的全部记录并集 |
| `x-pm-device-token` | `string` | 否 | 设备上报返回的 `messageToken`（JWT）；未登录设备可仅凭此头查询本设备提交及历史 `serverDeviceId` 反馈 |

### Query 参数

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| `offset` | `number` | 否 | `0` | 偏移量（`>= 0`） |
| `limit` | `number` | 否 | `20` | 每页条数（`1-100`） |

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "list": [
      {
        "id": "e4b1a134-8b6b-4e89-8d39-65231bfa2833",
        "createdAt": "2026-11-24T10:30:00.000Z",
        "feedbackType": "bug",
        "description": "播放无损音质时偶尔闪退",
        "contact": "user@example.com",
        "status": "processed",
        "processedAt": "2026-11-24T11:00:00.000Z",
        "imageCount": 1,
        "firstImageUrl": "/uploads/feedback/sample.jpg",
        "images": [
          "/uploads/feedback/sample.jpg"
        ]
      }
    ],
    "total": 1,
    "offset": 0,
    "limit": 20,
    "hasMore": false
  },
  "success": true
}
```

### 常见错误响应

- `401 缺少有效的账号或设备身份`
- `401 登录凭证已失效，请重新登录`
- `401 设备凭证无效或已过期`
