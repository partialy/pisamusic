# Android 音质解锁反馈入口 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 手机端始终展示 KG/WY 全部音质，并按游客、普通系统账号、有效系统 VIP 三种状态控制可用性及受限项去向。

**Architecture:** 继续由 `MusicQualityAccessPolicy` 统一产生完整音质列表和权限结果，播放、下载入口只负责根据当前系统账号状态导航。反馈页通过私有 Intent extra 和专用 `startForQualityUnlock` 入口预选“账号相关”并展示提示，不把 PisaMusic VIP 状态与第三方音乐账号混用。

**Tech Stack:** Kotlin、Android Activity、ViewBinding、现有 `QualityPickerBottomSheet` / `OptionPickerRows`、Gradle。

## Global Constraints

- 只修改 `pm/` 手机端及本计划文档，不处理 `server/`、`yixi/`、`example/`。
- 不展示系统 VIP 文案或标识；“联系作者解锁”仅作为普通账号的受限音质标签。
- 游客现有可播放档位不变，其余完整音质列表统一禁用并标记“需登录”。
- 普通账号现有可播放档位不变，额外高级音质禁用并标记“联系作者解锁”。
- 有效系统 VIP 的 KG/WY 音质全部可用；KW / LOCAL 保持现有行为。
- 不启动或安装 App，不跑完整测试套件；只做差异检查、目标 Kotlin 编译和 Debug 构建。

---

### Task 1: 完整音质可见性与权限标签

**Files:**
- Modify: `pm/app/src/main/java/cn/partialy/pm/model/MusicQualityAccessPolicy.kt`

**Interfaces:**
- Consumes: `downloadOptionsForSongType(type): List<DownloadQualityOption>`、`MusicQualityAccessState(loggedIn, vipActive)`。
- Produces: `optionsFor` 始终返回该音源完整选项，并用 `enabled` / `badge` 表达权限。

- [x] **Step 1: 保留当前允许档位集合**

游客继续使用 `guestEnabledKgChoices` / `guestEnabledWyChoices`，普通账号继续使用 `regularKgChoices` / `regularWyChoices`，不调整具体档位。

- [x] **Step 2: 对完整列表逐项计算状态**

```kotlin
val enabledChoices = if (access.loggedIn) regularChoices else guestEnabledChoices
val restrictedBadge = if (access.loggedIn) UNLOCK_REQUIRED_BADGE else LOGIN_REQUIRED_BADGE
return original.map { option ->
    if (option.choice in enabledChoices) option
    else option.copy(enabled = false, badge = restrictedBadge)
}
```

- [x] **Step 3: 保持运行时权限复核**

`isChoiceAllowed` 和 `allowedChoiceOrFallback` 继续只接受 `enabled=true` 的选项，使已保存越权音质仍回退到 KG 128 / WY standard。

### Task 2: 受限音质导航与反馈页预设

**Files:**
- Modify: `pm/app/src/main/java/cn/partialy/pm/ui/dialog/QualityPickerBottomSheet.kt`
- Modify: `pm/app/src/main/java/cn/partialy/pm/activity/PlayerActivity.kt`
- Modify: `pm/app/src/main/java/cn/partialy/pm/activity/base/BaseDownloadActivity.kt`
- Modify: `pm/app/src/main/java/cn/partialy/pm/activity/FeedbackActivity.kt`
- Modify: `pm/app/src/main/res/values/strings.xml`

**Interfaces:**
- Consumes: 音质选择器已有 `OptionPickerRows.bindQualityOptions(... onDisabledOptionClick)`。
- Produces: `onRestrictedOptionClick: ((DownloadQualityOption) -> Unit)?` 与 `FeedbackActivity.startForQualityUnlock(context)`。

- [x] **Step 1: 让选择器暴露通用受限项点击回调**

```kotlin
onRestrictedOptionClick: ((DownloadQualityOption) -> Unit)? = null
```

禁用项被点击后先关闭弹层，再把对应 `DownloadQualityOption` 交给调用方；选择器本身不判断登录或 VIP。

- [x] **Step 2: 播放和下载入口按账号状态导航**

```kotlin
onRestrictedOptionClick = {
    if (session.loggedIn) {
        FeedbackActivity.startForQualityUnlock(context)
    } else {
        LoginActivity.start(context)
    }
}
```

两个入口都复用打开选择器前读取的系统账号快照；真正选中可用音质后仍重新读取账号状态并调用 `isChoiceAllowed`。

- [x] **Step 3: 增加反馈页专用启动入口**

```kotlin
fun startForQualityUnlock(context: Context) {
    context.startActivity(
        Intent(context, FeedbackActivity::class.java)
            .putExtra(EXTRA_INITIAL_TYPE, TYPE_ACCOUNT)
            .putExtra(EXTRA_INITIAL_MESSAGE, context.getString(R.string.feedback_quality_unlock_hint)),
    )
    AppActivityTransitions.applyForward(context)
}
```

`onCreate` 在绑定类型 Chip 前读取并校验 `EXTRA_INITIAL_TYPE`，因此页面首次渲染即选中“账号相关”；绑定完成后调用现有 `showMessage` 展示提示。

- [x] **Step 4: 增加精确提示文案**

```xml
<string name="feedback_quality_unlock_hint">请输入需求并提交，等待作者审核</string>
```

### Task 3: 文档同步与轻量验证

**Files:**
- Modify: `pm/AGENTS.md`
- Modify: `pm/design-html/components.md`

**Interfaces:**
- Produces: 后续开发可直接查到完整音质展示、两类禁用标签与反馈跳转约束。

- [x] **Step 1: 更新播放器业务规则**

在 `MusicQualityAccessPolicy` 规则中写清游客、普通账号、有效 VIP 三态行为，以及普通账号受限项跳“账号相关”反馈页。

- [x] **Step 2: 更新音质选择器组件索引**

补充禁用项可按业务回调进入登录或解锁反馈，继续复用现有灰态和 badge 样式。

- [x] **Step 3: 检查差异格式**

Run: `git diff --check -- pm docs/superpowers/plans/2026-08-27-android-quality-unlock-feedback.md`

Expected: 无空白错误输出。

- [x] **Step 4: 编译目标 Kotlin**

Run: `.\\pm\\gradlew.bat -p pm compileDebugKotlin`

Expected: `BUILD SUCCESSFUL`。

- [x] **Step 5: 构建 Debug 包**

Run: `.\\pm\\gradlew.bat -p pm assembleDebug`

Expected: `BUILD SUCCESSFUL`；不安装、不启动、不做真机交互测试。
