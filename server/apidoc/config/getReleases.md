# 获取双端最新发布信息

获取 Android 端与 PC 桌面端最新的版本发布信息与下载地址，官网及客户端多端更新检查推荐使用此接口。

- **请求方法**：`GET`
- **请求路径**：`/api/config/releases`
- **需要鉴权**：否
- **加密模式**：明文返回

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "android": {
      "latestVersion": "2.1.0",
      "updateTime": "2026-08-20",
      "forceUpdate": false,
      "downloadUrl": "https://pisamusic.partialy.cn/api/config/release-files/f_android_123/download",
      "officialUrl": "https://pisamusic.partialy.cn",
      "updateContent": "1. 优化播放体验\n2. 修复已知问题",
      "platformLabel": "Android",
      "fileSizeText": "45.8 MB",
      "available": true
    },
    "desktop": {
      "latestVersion": "1.5.0",
      "updateTime": "2026-08-22",
      "forceUpdate": false,
      "downloadUrl": "https://pisamusic.partialy.cn/api/config/release-files/f_desktop_456/download",
      "officialUrl": "https://pisamusic.partialy.cn",
      "updateContent": "1. 新增无损音质缓存\n2. 优化本地歌单加载",
      "platformLabel": "PC 桌面版",
      "fileSizeText": "89.2 MB",
      "available": true
    }
  },
  "success": true
}
```

### 响应字段说明

| 字段名 | 类型 | 说明 |
| :--- | :--- | :--- |
| `android` | `object` | Android 端发布信息 |
| `desktop` | `object` | PC 桌面端发布信息 |
| `*.latestVersion` | `string` | 最新版本号 |
| `*.updateTime` | `string` | 更新时间 |
| `*.forceUpdate` | `boolean` | 是否强制更新 |
| `*.downloadUrl` | `string` | 安装包下载 URL（已转为绝对地址） |
| `*.officialUrl` | `string` | 官网地址 |
| `*.updateContent` | `string` | 版本更新日志 |
| `*.platformLabel` | `string` | 平台显示标签 |
| `*.fileSizeText` | `string` | 安装包文件大小说明 |
| `*.available` | `boolean` | 是否开放下载 |
