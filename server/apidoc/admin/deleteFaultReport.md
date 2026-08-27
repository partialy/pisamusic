# 删除故障上报批次及日志

从数据库中级联删除指定的故障上报批次及其包含的所有日志明细。

- **请求方法**：`DELETE`
- **请求路径**：`/api/admin/fault-reports/:id`
- **需要鉴权**：是（`Authorization: Bearer <AdminToken>`）
- **加密模式**：端到端加密

---

## 请求参数

### Path Parameters

| 参数名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `id` | `string` | 是 | 待删除的批次 UUID |

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "故障上报已删除",
  "data": null,
  "success": true
}
```
