# 公告已读回执

客户端确认阅读公告后提交已读回执。回执接口幂等：同一用户（或匿名身份）、平台和设备对同一公告重复提交时更新最近已读时间，不重复创建记录。

- **请求方法**：`POST`
- **请求路径**：`/api/announcements/:id/read`
- **需要鉴权**：必须设备消息凭证；可选 User Token
- **加密模式**：端到端加密

## 请求参数

### Request Headers

| Header | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `x-pm-device-token` | `string` | 是 | 设备上报接口返回的 30 天 `messageToken`；不能使用原始设备 UUID 或服务端设备 ID |
| `Authorization` | `string` | 否 | 登录用户的 `Bearer <UserToken>`；未登录时省略或传空值 |

### Path Parameters

| 参数名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `id` | `string` | 是 | 公告 ID |

### Request Body (JSON)

| 字段名 | 类型 | 必填 | 说明与限制 |
| :--- | :--- | :--- | :--- |
| `platform` | `string` | 是 | 客户端平台，只能为 `android` 或 `desktop` |

## 处理规则

- 服务端使用当前服务器时间记录 `readAt`，不信任客户端时间。
- 已登录回执记录用户公开信息快照；未登录回执的用户信息为空。
- 设备信息记录平台、设备展示字段、系统/应用版本和架构等快照，不记录设备消息 token。
- 公告停用后仍允许已经展示过的客户端补交回执。
- 公告不存在、设备凭证无效、平台不匹配或 User Token 无效时拒绝请求。

## 响应数据

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "announcementId": "anno_202608",
    "readAt": 1788000000123,
    "recorded": true
  },
  "success": true
}
```
