# 查看用户反馈详情

管理后台获取单条反馈的完整信息，包含用户上传的截图图片 URL 列表和设备软硬件环境信息。

- **请求方法**：`GET`
- **请求路径**：`/api/admin/feedback/:id`
- **需要鉴权**：是（`Authorization: Bearer <AdminToken>`）
- **加密模式**：端到端加密

---

## 请求参数

### Path Parameters

| 参数名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `id` | `string` | 是 | 反馈记录 ID |

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "id": "fb_123",
    "createdAt": "2026-08-26T14:30:00.000Z",
    "feedbackType": "playback",
    "description": "部分无损歌曲播放出现缓冲卡顿",
    "contact": "user@example.com",
    "status": "pending",
    "processedAt": null,
    "device": {
      "brand": "Xiaomi",
      "model": "23127PN0CC",
      "osVersion": "14",
      "appVersion": "2.1.0"
    },
    "imageUrls": [
      "/uploads/feedback/screenshot_01.jpg"
    ]
  },
  "success": true
}
```
