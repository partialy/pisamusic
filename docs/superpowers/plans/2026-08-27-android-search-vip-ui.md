# Android 搜索交互与 VIP 到期展示 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 调整音质排序，给搜索提示词增加可取消的即时请求，将搜索音源选择器改为方块字母标签，并在“我的”页为有效 VIP 显示到期时间。

**Architecture:** 音质策略继续统一产生权限结果，再稳定分组排序。搜索提示词由 `SearchViewModel` 独占一个可取消 `Job`，请求使用 Retrofit `suspend` 匿名接口以传播取消到 OkHttp；搜索音源视觉复用 `SongSourceTagBinder`。VIP 到期时间只从 `AccountSessionStore` 的有效系统账号状态读取并在 `MineFragment` 渲染。

**Tech Stack:** Kotlin、Android ViewBinding、ViewModel、Kotlin Coroutines 1.7.3、Retrofit 2.9.0、XML Drawable、Gradle。

## Global Constraints

- 只处理 `pm/` 和本计划文档，不修改 `server/`、`yixi/`、`example/`。
- 保护当前工作区中扫码、服务端及其他用户改动；Git 仅暂存目标文件或目标 hunk。
- 搜索提示词优先采用可取消的即时请求，不增加 600ms 防抖。
- VIP 到期标签只显示时间 `yyyy-M-d HH:mm:ss`，不显示 VIP 名称、等级或其他文案。
- 只运行差异检查、Kotlin 编译和 Debug 构建；不安装、不启动、不跑完整测试。
- 分两次提交，提交消息使用中文。

---

### Task 1: 音质选项稳定分组并完成第一提交

**Files:**
- Modify: `pm/app/src/main/java/cn/partialy/pm/model/MusicQualityAccessPolicy.kt`
- Commit existing quality work: `pm/app/src/main/java/cn/partialy/pm/activity/FeedbackActivity.kt`
- Commit existing quality work: `pm/app/src/main/java/cn/partialy/pm/activity/PlayerActivity.kt`
- Commit existing quality work: `pm/app/src/main/java/cn/partialy/pm/activity/base/BaseDownloadActivity.kt`
- Commit existing quality work: `pm/app/src/main/java/cn/partialy/pm/ui/dialog/QualityPickerBottomSheet.kt`
- Commit existing quality work: `pm/app/src/main/res/values/strings.xml`
- Commit selected hunk: `pm/AGENTS.md`
- Commit selected hunk: `pm/design-html/components.md`
- Commit plan: `docs/superpowers/plans/2026-08-27-android-quality-unlock-feedback.md`

**Interfaces:**
- Consumes: `DownloadQualityOption.enabled`。
- Produces: `optionsFor` 返回可用项在前、禁用项在后，两个分组内部保持原顺序。

- [x] **Step 1: 稳定分组音质选项**

```kotlin
val evaluated = original.map { option ->
    if (option.choice in enabledChoices) option
    else option.copy(enabled = false, badge = restrictedBadge)
}
val (enabledOptions, disabledOptions) = evaluated.partition { it.enabled }
return enabledOptions + disabledOptions
```

- [x] **Step 2: 检查并编译第一提交文件**

Run: `git diff --check -- pm/app/src/main/java/cn/partialy/pm/activity/FeedbackActivity.kt pm/app/src/main/java/cn/partialy/pm/activity/PlayerActivity.kt pm/app/src/main/java/cn/partialy/pm/activity/base/BaseDownloadActivity.kt pm/app/src/main/java/cn/partialy/pm/model/MusicQualityAccessPolicy.kt pm/app/src/main/java/cn/partialy/pm/ui/dialog/QualityPickerBottomSheet.kt pm/app/src/main/res/values/strings.xml pm/AGENTS.md pm/design-html/components.md`

Run: `.\\pm\\gradlew.bat -p pm compileDebugKotlin`

Expected: 无空白错误，`BUILD SUCCESSFUL`。

- [x] **Step 3: 仅暂存音质目标改动并提交**

Run: `git commit -m "功能（pm）：调整音质权限与解锁反馈"`

Expected: 提交只包含音质、反馈入口、相关文档和计划，不包含扫码或服务端改动。

### Task 2: 可取消的即时搜索提示词请求

**Files:**
- Modify: `pm/app/src/main/java/cn/partialy/pm/ui/search/SearchViewModel.kt`
- Modify: `pm/app/src/main/java/cn/partialy/pm/network/repository/KgRepository.kt`

**Interfaces:**
- Consumes: `KgApiService.getLinkKeyword(keywords)` Retrofit `suspend` 接口。
- Produces: `suggestionJob: Job?` 和可取消的 `getSuggestions(keyword)`。

- [x] **Step 1: 让提示词仓库请求保持协程取消**

```kotlin
suspend fun getLinkKeyword(keywords: String): Result<SearchSongResponse> = try {
    ensureKgDfid()
    Result.success(api.getLinkKeyword(keywords).data)
} catch (e: CancellationException) {
    throw e
} catch (e: Exception) {
    Result.failure(e)
}
```

提示词不需要第三方登录态，直接使用现有匿名 Retrofit 接口，避开不可即时中断的 Cookie 阻塞分支。

- [x] **Step 2: 每次输入取消旧提示词 Job**

