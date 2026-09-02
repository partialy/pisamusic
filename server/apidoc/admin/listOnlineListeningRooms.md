# 查询在线一起听房间列表

管理后台分页查询当前内存中活跃的一起听房间，支持关键词搜索（房间号、房间名、房主），明确区分在线人数与当前总人数。

- **请求方法**：`GET`
- **请求路径**：`/api/admin/listen-together/online`
- **需要鉴权**：是（`Authorization: Bearer <AdminToken>`）
- **加密模式**：端到端加密

---

## 请求参数

### Query Parameters

| 参数名 | 类型 | 必填 | 说明与限制 |
| :--- | :--- | :--- | :--- |
| `keyword` | `string` | 否 | 搜索关键词（房间号 / 房间名 / 房主用户名 / 房主昵称 / 房主 ID / 记录 ID） |
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
        "song": {
          "source": "wy",
          "id": "186016",
          "name": "晴天",
          "singer": "周杰伦",
          "album": "叶惠美",
          "duration": 269,
          "cover": "https://p1.music.126.net/..."
        },
        "playbackStatus": "playing",
        "position": 120,
        "onlinePeople": 3,
        "currentPeople": 4,
        "maxPeople": 10,
        "memberOperation": true,
        "peakPeople": 6,
        "totalJoinCount": 8,
        "uniquePeople": 5,
        "createdAt": 1700000000000,
        "updatedAt": 1700000120000
      }
    ],
    "total": 1,
    "offset": 0,
    "limit": 20
  },
  "success": true
}
```
