# 获取系统公告列表

获取客户端启动或关于页展示的系统公告列表。

服务端只返回 `enabled=true` 的公告。后台停用公告后，客户端不会再拉取该公告；重新启用后恢复返回。停用不会删除公告或历史已读回执。

- **请求方法**：`GET`
- **请求路径**：`/api/config/announcements`
- **需要鉴权**：否
- **加密模式**：明文白名单路径

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "ok",
  "data": [
    {
      "id": "anno_1",
      "content": {
        "schemaVersion": 1,
        "blocks": [
      { "type": "text", "text": "PisaMusic v2.1.0 现已发布，欢迎体验全新一起听功能！", "bold": true }
        ]
      },
      "time": "2026-08-25",
      "publisher": "PisaMusic 团队",
      "enabled": true,
      "confirmText": "我知道了",
      "showEveryTime": false,
      "showGotoButton": true,
      "gotoUrl": "https://pisamusic.partialy.cn"
    }
  ],
  "success": true
}
```

### 响应字段说明

| 字段名 | 类型 | 说明 |
| :--- | :--- | :--- |
| `id` | `string` | 公告唯一 ID |
| `content` | `object` | 结构化公告内容，按顺序连续排版，支持文字换行、图片和内联高亮动作 |
| `time` | `string` | 公告发布时间 |
| `publisher` | `string` | 发布者名称 |
| `enabled` | `boolean` | 是否启用；公开接口只返回启用状态的公告 |
| `confirmText` | `string` | 弹窗确认按钮文本 |
| `showEveryTime` | `boolean` | 是否每次启动都强制弹窗提醒 |
| `showGotoButton` | `boolean` | 是否显示跳转链接按钮 |
| `gotoUrl` | `string` | 点击跳转按钮后打开的外链 URL |

文字块可选 `bold: true`。高亮颜色可使用 `neutral`、`primary`、`info`、`success`、`warning`、`danger` 或十六进制颜色（`#RGB`、`#RRGGBB`、`#RRGGBBAA`）；有动作的高亮文本在客户端显示为带下划线的可操作文本。
