# 获取系统公告列表

获取客户端启动或关于页展示的系统公告列表。

服务端只返回 `enabled=true` 的公告。后台停用公告后，客户端不会再拉取该公告；重新启用后恢复返回。停用不会删除公告或历史已读回执。

- **请求方法**：`GET`
- **请求路径**：`/api/config/announcements`
- **需要鉴权**：否
- **加密模式**：明文白名单路径

## 查询参数

| 参数 | 默认 | 筛选规则 |
| --- | --- | --- |
| `announcementVersion` | 1 | 正整数，接收该协议版本及以下的启用公告 |
| `appVersion` | 全部版本 | 如 v2.2.2，兼容 v 前缀，按语义版本比较 |
| `type` | all | all、mobile、pc；指定端同时接收平台为 all 的公告 |

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
| `announcementVersion` | `number` | 公告协议版本，历史为 1，新建为 2 |
| `platform` | `all / mobile / pc` | 投放平台 |
| `versionRule` | `object` | App 版本规则 |
| `waitSeconds` | `number` | 自动弹出确认按钮的等待秒数，非负整数，默认 0 |
| `gotoAction` | `object / null` | 前往动作，历史公告可继续使用 gotoUrl |

版本规则采用 mode 字段。all 表示不限，current 使用 versions 中按 mobile、pc 固化的具体版本，specified 使用 versions 数组，gte 和 lte 使用 version 作为含边界的基线。

前往动作支持 type=url，配合 openMode=browser 或 app。应用内可用 showHeaderBar 控制顶栏，默认显示。type=page 配合 page=discover 或 settings，也可以用作高亮块动作。

文字块支持 bold、italic 和 color。文字颜色可选 neutral、primary、info、success、warning、danger 或 CSS 十六进制色值。
