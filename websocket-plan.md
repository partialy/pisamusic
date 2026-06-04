你是一名资深 Node.js 后端工程师，请基于当前项目实现「实时通信」模块，技术栈优先使用 Node.js + Socket.IO。当前阶段先实现「一起听」功能，后续会扩展好友系统、聊天功能，因此请保证 socket 模块具备良好的工程化、可扩展性和清晰的事件协议设计。

## 一、总体目标

实现音乐 App 的「一起听」后端能力：

* 用户可以创建一起听房间。
* 其他用户可以通过房间号加入。
* 房间人数支持 2-8 人，默认 8。
* 最大可配置人数由后台 admin 在 `sys_config` 配置表中配置。
* 前端开启一起听时，先调用后端接口查询当前系统允许的最大人数配置。
* 用户创建房间时可以自定义：

  * 房间标题
  * 房间号
  * 房间最大人数
  * 是否允许成员控制播放
* 房间内成员通过 Socket.IO 实时同步播放状态，包括播放、暂停、切歌、拖动进度、退出房间等。
* 一起听的核心不是传输音频流，而是同步播放状态。每个客户端根据 `song` 对象自行加载音频资源并播放。

## 二、推荐模块结构

请尽量按以下结构实现，保证后续好友、聊天功能可以复用 socket 基础能力：

```txt
src/
  socket/
    index.js 或 index.ts
    namespaces/
      listenTogether.socket.js
    events/
      listenTogether.events.js
    middlewares/
      socketAuth.middleware.js
  modules/
    listenTogether/
      listenTogether.controller.js
      listenTogether.service.js
      listenTogether.store.js
      listenTogether.types.js
      listenTogether.validator.js
  config/
    socket.config.js
  utils/
    roomId.util.js
    response.util.js
```

如果当前项目已有自己的目录规范，请在不破坏现有规范的基础上合并进去。

## 三、系统配置要求

后台配置表 `sys_config` 中需要支持一起听最大房间人数配置。

建议配置项：

```txt
key: listen_together_max_people
value: 8
description: 一起听房间允许的最大人数
```

后端需要提供接口给前端查询：

```http
GET /api/listen-together/config
```

返回示例：

```json
{
  "code": 0,
  "success": true,
  "msg": "success",
  "data": {
    "maxPeopleLimit": 8,
    "defaultMaxPeople": 2,
    "roomIdMinLength": 4,
    "roomIdMaxLength": 8
  }
}
```

规则：

* `maxPeopleLimit` 从 `sys_config` 读取。
* 如果配置不存在，默认 8。
* 如果配置值小于 2，按 2 处理。
* 如果配置值大于 8，按 8 处理。
* 前端创建房间时选择的 `maxPeople` 不能超过该配置。

## 四、创建房间流程

前端开启一起听时：

1. 请求 `/api/listen-together/config` 获取配置。
2. 弹窗填写房间信息。
3. 默认房间标题为：`${name}的听歌房`。
4. 默认房间号为随机 6 位数字。
5. 房间号允许用户自定义，长度 4-8 位，只允许数字。
6. 默认最大人数为 2。
7. 默认允许成员控制播放：`true`。
8. 提交创建房间接口。
9. 创建成功后，前端连接 Socket.IO 并加入房间。

创建房间接口：

```http
POST /api/listen-together/rooms
```

请求体：

```json
{
  "roomName": "昔忆的听歌房",
  "roomId": "123456",
  "maxPeople": 2,
  "memberOperation": true
}
```

后端从登录态中获取当前用户作为房主，不允许前端直接传 `hostUserId` 作为可信字段。

返回：

```json
{
  "code": 0,
  "success": true,
  "msg": "创建成功",
  "data": {
    "roomId": "123456",
    "roomName": "昔忆的听歌房",
    "hostUserId": "10001",
    "maxPeople": 2,
    "currentPeople": 1,
    "memberOperation": true,
    "status": "paused",
    "position": 0,
    "song": null,
    "updatedAt": 1710000000000,
    "version": 0,
    "members": [
      {
        "userId": "10001",
        "nickname": "昔忆",
        "avatar": "https://xxx.com/avatar.png",
        "role": "host",
        "joinedAt": 1710000000000
      }
    ]
  }
}
```

## 五、SongDTO 规范

