# 查询 PC 桌面端设备状态

根据 PC 设备 ID 查询该电脑设备的基本平台信息与封禁锁定状态。

- **请求方法**：`GET`
- **请求路径**：`/api/device/desktop/:id`
- **需要鉴权**：否
- **加密模式**：端到端加密

---

## 请求参数

### Path Parameters

| 参数名 | 类型 | 必填 | 说明与限制 |
| :--- | :--- | :--- | :--- |
| `id` | `string` | 是 | PC 设备 UUID |

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    "locked": false,
    "lockEndTime": null,
    "lastActiveAt": 1700000000000,
    "firstSeenAt": 1695000000000,
    "platform": "win32",
    "arch": "x64",
    "appVersion": "1.5.0"
  },
  "success": true
}
```

### 常见错误响应

```json
{
  "code": 404,
  "msg": "Not Found",
  "data": null,
  "success": false
}
```
