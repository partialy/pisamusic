# 预览历史版本删除影响

在删除非当前最新历史版本前，预检并列出该版本将被级联删除的关联安装包、PC 自动更新文件（EXE、latest.yml、blockmap）及引用的七牛对象列表。当前最新版本不允许删除。

- **请求方法**：`GET`
- **请求路径**：`/api/admin/update-history/:id/delete-preview`
- **需要鉴权**：是（`Authorization: Bearer <AdminToken>`）
- **加密模式**：端到端加密

---

## 请求参数

### Path Parameters

| 参数名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `id` | `string` | 是 | 待预检的历史版本记录 ID |

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "history": {
      "id": "hist_old",
      "platform": "desktop",
      "version": "1.4.0"
    },
    "isCurrent": false,
    "willDeleteFiles": [
      {
        "id": "f_old_exe",
        "fileName": "PisaMusic-Setup-1.4.0.exe",
        "objectKey": "pisamusic/releases/desktop/1700000000000_PisaMusic-Setup-1.4.0.exe",
        "fileSize": 90000000,
        "usageType": "release-package"
      }
    ]
  },
  "success": true
}
```

### 常见错误响应

- `400 当前最新版本不可删除`：必须先发布替代版本后方可删除历史版本。
