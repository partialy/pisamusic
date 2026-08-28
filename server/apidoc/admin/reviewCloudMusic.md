# 审核网盘音乐 (管理后台)

管理员对处于 `pending_review` 或 `rejected` 状态的网盘曲目执行审核操作（通过、拒绝、重新送审）。

- **请求方法**：`POST`
- **请求路径**：`/api/admin/cloud-music/:uuid/review`
- **需要鉴权**：是（管理员 JWT）
- **加密模式**：端到端加密

---

## 请求参数

### Path Parameters

| 参数名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `uuid` | `string` | 是 | 网盘曲目 UUID |

### Request Body (JSON)

审核通过示例：

```json
{
  "decision": "approve",
  "targetStatus": "active"
}
```

审核拒绝示例：

```json
{
  "decision": "reject",
  "reason": "音频质量不佳或包含杂音"
}
```

重新送审（设为待审核）示例：

```json
{
  "decision": "resubmit",
  "reason": "已重新补充元数据"
}
```

违规销毁 (直接打死留底) 示例：

```json
{
  "decision": "ban_destroy",
  "reason": "包含违法侵权内容，物理删除文件并永久留底"
}
```

---

## 响应数据

### 成功响应

返回更新后的完整 `CloudMusicTrack` 对象。