由于播放器是多音源播放器，socket 同步时不能只传单一歌曲 ID，必须传完整 `song` 对象。

`SongDTO` 结构如下：

```json
{
  "id": "123456",
  "source": "netease",
  "name": "歌曲名",
  "artist": "歌手名",
  "album": "专辑名",
  "coverUrl": "https://xxx.com/cover.jpg",
  "playUrl": "https://xxx.com/song.mp3",
  "duration": 240000,
  "extra": {}
}
```

字段说明：

* `id`：歌曲在当前音源下的唯一 ID，必填。
* `source`：音源标识，必填，例如 `netease`、`tencent`、`kg`、`kw`、`local` 等。
* `name`：歌名，必填。
* `artist`：歌手，必填。
* `album`：专辑，可选。
* `coverUrl`：封面 URL，可选但推荐。
* `playUrl`：播放地址，可选。如果没有传，客户端根据 `id + source` 自行请求播放地址。
* `duration`：歌曲总时长，单位毫秒，可选。
* `extra`：扩展字段，用于保存不同音源的额外数据。

校验要求：

* `song` 不允许只传字符串 ID。
* 切歌、播放指定歌曲时必须传 `song` 对象。
* 如果 `song.playUrl` 不存在，后端不应该报错，客户端自行获取播放地址。
* 后端只保存和广播 `song`，不负责拉取真实音频流。

## 六、房间状态结构

服务端维护的房间结构建议如下：

```json
{
  "roomId": "123456",
  "roomName": "昔忆的听歌房",
  "hostUserId": "10001",
  "song": {
    "id": "123456",
    "source": "netease",
    "name": "歌曲名",
    "artist": "歌手名",
    "album": "专辑名",
    "coverUrl": "https://xxx.com/cover.jpg",
    "playUrl": "https://xxx.com/song.mp3",
    "duration": 240000,
    "extra": {}
  },
  "status": "paused",
  "position": 0,
  "maxPeople": 8,
  "currentPeople": 2,
  "memberOperation": true,
  "updatedAt": 1710000000000,
  "version": 0,
  "members": [
    {
      "userId": "10001",
      "nickname": "昔忆",
      "avatar": "https://xxx.com/avatar.png",
      "role": "host",
      "joinedAt": 1710000000000
    },
    {
      "userId": "10002",
      "nickname": "好友",
      "avatar": "https://xxx.com/avatar2.png",
      "role": "member",
      "joinedAt": 1710000005000
    }
  ]
}
```

字段说明：

* `roomId`：房间号，4-8 位数字。
* `roomName`：房间名称。
* `hostUserId`：房主用户 ID。
* `song`：当前歌曲对象，可以为 `null`。
* `status`：播放状态，取值：`playing`、`paused`、`ended`。
* `position`：当前播放进度，单位毫秒。
* `maxPeople`：房间最大人数。
* `currentPeople`：当前人数。
* `memberOperation`：是否允许成员控制播放。
* `updatedAt`：服务端更新时间戳。
* `version`：房间状态版本号，每次播放状态变化都递增。
* `members`：房间成员列表。

注意：`updatedAt` 必须由服务端生成，不能直接信任客户端传入的时间。

## 七、Socket.IO 连接规范

客户端连接：

```txt
/socket.io
```

建议通过 auth 携带 token：

```js
const socket = io("https://api.xxx.com", {
  auth: {
    token: "Bearer xxx"
  }
})
```

后端需要通过 socket middleware 校验用户身份，并将用户信息挂载到：

```js
socket.data.user = {
  userId,
  nickname,
  avatar
}
```

所有 socket 事件都应以后端登录态中的用户身份为准，不信任客户端传入的 `userId`。

## 八、Socket 消息基础结构

所有客户端发给服务端的消息建议统一结构：

```json
{
  "requestId": "uuid",
  "roomId": "123456",
  "action": "PLAY",
  "data": {}
}
```

字段说明：

* `requestId`：客户端生成的请求 ID，方便排查问题和做 ACK。
* `roomId`：房间号。
* `action`：操作类型。
* `data`：具体业务数据。

服务端广播给客户端的消息建议统一结构：

```json
{
  "event": "ROOM_STATE_CHANGED",
  "roomId": "123456",
  "serverTime": 1710000000000,
  "version": 12,
  "data": {}
}
```

