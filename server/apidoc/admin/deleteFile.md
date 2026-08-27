# 删除统一文件记录及七牛对象

在后台文件管理中删除指定的七牛文件记录。调用七牛云 API 真实物理删除存储对象，本地数据记录标记为 `deleted`，并自动清理历史发布引用 `update_history.release_file_id`、活跃自动更新引用以及当前生效版本的下载链接。

- **请求方法**：`DELETE`
- **请求路径**：`/api/admin/files/:id`
- **需要鉴权**：是（`Authorization: Bearer <AdminToken>`）
- **加密模式**：端到端加密

---

## 请求参数

### Path Parameters

| 参数名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `id` | `string` | 是 | 统一文件记录 ID |

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "文件已删除",
  "data": {
    "file": {
      "id": "f_desktop_150_exe",
      "status": "deleted",
      "deletedAt": 1700000000000
    }
  },
  "success": true
}
```

### 常见错误响应

```json
{
  "code": 404,
  "msg": "文件记录不存在",
  "data": null,
  "success": false
}
```
