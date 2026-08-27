# 获取管理端试听地址 (管理后台)

获取任意未删除曲目的管理端试听音频与封面/歌词临时访问地址，支持对 `temp`、`pending_review`、`rejected` 状态的曲目进行试听审核。

- **请求方法**：`GET`
- **请求路径**：`/api/admin/cloud-music/:uuid/preview-url`
- **需要鉴权**：是（管理员 JWT）
- **加密模式**：端到端加密

---

## 请求参数

### Path Parameters

| 参数名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `uuid` | `string` | 是 | 网盘曲目 UUID |

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "audioUrl": "https://pm.hs.partialy.cn/.../audio.flac?e=...&token=...",
    "audioExpiresAt": 1700003600000,
    "coverUrl": "https://pm.hs.partialy.cn/.../cover-uploaded.jpg?e=...&token=...",
    "lyricsUrl": "https://pm.hs.partialy.cn/.../lyrics.lrc?e=...&token=...",
    "lyricsExpiresAt": 1700003600000
  },
  "success": true
}
```