字段说明：

* `event`：服务端事件类型。
* `roomId`：房间号。
* `serverTime`：服务端当前时间。
* `version`：房间状态版本号。
* `data`：具体业务数据。

客户端收到状态后，应根据：

```txt
实际播放进度 = position + 当前时间 - updatedAt
```

来校准播放进度。播放中才需要补偿时间差，暂停状态不需要累加。

## 九、客户端发给服务端的事件设计

### 1. 加入房间

事件名：

```txt
listen:join
```

请求：

```json
{
  "requestId": "req_001",
  "roomId": "123456",
  "action": "JOIN",
  "data": {}
}
```

服务端处理：

* 校验房间是否存在。
* 校验房间是否已满。
* 校验用户是否已在房间内。
* 将 socket 加入 Socket.IO room。
* 将用户加入房间成员列表。
* 向当前用户返回完整房间状态。
* 向其他成员广播成员加入事件。

ACK 返回：

```json
{
  "success": true,
  "code": 0,
  "msg": "加入成功",
  "data": {
    "room": {}
  }
}
```

广播：

```json
{
  "event": "MEMBER_JOINED",
  "roomId": "123456",
  "serverTime": 1710000000000,
  "version": 2,
  "data": {
    "member": {
      "userId": "10002",
      "nickname": "好友",
      "avatar": "https://xxx.com/avatar2.png",
      "role": "member",
      "joinedAt": 1710000000000
    },
    "members": []
  }
}
```

### 2. 离开房间

事件名：

```txt
listen:leave
```

请求：

```json
{
  "requestId": "req_002",
  "roomId": "123456",
  "action": "LEAVE",
  "data": {}
}
```

服务端处理：

* 从成员列表移除用户。
* socket 离开 Socket.IO room。
* 如果房主离开：

  * 可以将房主转移给最早加入的成员；
  * 如果没有成员，则销毁房间。
* 如果普通成员离开，只广播成员离开事件。
* 如果房间为空，销毁房间。

广播：

```json
{
  "event": "MEMBER_LEFT",
  "roomId": "123456",
  "serverTime": 1710000000000,
  "version": 3,
  "data": {
    "userId": "10002",
    "newHostUserId": "10001",
    "members": []
  }
}
```

### 3. 播放

事件名：

```txt
listen:play
```

请求：

```json
{
  "requestId": "req_003",
  "roomId": "123456",
  "action": "PLAY",
  "data": {
    "song": {
      "id": "123456",
      "source": "netease",
      "name": "歌曲名",
      "artist": "歌手名",
      "album": "专辑名",
      "coverUrl": "https://xxx.com/cover.jpg",
      "playUrl": "https://xxx.com/song.mp3",
      "duration": 240000,
      "extra": {}
    },
    "position": 120000
  }
}
```

服务端处理：

* 校验用户是否在房间内。
* 校验用户是否有操作权限：

  * 房主永远有权限。
  * `memberOperation = true` 时，成员有权限。
  * `memberOperation = false` 时，成员无权限。
* 校验 `song` 对象。
* 更新房间状态：

  * `song`
  * `status = playing`
  * `position`
  * `updatedAt = Date.now()`
  * `version += 1`
* 广播给房间所有成员。

广播：

```json
{
  "event": "ROOM_STATE_CHANGED",
  "roomId": "123456",
  "serverTime": 1710000000000,
  "version": 4,
  "data": {
    "action": "PLAY",
    "room": {
      "roomId": "123456",
      "song": {},
      "status": "playing",
      "position": 120000,
      "updatedAt": 1710000000000,
      "version": 4
    },
    "operator": {
      "userId": "10001",
      "nickname": "昔忆"
    }
  }
}
```

### 4. 暂停

事件名：

```txt
listen:pause
```

请求：

```json
{
  "requestId": "req_004",
  "roomId": "123456",
  "action": "PAUSE",
  "data": {
    "position": 121500
  }
}
```

服务端处理：

* 校验操作权限。
* 更新状态：

  * `status = paused`
  * `position`
  * `updatedAt = Date.now()`
  * `version += 1`

广播：

