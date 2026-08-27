# 查询房间详情

根据房间号查询一起听房间的当前公开信息（当前歌曲、播放状态、进度、成员列表等）。

- **请求方法**：`GET`
- **请求路径**：`/api/listen-together/rooms/:roomId`
- **需要鉴权**：是（`Authorization: Bearer <UserToken>`）
- **加密模式**：端到端加密

---

## 请求参数

### Request Headers

| Header | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `Authorization` | `string` | 是 | 格式为 `Bearer <token>` |

### Path Parameters

| 参数名 | 类型 | 必填 | 说明与限制 |
| :--- | :--- | :--- | :--- |
| `roomId` | `string` | 是 | 房间号（数字字符串） |

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "room": {
      "roomId": "839201",
      "roomName": "周末音乐分享会",
      "hostUserId": "u_abc123456",
      "song": {
        "source": "wy",
        "id": "186016",
        "name": "晴天",
        "singer": "周杰伦",
        "album": "叶惠美",
        "pic": "https://p1.music.126.net/...",
        "duration": 269,
        "raw": { /* 原始曲目结构 */ }
      },
      "status": "playing",
      "position": 42.5,
      "maxPeople": 10,
      "currentPeople": 2,
      "memberOperation": true,
      "createdAt": 1700000000000,
      "updatedAt": 1700000042000,
      "version": 3,
      "members": [
        {
          "userId": "u_abc123456",
          "username": "音乐爱好者",
          "nickname": "音乐爱好者",
          "avatarUrl": "/static/account-avatars/default.jpg",
          "role": "host",
          "online": true,
          "joinedAt": 1700000000000,
          "lastSeenAt": 1700000042000
        },
        {
          "userId": "u_def789",
          "username": "听歌小王子",
          "nickname": "听歌小王子",
          "avatarUrl": "https://img.pisamusic.example.com/...",
          "role": "member",
          "online": true,
          "joinedAt": 1700000010000,
          "lastSeenAt": 1700000040000
        }
      ]
    }
  },
  "success": true
}
```

### 常见错误响应

```json
{
  "code": 404,
  "msg": "房间不存在",
  "errorMsg": "ROOM_NOT_FOUND",
  "data": null,
  "success": false
}
```
