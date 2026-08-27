# 获取 PC 桌面设备详情

根据设备 ID 查询该 PC 桌面设备的详细系统信息与封禁状态。

- **请求方法**：`GET`
- **请求路径**：`/api/admin/desktop-device/:id`
- **需要鉴权**：是（`Authorization: Bearer <AdminToken>`）
- **加密模式**：端到端加密

---

## 请求参数

### Path Parameters

| 参数名 | 类型 | 必填 | 说明 |
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
    "fingerprint": "desktop_fp...",
    "deviceName": "DESKTOP-PARTIAL",
    "hostname": "DESKTOP-PARTIAL",
    "osName": "Windows 11 Pro",
    "osVersion": "10.0.22631",
    "platform": "win32",
    "arch": "x64",
    "appVersion": "1.5.0",
    "locked": false,
    "lockEndTime": null,
    "firstSeenAt": 1695000000000,
    "lastActiveAt": 1700000000000,
    "firstSeenIp": "120.24.0.2",
    "lastSeenIp": "120.24.0.2",
    "extraInfo": {}
  },
  "success": true
}
```