```json
{
  "event": "ROOM_STATE_CHANGED",
  "roomId": "123456",
  "serverTime": 1710000000000,
  "version": 5,
  "data": {
    "action": "PAUSE",
    "room": {
      "roomId": "123456",
      "song": {},
      "status": "paused",
      "position": 121500,
      "updatedAt": 1710000000000,
      "version": 5
    },
    "operator": {
      "userId": "10001",
      "nickname": "昔忆"
    }
  }
}
```

### 5. 切歌

事件名：

```txt
listen:change_song
```

请求：

```json
{
  "requestId": "req_005",
  "roomId": "123456",
  "action": "CHANGE_SONG",
  "data": {
    "song": {
      "id": "789",
      "source": "tencent",
      "name": "新歌曲",
      "artist": "新歌手",
      "album": "新专辑",
      "coverUrl": "https://xxx.com/cover2.jpg",
      "playUrl": "",
      "duration": 260000,
      "extra": {}
    },
    "autoPlay": true
  }
}
```

服务端处理：

* 校验操作权限。
* 校验 `song` 对象。
* 更新状态：

  * `song = data.song`
  * `position = 0`
  * `status = autoPlay ? playing : paused`
  * `updatedAt = Date.now()`
  * `version += 1`

广播：

```json
{
  "event": "ROOM_STATE_CHANGED",
  "roomId": "123456",
  "serverTime": 1710000000000,
  "version": 6,
  "data": {
    "action": "CHANGE_SONG",
    "room": {
      "roomId": "123456",
      "song": {},
      "status": "playing",
      "position": 0,
      "updatedAt": 1710000000000,
      "version": 6
    },
    "operator": {
      "userId": "10001",
      "nickname": "昔忆"
    }
  }
}
```

### 6. 拖动进度

事件名：

```txt
listen:seek
```

请求：

```json
{
  "requestId": "req_006",
  "roomId": "123456",
  "action": "SEEK",
  "data": {
    "position": 180000
  }
}
```

服务端处理：

* 校验操作权限。
* 校验 `position >= 0`。
* 如果当前歌曲有 `duration`，则 `position` 不应超过 `duration`。
* 保持当前 `status` 不变。
* 更新：

  * `position`
  * `updatedAt = Date.now()`
  * `version += 1`

广播：

```json
{
  "event": "ROOM_STATE_CHANGED",
  "roomId": "123456",
  "serverTime": 1710000000000,
  "version": 7,
  "data": {
    "action": "SEEK",
    "room": {
      "roomId": "123456",
      "song": {},
      "status": "playing",
      "position": 180000,
      "updatedAt": 1710000000000,
      "version": 7
    },
    "operator": {
      "userId": "10001",
      "nickname": "昔忆"
    }
  }
}
```

### 7. 歌曲播放结束

事件名：

```txt
listen:ended
```

请求：

```json
{
  "requestId": "req_007",
  "roomId": "123456",
  "action": "ENDED",
  "data": {
    "position": 240000
  }
}
```

服务端处理：

* 校验操作权限。
* 更新：

  * `status = ended`
  * `position`
  * `updatedAt = Date.now()`
  * `version += 1`

广播：

```json
{
  "event": "ROOM_STATE_CHANGED",
  "roomId": "123456",
  "serverTime": 1710000000000,
  "version": 8,
  "data": {
    "action": "ENDED",
    "room": {
      "roomId": "123456",
      "song": {},
      "status": "ended",
      "position": 240000,
      "updatedAt": 1710000000000,
      "version": 8
    },
    "operator": {
      "userId": "10001",
      "nickname": "昔忆"
    }
  }
}
```

### 8. 同步房间状态

事件名：

```txt
listen:sync
```

使用场景：

* 用户刚加入房间。
* 用户断线重连。
* 客户端发现本地播放状态可能不同步。
* 客户端主动请求当前房间状态。

请求：

```json
{
  "requestId": "req_008",
  "roomId": "123456",
  "action": "SYNC",
  "data": {}
}
```

ACK 返回：

```json
{
  "success": true,
  "code": 0,
  "msg": "success",
  "data": {
    "room": {
      "roomId": "123456",
      "roomName": "昔忆的听歌房",
      "hostUserId": "10001",
      "song": {},
      "status": "playing",
      "position": 120000,
      "maxPeople": 8,
      "currentPeople": 2,
      "memberOperation": true,
      "updatedAt": 1710000000000,
      "version": 8,
      "members": []
    },
    "serverTime": 1710000000500
  }
}
```

