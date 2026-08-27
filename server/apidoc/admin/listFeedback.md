# 分页查询用户反馈列表

管理后台分页查询用户提交的问题反馈列表，支持按处理状态（`pending` / `processed`）、问题类型和关键词筛选。

- **请求方法**：`GET`
- **请求路径**：`/api/admin/feedback`
- **需要鉴权**：是（`Authorization: Bearer <AdminToken>`）
- **加密模式**：端到端加密

---

## 请求参数

### Query Parameters

| 参数名 | 类型 | 必填 | 说明与限制 |
| :--- | :--- | :--- | :--- |
| `status` | `string` | 否 | 状态过滤：`pending`（待处理）或 `processed`（已处理） |
| `type` | `string` | 否 | 类型过滤：`bug` / `playback` / `ui` / `feature` / `other` |
| `keyword` | `string` | 否 | 描述或联系方式模糊搜索 |
| `offset` | `number` | 否 | 分页起始偏移量，默认 0 |
| `limit` | `number` | 否 | 每页条数（默认 20） |

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
        "id": "fb_123",
        "createdAt": "2026-08-26T14:30:00.000Z",
        "feedbackType": "playback",
        "description": "部分无损歌曲播放出现缓冲卡顿",
        "contact": "user@example.com",
        "status": "pending",
        "imageCount": 1
      }
    ],
    "total": 1,
    "offset": 0,
    "limit": 20
  },
  "success": true
}
```
