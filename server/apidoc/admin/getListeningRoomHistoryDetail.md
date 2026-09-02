# 获取一起听房间历史详情

管理后台获取指定房间历史记录的完整信息，包括最终状态及所有成员的参与历史分段（入房、离房、停留时长及离开原因）。

- **请求方法**：`GET`
- **请求路径**：`/api/admin/listen-together/history/:recordId`
- **需要鉴权**：是（`Authorization: Bearer <AdminToken>`）
- **加密模式**：端到端加密

---

## 请求参数

### Path Parameters

| 参数名 | 类型 | 必填 | 说明与限制 |
| :--- | :--- | :--- | :--- |
| `recordId` | `string` | 是 | 房间生命周期记录 ID |

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
    "updatedAt": 1700000300000,
    "members": [
      {
        "id": "seg_111111",
        "userId": "u_abc123456",
        "username": "jay_fan",
        "nickname": "杰伦迷",
        "avatarUrl": "",
        "role": "host",
        "joinedAt": 1700000000000,
        "leftAt": 1700000300000,
        "lastSeenAt": 1700000300000,
        "leaveReason": "room_closed",
        "durationSeconds": 300
      },
      {
        "id": "seg_222222",
        "userId": "u_def789012",
        "username": "guest_user",
        "nickname": "访客",
        "avatarUrl": "",
        "role": "member",
        "joinedAt": 1700000050000,
        "leftAt": 1700000200000,
        "lastSeenAt": 1700000200000,
        "leaveReason": "left",
        "durationSeconds": 150
      }
    ]
  },
  "success": true
}
```