### 9. 修改房间设置

事件名：

```txt
listen:update_room
```

请求：

```json
{
  "requestId": "req_009",
  "roomId": "123456",
  "action": "UPDATE_ROOM",
  "data": {
    "roomName": "新的房间名",
    "maxPeople": 4,
    "memberOperation": false
  }
}
```

服务端处理：

* 只有房主可以修改房间设置。
* `maxPeople` 不能小于当前房间人数。
* `maxPeople` 不能超过系统配置上限。
* 更新：

  * `roomName`
  * `maxPeople`
  * `memberOperation`
  * `version += 1`

广播：

```json
{
  "event": "ROOM_UPDATED",
  "roomId": "123456",
  "serverTime": 1710000000000,
  "version": 9,
  "data": {
    "roomName": "新的房间名",
    "maxPeople": 4,
    "memberOperation": false,
    "operator": {
      "userId": "10001",
      "nickname": "昔忆"
    }
  }
}
```

### 10. 踢出成员

事件名：

```txt
listen:kick_member
```

请求：

```json
{
  "requestId": "req_010",
  "roomId": "123456",
  "action": "KICK_MEMBER",
  "data": {
    "targetUserId": "10002"
  }
}
```

服务端处理：

* 只有房主可以踢人。
* 不能踢自己。
* 移除目标用户。
* 让目标用户的 socket 离开房间。
* 广播成员被移除事件。

广播：

```json
{
  "event": "MEMBER_KICKED",
  "roomId": "123456",
  "serverTime": 1710000000000,
  "version": 10,
  "data": {
    "targetUserId": "10002",
    "operator": {
      "userId": "10001",
      "nickname": "昔忆"
    },
    "members": []
  }
}
```

### 11. 转让房主

事件名：

```txt
listen:transfer_host
```

请求：

```json
{
  "requestId": "req_011",
  "roomId": "123456",
  "action": "TRANSFER_HOST",
  "data": {
    "targetUserId": "10002"
  }
}
```

服务端处理：

* 只有房主可以转让。
* 目标用户必须在房间内。
* 更新 `hostUserId`。
* 更新成员角色。
* 广播房主变化事件。

广播：

```json
{
  "event": "HOST_TRANSFERRED",
  "roomId": "123456",
  "serverTime": 1710000000000,
  "version": 11,
  "data": {
    "oldHostUserId": "10001",
    "newHostUserId": "10002",
    "members": []
  }
}
```

## 十、服务端广播事件汇总

服务端需要支持以下广播事件：

```txt
ROOM_STATE_CHANGED     房间播放状态变化
ROOM_UPDATED           房间设置变化
MEMBER_JOINED          成员加入
MEMBER_LEFT            成员离开
MEMBER_KICKED          成员被踢出
HOST_TRANSFERRED       房主转让
ROOM_DESTROYED         房间销毁
ERROR_MESSAGE          错误消息
```

## 十一、操作权限规则

播放控制类操作包括：

```txt
PLAY
PAUSE
CHANGE_SONG
SEEK
ENDED
```

权限规则：

* 房主永远可以操作。
* 如果 `memberOperation = true`，成员可以操作。
* 如果 `memberOperation = false`，只有房主可以操作。
* 房间设置修改、踢人、转让房主只能房主操作。
* 用户必须在房间内才能发送房间操作。
* 服务端必须基于 socket 登录态判断用户身份，不信任客户端传来的用户 ID。

## 十二、房间号规则

房间号规则：

* 只允许数字。
* 长度 4-8 位。
* 默认生成 6 位随机数字。
* 创建时需要校验是否已存在。
* 如果用户自定义的房间号已存在，返回错误。
* 随机生成时如果冲突，需要重新生成。

错误示例：

```json
{
  "code": 400,
  "success": false,
  "msg": "房间号已存在",
  "errorMsg": "ROOM_ID_EXISTS"
}
```

## 十三、状态同步规则

为了保证两端播放进度一致，服务端每次状态变化时必须记录：

```txt
position
updatedAt
serverTime
version
```

客户端同步逻辑：

