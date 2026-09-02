# 安全解散在线一起听房间

管理后台安全解散指定的在线房间。服务端会同步通知所有房间内成员广播 `ROOM_DESTROYED` 事件、清理所有成员的房间映射和离线定时器，并在历史表中记录 `end_reason="admin_dissolved"` 与操作管理员用户名。

- **请求方法**：`POST`
- **请求路径**：`/api/admin/listen-together/online/:recordId/dissolve`
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
    "endedAt": 1700000300000
  },
  "success": true
}
```

### 错误响应

```json
{
  "code": 404,
  "msg": "房间不存在或已结束",
  "data": null,
  "success": false
}
```
