# 创建一起听房间

登录用户创建一起听房间，用户自动成为房主（`host`）。支持自定义房间名称、人数上限、是否允许成员切歌/控制进度，以及自定义或系统随机生成房间号。

- **请求方法**：`POST`
- **请求路径**：`/api/listen-together/rooms`
- **需要鉴权**：是（`Authorization: Bearer <UserToken>`）
- **加密模式**：端到端加密

---

## 请求参数

### Request Headers

| Header | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `Authorization` | `string` | 是 | 格式为 `Bearer <token>` |

### Request Body (JSON)

| 字段名 | 类型 | 必填 | 说明与限制 |
| :--- | :--- | :--- | :--- |
| `roomName` | `string` | 是 | 房间名称，1-32 位字符 |
| `roomId` | `string` | 否 | 自定义房间号（纯数字，4-16 位）；不传则由系统随机生成 6 位数字 |
| `maxPeople` | `number` | 否 | 房间人数上限（2-20 人，默认 10） |
| `memberOperation` | `boolean` | 否 | 是否允许房间普通成员操控切歌/播放/暂停（默认 `false` 仅房主可控） |
| `replaceExisting` | `boolean` | 否 | 若用户已在其他房间，是否强制退出旧房间并创建新房间（默认 `false`） |

### 请求示例

```json
{
  "roomName": "周末音乐分享会",
  "maxPeople": 10,
  "memberOperation": true,
  "replaceExisting": true
}
```

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "创建成功",
  "data": {
    "room": {
      "roomId": "839201",
      "roomName": "周末音乐分享会",
      "hostUserId": "u_abc123456",
      "song": null,
      "status": "paused",
      "position": 0,
      "maxPeople": 10,
      "currentPeople": 1,
      "memberOperation": true,
      "createdAt": 1700000000000,
      "updatedAt": 1700000000000,
      "version": 0,
      "members": [
        {
          "userId": "u_abc123456",
          "username": "音乐爱好者",
          "nickname": "音乐爱好者",
          "avatarUrl": "/static/account-avatars/default.jpg",
          "role": "host",
          "online": true,
          "joinedAt": 1700000000000,
          "lastSeenAt": 1700000000000
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
  "code": 400,
  "msg": "用户已经在其它房间内",
  "errorMsg": "USER_ALREADY_HAS_ROOM",
  "data": null,
  "success": false
}
```

- `400 USER_ALREADY_HAS_ROOM`：用户已在房间中且未传 `replaceExisting=true`。
- `409 ROOM_ID_EXISTS`：指定的房间号已被占用。
