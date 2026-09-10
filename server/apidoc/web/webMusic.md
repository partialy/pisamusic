# 网页版音乐代理接口

为官网在线收听专区（网页版）提供的轻量级网关代理接口。由服务端统一签名代理请求音乐网关；播放取链统一经 `proxy-service`，搜索严格限制前 10 首，播放仅签发最低标准码率（128k），防爬虫并引导用户下载客户端。

- **需要鉴权**：否
- **加密模式**：明文白名单路径（`/api/web/music/*`）
- **限流**：`/url` 按单 IP 独立限流，默认 5 分钟最多 10 次；`/search` 与 `/lyric` 共享单 IP 限流桶，默认 5 分钟最多 30 次。具体数值可在管理后台“运行策略”调整；超限返回 HTTP `429` 与 `Retry-After` 响应头。

---

## 1. 音乐搜索

- **请求方法**：`GET`
- **请求路径**：`/api/web/music/search`

### Query Parameters

| 参数名 | 类型 | 必填 | 说明与限制 |
| :--- | :--- | :--- | :--- |
| `source` | `string` | 否 | 音乐源：`wy`（音源1，默认）、`kg`（音源2）、`kw`（音源3） |
| `keywords` | `string` | 是 | 搜索关键词 |

### 响应数据

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "songs": [
      {
        "id": "186016",
        "name": "晴天",
        "singer": "周杰伦",
        "album": "叶惠美",
        "duration": 269000,
        "cover": "https://p1.music.126.net/...",
        "source": "wy"
      }
    ],
    "total": 120,
    "hasMore": true
  },
  "success": true
}
```

---

## 2. 热门/推荐歌曲

- **请求方法**：`GET`
- **请求路径**：`/api/web/music/recommend`

### Query Parameters

| 参数名 | 类型 | 必填 | 说明与限制 |
| :--- | :--- | :--- | :--- |
| `source` | `string` | 否 | 音乐源：`wy`（默认）、`kg`、`kw` |

### 响应数据

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "songs": [
      {
        "id": "...",
        "name": "...",
        "singer": "...",
        "album": "...",
        "duration": 210000,
        "cover": "https://...",
        "source": "wy"
      }
    ]
  },
  "success": true
}
```

---

## 3. 获取试听播放地址（最低音质）

- **请求方法**：`GET`
- **请求路径**：`/api/web/music/url`

### Query Parameters

| 参数名 | 类型 | 必填 | 说明与限制 |
| :--- | :--- | :--- | :--- |
| `source` | `string` | 是 | 音乐源：`wy` / `kg` / `kw` |
| `id` | `string` | 是 | 歌曲 ID / Hash |

### 响应数据

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "url": "https://..."
  },
  "success": true
}
```

---

## 4. 获取歌曲歌词（LRC）

- **请求方法**：`GET`
- **请求路径**：`/api/web/music/lyric`

### Query Parameters

| 参数名 | 类型 | 必填 | 说明与限制 |
| :--- | :--- | :--- | :--- |
| `source` | `string` | 是 | 音乐源：`wy` / `kg` / `kw` |
| `id` | `string` | 是 | 歌曲 ID / Hash |

### 响应数据

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "lrc": "[00:00.00] 晴天 - 周杰伦\n[00:01.00]..."
  },
  "success": true
}
```
