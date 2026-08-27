# 预登记网盘音乐资产 (管理后台)

为已存在的曲目新增或替换封面、歌词资产。先在数据库写入 `pending` 状态的资产和文件记录，再签发对应的固定 Key 七牛上传凭证。

- **请求方法**：`POST`
- **请求路径**：`/api/admin/cloud-music/:uuid/assets/:kind/reserve`
- **需要鉴权**：是（管理员 JWT）
- **加密模式**：端到端加密

---

## 请求参数

### Path Parameters

| 参数名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `uuid` | `string` | 是 | 网盘曲目 UUID |
| `kind` | `string` | 是 | 资产类型，可选：`cover-uploaded`（手动封面）或 `lyrics`（歌词） |

### Request Body (JSON)

| 字段名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `fileName` | `string` | 是 | 原始文件名 |
| `fileSize` | `number` | 是 | 文件大小（字节） |
| `mimeType` | `string` | 是 | MIME 类型 |

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "assetId": "asset_cover_456",
    "fileRecordId": "file_cover_456",
    "kind": "cover-uploaded",
    "key": "pisamusic/cloud-music/202608/8c919a71.../cover-uploaded.jpg",
    "uploadToken": "qiniu_token...",
    "uploadUrl": "https://upload.qiniup.com"
  },
  "success": true
}
```
