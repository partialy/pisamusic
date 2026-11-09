# Server 工作区入口

继承[根通用规范](../AGENTS.md)。本文件只负责 `server/` 内的职责导航，避免 Admin、官网与后端规范互相干扰。

| 当前任务 | 必读规范 |
| --- | --- |
| `src/`、后端脚本、数据库、存储、实时通信、服务配置、`apidoc/` | [Server 后端规范](agents/SERVER.md) |
| `admin/` 管理后台页面、表单、图表、交互 | [Admin 规范](admin/AGENTS.md) |
| `frontend/`、`frontend-html/`、官网构建与 SEO | [官网规范](agents/WEBSITE.md) |
| 跨端接口、鉴权或业务契约 | [跨模块契约](../agents/CROSS_MODULE.md)对应章节，以及受影响模块规范 |

- 只读取当前任务涉及的规范；纯 Admin / 官网任务无需加载后端细则。
- Admin 调整同时需要新增或修改接口时，再读取后端规范并同步接口文档。
- `data/`、`uploads/` 为运行数据，`dist/`、`web-admin/`、`web-user/` 为构建产物，默认不纳入源码变更；不要擅自清理数据。
- 各模块详细规则维护在对应文件；此入口只更新职责与路径。
