# 侧栏菜单管理（Admin）

管理后台「运营与发布 → 侧栏菜单」配置接口，支持横栏入口与九宫格入口增删改排序、图标直传七牛或 SVG/预置图标配置。

- **鉴权要求**：Admin JWT + 系统 AES-GCM 加密

## 接口列表

| 接口 | Method | 路径 | 说明 |
| :--- | :--- | :--- | :--- |
| 读取配置 | `GET` | `/api/admin/sidebar-menu` | 读取横栏与九宫格完整配置（含未启用项及 `iconUrl`） |
| 保存配置 | `PUT` | `/api/admin/sidebar-menu` | 全量校验并保存配置，同步更新 `file_records.referenced_by` |
| 获取图标上传凭证 | `POST` | `/api/admin/sidebar-menu/icon/upload-token` | 传入 `{ fileName, fileSize, mimeType }`，返回七牛直传凭证 |
| 核验并登记图标 | `POST` | `/api/admin/sidebar-menu/icon/complete` | 传入 `{ key, bucket }`，核验后登记 `file_records(usage_type='sidebar-menu-icon')` |
