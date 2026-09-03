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
| `content` | `object` | 是 | 结构化公告内容，格式同创建公告 |
| `time` | `string` | 是 | 发布时间 |
| `publisher` | `string` | 是 | 发布人 |
| `enabled` | `boolean` | 否 | 是否允许客户端拉取；省略时保留原状态，停用不会删除公告或已读回执 |
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

公告内容保存为结构化 JSON，不支持 HTML。文字块可选 `bold: true`；高亮颜色支持快捷值 `neutral`、`primary`、`info`、`success`、`warning`、`danger`，以及 `#RGB`、`#RRGGBB`、`#RRGGBBAA` 十六进制颜色。内容按顺序连续排版，文字中的 `\n` 换行，图片自动独占一行，有动作的高亮文本显示为带下划线的可操作文本。图片必须先通过公告图片上传接口登记，再把返回的 `fileId` 写入 `image` 内容块。
