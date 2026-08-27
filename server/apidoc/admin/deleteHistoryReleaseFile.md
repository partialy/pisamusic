# 仅删除发布版本关联的安装包文件

仅删除指定发布历史记录关联的七牛安装包对象与文件记录状态，保留发布日志与版本历史。若该安装包正在被当前 Android / PC 发布引用，会自动清空下载地址并关闭下载状态。

- **请求方法**：`DELETE`
- **请求路径**：`/api/admin/update-history/:id/release-file`
- **需要鉴权**：是（`Authorization: Bearer <AdminToken>`）
- **加密模式**：端到端加密

---

## 请求参数

### Path Parameters

| 参数名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `id` | `string` | 是 | 历史记录 ID |

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "安装包已删除",
  "data": {
    "releaseFile": {
      "id": "f_1",
      "status": "deleted"
    }
  },
  "success": true
}
```
