# 获取一起听配置

获取一起听功能的全局限制与规则配置（如最大房间人数上限、房间号生成规则等）。

- **请求方法**：`GET`
- **请求路径**：`/api/listen-together/config`
- **需要鉴权**：否
- **加密模式**：明文白名单路径

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "maxPeopleLimit": 20,
    "defaultMaxPeople": 10,
    "roomIdMinLength": 4,
    "roomIdMaxLength": 16,
    "roomIdPattern": "^[0-9]{4,16}$"
  },
  "success": true
}
```

### 响应字段说明

| 字段名 | 类型 | 说明 |
| :--- | :--- | :--- |
| `maxPeopleLimit` | `number` | 后台允许配置的最大房间人数上限 |
| `defaultMaxPeople` | `number` | 默认推荐房间人数（10人） |
| `roomIdMinLength` | `number` | 房间号最小长度 |
| `roomIdMaxLength` | `number` | 房间号最大长度 |
| `roomIdPattern` | `string` | 房间号正则表达式规则 |
