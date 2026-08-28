# 获取网盘音乐封面

提供稳定、公开可加载的曲目封面入口。仅允许未删除的 `active` 与 `disabled` 曲目访问；上传或内嵌封面会即时重定向到七牛私有签名 URL，没有可用封面时重定向到默认 SVG 封面。

- **请求方法**：`GET`
- **请求路径**：`/api/cloud-music/tracks/:uuid/cover`
- **需要鉴权**：否
- **加密模式**：明文重定向
- **缓存策略**：`Cache-Control: no-store`

---

## 请求参数

### Path Parameters

| 参数名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `uuid` | `string` | 是 | 网盘曲目 UUID |

### 请求示例

```http
GET /api/cloud-music/tracks/8c919a71-6c39-4d87-9eb5-c26693836101/cover
```

---

## 响应数据

成功时返回 `302 Found`，`Location` 为即时签发的私有封面 URL，或 `/static/cloud-music/default-cover.svg`。封面 URL 不会出现在公开曲目 DTO 中。

### 错误响应

- **400 Bad Request**：曲目 UUID 为空。
- **404 Not Found**：曲目不存在、已删除或非公开状态。
