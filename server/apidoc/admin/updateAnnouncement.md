# 修改公告

更新管理后台已存在的某条公告信息。

- **请求方法**：`PUT`
- **请求路径**：`/api/admin/announcements/:id`
- **需要鉴权**：是（`Authorization: Bearer <AdminToken>`）
- **加密模式**：端到端加密

---

## 请求参数

### Path Parameters

| 参数名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `id` | `string` | 是 | 待修改的公告 ID |

### Request Body (JSON)

| 字段名 | 类型 | 必填 | 说明与限制 |
| :--- | :--- | :--- | :--- |
| `content` | `string` | 是 | 公告内容 |
| `time` | `string` | 是 | 发布时间 |
| `publisher` | `string` | 是 | 发布人 |
| `confirmText` | `string` | 是 | 确认按钮文本 |
| `showEveryTime` | `boolean` | 否 | 是否每次启动弹窗 |
| `showGotoButton` | `boolean` | 否 | 是否显示跳转按钮 |
| `gotoUrl` | `string` | 否 | 跳转链接 |

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "公告已保存",
  "data": [
    /* 保存后的完整公告列表数组 */
  ],
  "success": true
}
```
