# 分页查询一起听房间历史记录

管理后台分页查询所有已结束或历史的一起听房间记录，支持关键词、结束原因和时间范围筛选。

- **请求方法**：`GET`
- **请求路径**：`/api/admin/listen-together/history`
- **需要鉴权**：是（`Authorization: Bearer <AdminToken>`）
- **加密模式**：端到端加密

---

## 请求参数

### Query Parameters

| 参数名 | 类型 | 必填 | 说明与限制 |
| :--- | :--- | :--- | :--- |
| `keyword` | `string` | 否 | 搜索关键词（房间号 / 房间名 / 房主用户名 / 房主昵称 / 房主 ID / 记录 ID） |
| `endReason` | `string` | 否 | 结束原因筛选：`empty` / `host_left` / `admin_dissolved` / `server_restart` / `timeout` |
| `startFrom` | `number` | 否 | 创建时间起始毫秒时间戳 |
| `startTo` | `number` | 否 | 创建时间截止毫秒时间戳 |
| `offset` | `number` | 否 | 分页起始偏移量，默认 0 |
| `limit` | `number` | 否 | 每页条数（默认 20，最大 100） |

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
        "recordId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        "roomId": "888888",
        "roomName": "一起来听周杰伦",
        "host": {
          "userId": "u_abc123456",
          "username": "jay_fan",
          "nickname": "杰伦迷",
          "avatarUrl": ""
        },
        "lifecycleStatus": "closed",
        "endReason": "admin_dissolved",
        "endedByAdmin": "admin",
        "lastSong": {
          "source": "wy",
          "id": "186016",
          "name": "晴天",
          "singer": "周杰伦",
          "album": "叶惠美",
          "duration": 269,
          "cover": "https://p1.music.126.net/..."
        },
        "finalPlaybackStatus": "playing",
        "finalPosition": 120,
        "maxPeople": 10,
        "memberOperation": true,
        "peakPeople": 6,
        "totalJoinCount": 8,
        "uniquePeople": 5,
        "createdAt": 1700000000000,
        "endedAt": 1700000300000,
        "updatedAt": 1700000300000
      }
    ],
    "total": 1,
    "offset": 0,
    "limit": 20
  },
  "success": true
}
```
