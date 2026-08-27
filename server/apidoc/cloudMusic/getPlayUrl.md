# 获取网盘音乐播放地址

获取网盘曲目的短期音频播放临时签名 URL（有效期 1 小时）。仅允许 `active` 状态的曲目取链；`disabled` 状态返回 403，其他非公开或不存在状态返回 404。

- **请求方法**：`GET`
- **请求路径**：`/api/cloud-music/tracks/:uuid/play-url`
- **需要鉴权**：否
- **加密模式**：端到端加密

---

## 请求参数

### Path Parameters

| 参数名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `uuid` | `string` | 是 | 网盘曲目 UUID |

### 请求示例

```http
GET /api/cloud-music/tracks/8c919a71-6c39-4d87-9eb5-c26693836101/play-url
```

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "uuid": "8c919a71-6c39-4d87-9eb5-c26693836101",
    "source": "cloud",
    "url": "https://pm.hs.partialy.cn/pisamusic/cloud-music/202608/8c919a71.../audio.flac?e=1700003600&token=...",
    "expiresAt": 1700003600000
  },
  "success": true
}
```

### 错误响应

- **403 Forbidden**：`{"code": "CLOUD_MUSIC_DISABLED", "msg": "曲目已禁用"}`
- **404 Not Found**：曲目不存在、未就绪或非公开状态。
