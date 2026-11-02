# 原生轻提示迁移记录

实施日期：2026-11-02。范围仅 Android 原生 UI；WebView 消息、确认弹窗、带操作 Snackbar 和系统通知沿用原实现。

## 实现与维护入口

- `ui/message/PmMessage`：Activity/Fragment 的 Info、Success、Warning、Error 四态提示；文本与字符串资源重载，返回幂等 `MessageHandle.dismiss()`。
- `PmMessageHost`：前台 Window 宿主、显式 Dialog 注册、应用内非触摸 Panel、安全区/IME 定位、优先级、800ms 去重、动画及统一清理。无悬浮窗权限。
- `PmMessageFlow`：提交成功提示后默认等待 800ms 再关闭/导航；生命周期 STOP/DESTROY 取消，检查页面有效性，并禁止同时安排多个结束流程。业务方负责消费结果和禁止重复提交。
- `App` 在启动时注册全局生命周期。独立 Dialog/BottomSheet 必须在 show 后注册；注册不覆盖业务 dismiss/show listener，detach 自动解除。
- 登录/注册在成功提示后等待 800ms，再处理专属消息，最后安全关闭；歌单编辑、反馈、密码重置、网页登录保存和在线转本地歌单复用延迟结束流程。
- 原成功/错误图标原样使用；信息/警告沿用 24dp、2dp 描边、圆形轮廓和圆角端点。
- 一起听 Flow 事件改名 Message，携带明确消息类型；批量结果根据结构化失败数量决定状态。
- Android 13+ 复制不重复成功提示。普通 Toast、旧 BaseActivity.showMessage 和 emitToast 已移除；调试异常堆栈复制保留明确的系统 Toast 降级白名单。

## 静态验证

`:app:verifyMessageUsage` 在 preBuild 自动执行，禁止业务直接调用 Toast 或旧入口；白名单精确到 GlobalExceptionHandler 的复制调用。

本次按用户要求只做编译与静态检查，不运行完整测试。

- `gradlew.bat -p pm :app:compileDebugKotlin`：通过（包含资源处理、KAPT 与 `verifyMessageUsage`）。
- `git diff --check`：通过。
- 普通业务 `Toast.makeText`、旧 `showMessage`、`emitToast` 和旧 Together Toast 事件：零残留；唯一 Toast 为明确白名单。
- 两轮代码复核：修正并确认 IME 重复扣减、Fragment 监听器清理与独立窗口漏注册。
- 未执行单元测试全套、仪器测试或设备 UI 验收。

## 用户设备验收清单

- 四态颜色/图标、三行长文本、深浅主题、大字体与无障碍朗读/超时。
- 快速重复操作、Error/Warning 的优先级、常驻消息关闭、旧 Handle 不影响新消息。
- Dialog/BottomSheet 之上居中、点击透传；键盘弹出/收起、横屏和分屏重定位。
- 反馈/编辑成功后 800ms 关闭；等待中手动返回、旋转、切后台不迟到关闭或重复提交。
- 登录/注册：成功提示、800ms、专属消息确认、退出顺序；歌单转换再次执行仍可正常导航。
- Android 13+ 剪贴板不双重反馈，旧版复制仍有提示；异常调试降级正常。
- Activity/Fragment View/Dialog 离开后消息不残留，后台不弹应用内消息。

设备验收尚未执行，窗口层级、IME 居中与点击透传不能仅由编译证明。
