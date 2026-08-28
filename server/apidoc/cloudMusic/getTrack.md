# 获取网盘音乐详情

获取指定网盘曲目的公开详情信息。仅允许读取 `active`（可用）与 `disabled`（禁用）状态的曲目，其他状态或已删除曲目返回 404。

- **请求方法**：`GET`
- **请求路径**：`/api/cloud-music/tracks/:uuid`
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
GET /api/cloud-music/tracks/8c919a71-6c39-4d87-9eb5-c26693836101
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
    "title": "晴天",
    "artist": "周杰伦",
    "album": "叶惠美",
    "durationMs": 269000,
    "format": "flac",
    "playable": true,
    "cover": {
      "source": "uploaded",
      "url": "/api/cloud-music/tracks/8c919a71-6c39-4d87-9eb5-c26693836101/cover"
    },
    "lyrics": {
      "format": "lrc",
      "fileName": "晴天.lrc"
    },
    "createdAt": 1700000000000,
    "updatedAt": 1700000000000
  },
  "success": true
}
```

### 错误响应

- **404 Not Found**：曲目不存在、已删除或非公开状态。
