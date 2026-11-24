# 查看单条反馈详情

根据反馈 ID 查询属于当前账号或当前设备的单条反馈详情与处理状态。

- **请求方法**：`GET`
- **请求路径**：`/api/feedback/:id`
- **需要鉴权**：是（同 `GET /api/feedback`，至少提供有效的 `Authorization` 或 `x-pm-device-token`）
- **加密模式**：受系统 AES-GCM 响应加密保护

---

## 请求参数

### Path 参数

| 参数名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `id` | `string` | 是 | 反馈记录 ID |

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "success",
  "data": {
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
  },
  "success": true
}
```

### 常见错误响应

- `400 无效的反馈 ID`
- `401 缺少有效的账号或设备身份`
- `404 反馈记录不存在`
