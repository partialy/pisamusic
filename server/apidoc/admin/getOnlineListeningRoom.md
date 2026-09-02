# 获取在线一起听房间详情

管理后台获取指定在线房间的完整状态，包括当前播放、房间参数及成员列表。

- **请求方法**：`GET`
- **请求路径**：`/api/admin/listen-together/online/:recordId`
- **需要鉴权**：是（`Authorization: Bearer <AdminToken>`）
- **加密模式**：端到端加密

---

## 请求参数

### Path Parameters

| 参数名 | 类型 | 必填 | 说明与限制 |
| :--- | :--- | :--- | :--- |
| `recordId` | `string` | 是 | 房间生命周期记录 ID 或房间号 |

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
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
    "onlinePeople": 2,
    "currentPeople": 2,
    "maxPeople": 10,
    "memberOperation": true,
    "peakPeople": 4,
    "totalJoinCount": 5,
    "uniquePeople": 3,
    "createdAt": 1700000000000,
    "updatedAt": 1700000120000,
    "version": 12,
    "members": [
      {
        "userId": "u_abc123456",
        "username": "jay_fan",
        "nickname": "杰伦迷",
        "avatarUrl": "",
        "role": "host",
        "online": true,
        "joinedAt": 1700000000000,
        "lastSeenAt": 1700000120000
      },
      {
        "userId": "u_def789012",
        "username": "guest_user",
        "nickname": "访客",
        "avatarUrl": "",
        "role": "member",
        "online": true,
        "joinedAt": 1700000050000,
        "lastSeenAt": 1700000120000
      }
    ]
  },
  "success": true
}
```
