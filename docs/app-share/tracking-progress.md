# App 分享追踪实施进度

- 起点：dev / 5ec3018；用户授权按 tracking-plan.md 实施并分步提交，不推送。
- 原有变更：pm/app/src/main/res/layout/layout_listen_together_bottom_sheet.xml；未跟踪 ic_qq_24.xml、ic_wechat_24.xml，禁止纳入提交。
- Server：实现完成；TypeScript构建、存储综合测试与HTTP综合联调通过，独立审查通过。
- Android：实现完成；assembleDebug通过，收紧离线缓存异常判断后compileDebugKotlin通过，独立审查通过。
- Web/Admin：实现完成；两端构建通过，16项隔离Web行为检查通过，独立审查通过。
- 文档/隐私：根AGENTS已同步，tracking-release.md提供隐私增补及发布待办；不改运行时数据库。
- 集成复核：`pnpm --dir server test:app-share` 的2个综合用例通过，覆盖身份、访问、Cookie、双平台下载、管理员加密隔离、失效重建、事务回滚、保留清理及站内相对下载地址；未跑全量测试。最终跨模块只读审查进行中。
- 浏览器：Playwright Chromium/Firefox启动均spawn UNKNOWN；CUA无法可靠识别Windows浏览器URL而停止。未完成桌面/390px视觉验收、真机Android验收及生产HTTPS/Cookie/反代验证。
- Git：da75086（存储）、b65d2c5（API）、b3eda4f（Web）、ba5db10（Android）、456d360（Admin）；按模块中文提交，未推送、未合并。

## 2026-11-02 接续复核与兼容修复

- 重新核对 dev 最近五次提交：da75086（数据层）、b65d2c5（API）、b3eda4f（官网）、ba5db10（Android）、456d360（Admin），五个业务阶段均已提交。
- 修复旧客户端兼容：不带 x-pm-device-token 的原 GET /api/config/app-share 即便含失效 Authorization 也应返回通用配置；带设备凭证的新客户端仍严格验证账号 Token，不得静默降级游客。增加真实 HTTP 回归断言。
- 本轮复验：pnpm --dir server test:app-share（2/2 通过）、pnpm --dir server test:analytics（8/8 通过）、pnpm --dir server test:website-records（3/3 通过）、pnpm --dir server/admin build、pnpm --dir server/frontend build、pm/gradlew.bat assembleDebug，均成功。
- 已核查 server/web-user/app-share/index.html 和 tracking.js 均成功打包，原有独立路由及下载地址归因代码保持。
- 本轮不修改原有一起听未提交布局与 ic_qq_24.xml、ic_wechat_24.xml，也不擅自部署正式环境。
- 上线前仍须管理员发布隐私条款、配置 APP_SHARE_ATTRIBUTION_SECRET，核验实际生产 HTTPS/CDN/反代静态路径、Android 真机二维码/账号切换、移动端浏览器与 Admin 桌面/手机视觉验收；构建通过不等于以上环境验收完成。