* 如果 `status = playing`：

  * 目标进度 = `position + (clientNow - updatedAt)`
* 如果 `status = paused`：

  * 目标进度 = `position`
* 如果误差小于 300ms，可以不处理。
* 如果误差在 300ms 到 1000ms，可以考虑轻微校准。
* 如果误差大于 1000ms，直接 seek 到目标进度。

服务端不需要持续高频广播播放进度，只需要在以下场景广播：

* 播放
* 暂停
* 切歌
* 拖动进度
* 播放结束
* 成员加入后返回当前状态
* 客户端主动请求 sync

## 十四、断线和重连

断开连接时：

* 如果用户还有其他 socket 连接，不要立刻移除用户。
* 如果用户没有其他连接，可以设置短暂离线状态。
* 可设置 30 秒宽限期。
* 30 秒内重连成功，恢复房间状态。
* 30 秒后仍未重连，则从房间移除。

如果房主离线：

* 短时间内不要立刻销毁房间。
* 超过宽限期仍未回来，可以自动转让房主给最早加入的成员。
* 如果房间没有成员，则销毁房间。

## 十五、数据存储策略

第一版可以使用内存 Map 存储房间状态：

```js
const rooms = new Map()
```

但代码结构需要预留 Redis 替换能力。

建议封装 `listenTogether.store`，不要在 socket 事件里直接操作 Map。

后续可以平滑替换成 Redis：

```txt
listen:room:{roomId}
listen:room:{roomId}:members
listen:user:{userId}:room
```

要求：

* store 层提供统一方法：

  * createRoom
  * getRoom
  * updateRoom
  * deleteRoom
  * joinRoom
  * leaveRoom
  * getUserRoom
  * setUserRoom
  * removeUserRoom

## 十六、错误处理

Socket ACK 错误返回格式统一：

```json
{
  "success": false,
  "code": 400,
  "msg": "没有操作权限",
  "errorMsg": "NO_PERMISSION"
}
```

常见错误码：

```txt
ROOM_NOT_FOUND          房间不存在
ROOM_FULL               房间人数已满
ROOM_ID_EXISTS          房间号已存在
INVALID_ROOM_ID         房间号格式错误
INVALID_ROOM_NAME       房间名格式错误
INVALID_MAX_PEOPLE      最大人数不合法
INVALID_SONG            歌曲对象不合法
INVALID_POSITION        播放进度不合法
NO_PERMISSION           没有权限
NOT_IN_ROOM             用户不在房间内
ALREADY_IN_ROOM         用户已经在房间内
TARGET_USER_NOT_FOUND   目标用户不在房间内
HOST_CANNOT_BE_KICKED   不能踢出房主
INTERNAL_ERROR          服务端错误
```

## 十七、需要实现的最小功能清单

第一阶段先实现：

* 查询一起听配置接口。
* 创建一起听房间接口。
* 加入房间 socket 事件。
* 离开房间 socket 事件。
* 播放 socket 事件。
* 暂停 socket 事件。
* 切歌 socket 事件。
* 拖动进度 socket 事件。
* 主动同步房间状态事件。
* 房间成员变化广播。
* 房间播放状态变化广播。
* 权限校验。
* SongDTO 校验。
* 房间人数上限校验。
* 断线重连基础处理。

暂时不需要实现：

* 好友系统。
* 私聊系统。
* 群聊系统。
* 语音通话。
* 音频流转发。
* 复杂队列歌单。
* Redis 多实例广播。

但代码结构需要为这些后续功能预留扩展空间。

## 十八、实现要求

* 代码需要模块化，不要把所有 socket 逻辑写在入口文件。
* 所有 socket 事件名统一使用 `listen:` 前缀。
* 所有服务端广播事件使用清晰的大写事件名。
* 不信任客户端传入的用户身份。
* 所有时间戳由服务端生成。
* 所有状态变化必须递增 `version`。
* 所有房间操作必须校验用户是否在房间内。
* 所有播放控制操作必须校验权限。
* 切歌和播放事件必须传完整 `song` 对象。
* `playUrl` 可选，允许为空。
* 房间最大人数必须受 `sys_config` 控制。
* 第一版允许使用内存 Map，但 store 层必须可替换为 Redis。
* 请给出完整后端代码实现，并说明前端应该如何调用这些 socket 事件。