```kotlin
suggestionJob?.cancel()
if (keyword.isBlank() || _searchSource.value != SongType.KG) {
    _suggestions.value = emptyList()
    return
}
suggestionJob = viewModelScope.launch {
    kgRepository.getLinkKeyword(keyword).onSuccess { response ->
        _suggestions.value = response.lists
    }
}
```

切换音源时也取消 `suggestionJob`，防止旧 KG 提示迟到回写。

### Task 3: 搜索音源方块字母标签

**Files:**
- Modify: `pm/app/src/main/java/cn/partialy/pm/activity/SearchActivity.kt`
- Modify: `pm/app/src/main/java/cn/partialy/pm/ui/widget/SongSourceTagBinder.kt`
- Modify: `pm/app/src/main/res/layout/activity_search.xml`
- Modify: `pm/app/src/main/res/layout/item_search_source_option.xml`

**Interfaces:**
- Consumes: `SongSourceTagBinder.bind(TextView, SongType)`。
- Produces: KG=`K` 蓝色、WY=`Y` 红色、KW=`W` 橙色的 16dp 方块标签。

- [x] **Step 1: 将 KW 标签统一改为橙色方块 W**

```kotlin
SongType.KW -> "W"
```

`isSingleLetterTag` 同时包含 `SongType.KW`，使 KW 与 K/Y 使用相同方块尺寸并继续复用现有橙色配色。

- [x] **Step 2: 绑定当前搜索音源标签**

`activity_search.xml` 保留 `searchSourceLabel` TextView，但不再写“小蓝”；`SearchActivity` 观察音源时调用 `SongSourceTagBinder.bind(binding.searchSourceLabel, src)`。

- [x] **Step 3: 重做下拉选项行**

`item_search_source_option.xml` 使用可点击横向容器，包含 `sourceOptionTag` 和当前项 `sourceOptionCheck`；代码只遍历 `SongType.KG/WY/KW`，为标签调用 `SongSourceTagBinder.bind`，不渲染“小蓝/小红/小黄”。

### Task 4: “我的”页 VIP 到期时间标签

**Files:**
- Modify: `pm/app/src/main/java/cn/partialy/pm/ui/mine/MineFragment.kt`
- Modify: `pm/app/src/main/res/layout/fragment_mine.xml`
- Modify: `pm/app/src/main/res/values/dimens.xml`
- Create: `pm/app/src/main/res/drawable/bg_mine_vip_expiry_tag.xml`
- Modify: `pm/app/src/main/res/values/strings.xml`

**Interfaces:**
- Consumes: `AccountSessionStore.Session.vipActive` 与 `user.vipExpiresAt` 毫秒时间戳。
- Produces: `vipExpiryTextView`，仅有效 VIP 可见。

- [x] **Step 1: 在邮箱下添加金色标签**

新增默认 `gone` 的 `vipExpiryTextView`，使用金色细边框、半透明金色底和金色文字；适当增加 `mine_profile_header_height`，避免标签被固定头部裁切。

- [x] **Step 2: 按有效 VIP 渲染时间**

```kotlin
val vipExpiresAt = session.user.vipExpiresAt
val showVipExpiry = session.vipActive && vipExpiresAt != null
b.vipExpiryTextView.isVisible = showVipExpiry
if (showVipExpiry) {
    b.vipExpiryTextView.text = SimpleDateFormat(
        "yyyy-M-d HH:mm:ss",
        Locale.CHINA,
    ).format(Date(vipExpiresAt))
}
```

非 VIP、未登录或已到期时隐藏且清空文本；画面不添加“VIP”或“到期”前缀。

### Task 5: 文档、验证与第二提交

**Files:**
- Modify selected hunk: `pm/AGENTS.md`
- Modify selected hunk: `pm/design-html/components.md`
- Commit: `docs/superpowers/plans/2026-08-27-android-search-vip-ui.md`

**Interfaces:**
- Produces: 后续可复用的搜索取消、音源标签和 VIP 到期展示规则。

- [x] **Step 1: 同步项目与组件说明**

记录即时提示词请求的取消边界、搜索音源 K/Y/W 标签，以及“我的”页金色纯时间标签。

- [x] **Step 2: 运行轻量验证**

Run: `git diff --check -- AGENTS.md pm/AGENTS.md pm/design-html/components.md pm/app/src/main/java/cn/partialy/pm/ui/search/SearchViewModel.kt pm/app/src/main/java/cn/partialy/pm/network/repository/KgRepository.kt pm/app/src/main/java/cn/partialy/pm/activity/SearchActivity.kt pm/app/src/main/java/cn/partialy/pm/ui/widget/SongSourceTagBinder.kt pm/app/src/main/java/cn/partialy/pm/ui/mine/MineFragment.kt pm/app/src/main/res/layout/activity_search.xml pm/app/src/main/res/layout/item_search_source_option.xml pm/app/src/main/res/layout/fragment_mine.xml pm/app/src/main/res/values/dimens.xml pm/app/src/main/res/values/strings.xml pm/app/src/main/res/drawable/bg_mine_vip_expiry_tag.xml`

Run: `.\\pm\\gradlew.bat -p pm compileDebugKotlin`

Run: `.\\pm\\gradlew.bat -p pm assembleDebug`

Expected: 无空白错误，两个 Gradle 命令均为 `BUILD SUCCESSFUL`。

- [x] **Step 3: 仅暂存第二阶段目标改动并提交**

Run: `git commit -m "功能（pm）：优化搜索交互与会员到期展示"`

Expected: 第二提交不包含扫码、服务端或其他用户改动。
