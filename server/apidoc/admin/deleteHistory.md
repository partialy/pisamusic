# 删除历史发布版本及关联文件

删除非当前的发布历史记录。此操作会软删除历史版本记录（写入 `deleted_at`），同步调用七牛云 API 真实删除该版本的安装包、`latest.yml` 和 blockmap 七牛对象，并将统一文件记录标记为 `deleted`。

- **请求方法**：`DELETE`
- **请求路径**：`/api/admin/update-history/:id`
- **需要鉴权**：是（`Authorization: Bearer <AdminToken>`）
- **加密模式**：端到端加密

---

## 请求参数

### Path Parameters

| 参数名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `id` | `string` | 是 | 待删除的非当前历史版本 ID |

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "版本记录及相关文件已删除",
  "data": {
    "historyId": "hist_old",
    "deletedFilesCount": 1
  },
  "success": true
}
```

### 常见错误响应

- `400 当前最新版本不可删除`
- `404 发布记录不存在`
