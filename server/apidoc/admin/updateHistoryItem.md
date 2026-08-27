# 修改已发布的历史版本

修改历史版本记录的内容或重新关联安装包文件。若修改的是当前生效的最新版本，系统会自动同步更新当前发布配置。

- **请求方法**：`PUT`
- **请求路径**：`/api/admin/update-history/:id`
- **需要鉴权**：是（`Authorization: Bearer <AdminToken>`）
- **加密模式**：端到端加密

---

## 请求参数

### Path Parameters

| 参数名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `id` | `string` | 是 | 发布历史记录 ID |

### Request Body (JSON)

| 字段名 | 类型 | 必填 | 说明与限制 |
| :--- | :--- | :--- | :--- |
| `platform` | `string` | 是 | 平台（必须与原记录一致） |
| `latestVersion` | `string` | 是 | 版本号 |
| `updateTime` | `string` | 是 | 发布时间 |
| `forceUpdate` | `boolean` | 否 | 是否强制更新 |
| `downloadUrl` | `string` | 是 | 下载链接 |
| `officialUrl` | `string` | 是 | 官网链接 |
| `updateContent` | `string` | 是 | 更新日志 |
| `platformLabel` | `string` | 否 | 平台标签 |
| `fileSizeText` | `string` | 否 | 文件大小文本 |
| `available` | `boolean` | 否 | 是否开放下载 |
| `releaseFileId` | `string` | 否 | 关联的文件记录 ID |

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "发布记录已保存",
  "data": {
    "id": "hist_1",
    "platform": "desktop",
    "update": {
      /* 更新后的版本对象 */
    }
  },
  "success": true
}
```
