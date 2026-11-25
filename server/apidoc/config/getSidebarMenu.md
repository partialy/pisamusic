# 获取侧栏动态菜单配置

用于 Android 客户端获取侧栏内置项显隐/覆盖配置、多区块横栏入口与四宫格入口的公开配置（亦会随 `POST /api/config/startup` 冷启动聚合下发）。

- **请求方法**：`GET`
- **请求路径**：`/api/config/sidebar-menu`
- **需要鉴权**：无（默认走系统 AES-GCM 加密链路）

---

## 请求参数

### Query 参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| `schemaVersion` | `number` | 否 | `1` | 协议版本号。传 `2` 返回完整 v2 结构；`< 2`（旧客户端）返回空配置壳防止解析异常 |

---

## 响应数据（`schemaVersion=2`）

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "schemaVersion": 2,
    "builtinItems": [
      {
        "key": "import_playlists",
        "enabled": true,
        "name": "",
        "iconType": "default",
        "iconValue": ""
      },
      {
        "key": "link_import",
        "enabled": true,
        "name": "",
        "iconType": "default",
        "iconValue": ""
      },
      {
        "key": "sleep_timer",
        "enabled": true,
        "name": "",
        "iconType": "default",
        "iconValue": ""
      },
      {
        "key": "theme",
        "enabled": true,
        "name": "",
        "iconType": "default",
        "iconValue": ""
      }
    ],
    "listSections": [
      {
        "id": "sec_1",
        "enabled": true,
        "sortOrder": 0,
        "title": "活动",
        "items": [
          {
            "id": "activity-1",
            "sortOrder": 0,
            "name": "活动中心",
            "iconType": "svg",
            "iconValue": "<svg viewBox=\"0 0 24 24\">...</svg>",
            "badgeType": "dot_once",
            "subtitleText": "",
            "badgeVersion": 1,
            "openType": "web",
            "url": "https://example.com",
            "actionKey": ""
          }
        ]
      }
    ],
    "listSection": {
      "enabled": true,
      "title": "活动",
      "items": []
    },
    "gridSection": {
      "enabled": true,
      "position": "top",
      "items": [
        {
          "id": "grid-1",
          "sortOrder": 0,
          "name": "发现音乐",
          "iconType": "preset",
          "iconValue": "play",
          "badgeType": "dot_always",
          "subtitleText": "",
          "badgeVersion": 1,
          "openType": "app_action",
          "url": "",
          "actionKey": "discover"
        }
      ]
    },
    "updatedAt": 1700000000000
  },
  "success": true
}
```

### 字段说明

- `builtinItems`：固定顺序 `import_playlists`（导入歌单）、`link_import`（链接导入）、`sleep_timer`（定时关闭）、`theme`（主题外观）；`name` 为空时客户端使用默认名称，`iconType` 支持 `default` | `none` | `image` | `svg` | `preset`。
- `listSections`：有序横栏区块列表；区块 `title` 非空时客户端显示分组小字标题，为空时显示顶部分割线。
- `iconType`：`none`（仅横栏）| `image`（HTTPS 图片 URL）| `svg`（`<svg>` 源码）| `preset`（预置图标 key）。
- `badgeType`：`none` | `text`（仅横栏）| `dot_once`（点击后本地消除）| `dot_always`（常驻红点）。
- `badgeVersion`：一次性红点版本号，客户端按 `id:badgeVersion` 记录消除状态。
- `openType`：`web`（带顶栏网页）| `fullscreen_web`（全屏无顶栏网页）| `app_action`（打开 App 原生页面或功能）。
- `actionKey`：当 `openType = "app_action"` 时生效，支持：`discover`、`announcements`、`check_update`、`feedback`、`scan`、`settings`、`login`、`profile`、`about`、`share_app`、`data_management`、`download_settings`、`playback_settings`。
- `gridSection.position`：`top`（内置列表上方）| `bottom`（列表最下方）。
