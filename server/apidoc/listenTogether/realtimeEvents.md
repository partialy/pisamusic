# 一起听 Socket.IO 实时通信协议

一起听功能的实时音视频状态同步、房间广播和信令控制基于 Socket.IO 构建。

- **连接端点**：`ws://<host>:<port>` 或 `wss://<host>`（路径 `/socket.io/`）
- **鉴权方式**：连接握手时在 `auth.token` 或 `headers.authorization` 传入 `Bearer <UserToken>`

---

## 1. 客户端发送事件 (Client -> Server)

| 事件名 | 参数载荷 | 说明 |
| :--- | :--- | :--- |
| `listen:join_room` | `{ roomId: string }` | 加入指定房间，服务端向房间广播 `MEMBER_JOINED` |
| `listen:leave_room` | `{ roomId: string }` | 离开房间，服务端向房间广播 `MEMBER_LEFT` 或 `ROOM_DESTROYED` |
| `listen:change_song` | `{ song: object, transitionId?: string, queueItemId?: string }` | 房主或有权限成员发起切歌，服务端广播 `CHANGE_SONG` |
| `listen:play` | `{ songRef: { source, id }, position: number }` | 开始/恢复播放，服务端广播 `PLAY` |
| `listen:pause` | `{ songRef: { source, id }, position: number }` | 暂停播放，服务端广播 `PAUSE` |
| `listen:seek` | `{ songRef: { source, id }, position: number }` | 进度跳转，服务端广播 `SEEK` |
| `listen:ended` | `{ songRef: { source, id } }` | 歌曲自然播放结束通知 |
| `listen:sync_progress` | `{ songRef: { source, id }, position: number }` | 房主定期同步基准播放进度 |
| `listen:queue` | `{ event: string, data: any }` | 播放队列成员间转发同步（服务端不落库持久化） |
| `listen:sync_request` | `{ roomId: string }` | 成员请求重新同步房间完整状态，服务端单播回复 `SYNC_RESPONSE` |

---

## 2. 服务端广播事件 (Server -> Client)

所有广播均封装为统一广播结构体：

```typescript
interface ListenTogetherBroadcast<T> {
  event: string;      // 事件名称
  roomId: string;     // 房间号
  serverTime: number; // 服务端精准当前毫秒时间戳（用于客户端对齐时钟）
  version: number;    // 房间版本号
  data: T;            // 业务载荷
}
```

### 核心广播事件列表

| 广播事件名 | 载荷内容 (`data`) | 触发场景与客户端处理 |
| :--- | :--- | :--- |
| `MEMBER_JOINED` | `{ member, members }` | 新成员加入房间 |
| `MEMBER_LEFT` | `{ userId, member, newHostUserId, members }` | 成员离开或掉线超时 |
| `HOST_TRANSFERRED`| `{ oldHostUserId, newHostUserId, members }` | 房主转移给下一位资历最老的在线成员 |
| `ROOM_DESTROYED` | `{ room, removedUserId }` | 房间所有成员退出，房间自动销毁 |
| `CHANGE_SONG` | `{ song, operator, transitionId, queueItemId }` | 切歌指令，客户端切歌并预加载音频源 |
| `PLAY` | `{ position, operator, serverTime }` | 播放指令 |
| `PAUSE` | `{ position, operator, serverTime }` | 暂停指令 |
| `SEEK` | `{ position, operator, serverTime }` | 进度拖拽指令 |
| `PROGRESS_SYNC` | `{ position, serverTime, status }` | 房主周期性校准广播 |
| `SYNC_RESPONSE` | `{ room, serverTime }` | 房间快照全量对齐 |
| `QUEUE_EVENT` | `{ ...queueEventData }` | 房间共享队列同步 |
