# 删除 PC 桌面设备记录

从数据库中物理删除指定的 PC 桌面设备记录。

- **请求方法**：`DELETE`
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
  "data": null,
  "success": true
}
```
