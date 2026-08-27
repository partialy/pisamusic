# 创建公告

在管理后台新增一条系统公告。

- **请求方法**：`POST`
- **请求路径**：`/api/admin/announcements`
- **需要鉴权**：是（`Authorization: Bearer <AdminToken>`）
- **加密模式**：端到端加密

---

## 请求参数

### Request Headers

| Header | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `Authorization` | `string` | 是 | 格式为 `Bearer <admin_token>` |

### Request Body (JSON)

| 字段名 | 类型 | 必填 | 说明与限制 |
| :--- | :--- | :--- | :--- |
| `id` | `string` | 是 | 公告唯一 ID（最多 120 字符） |
| `content` | `string` | 是 | 公告富文本/正文（最多 50000 字符） |
| `time` | `string` | 是 | 发布时间显示文本（如 "2026-08-25"） |
| `publisher` | `string` | 是 | 发布者名称（如 "管理员"） |
| `confirmText` | `string` | 是 | 客户端弹窗确认按钮文案（如 "确定"） |
| `showEveryTime` | `boolean` | 否 | 是否每次启动均弹窗 |
| `showGotoButton` | `boolean` | 否 | 是否显示外链跳转按钮 |
| `gotoUrl` | `string` | 否 | 跳转链接 URL |

### 请求示例

```json
{
  "id": "anno_202608",
  "content": "全新版本上线，欢迎体验！",
  "time": "2026-08-27",
  "publisher": "PisaMusic",
  "confirmText": "我知道了",
  "showEveryTime": false,
  "showGotoButton": false,
  "gotoUrl": ""
}
```

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
