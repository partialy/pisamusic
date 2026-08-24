# Android 我的页横向分页与吸顶修复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复“我的”页 Header 折叠失效和状态栏遮挡，保留左右滑动 Tab、长歌单 RecyclerView 虚拟化、两页独立内容长度与滚动位置，并彻底禁止恢复全列表动态测高。

**Architecture:** 使用 Android 成熟应用常见的 `CoordinatorLayout + AppBarLayout + ViewPager2 + 每页 RecyclerView` 结构。`ViewPager2` 始终占满可用视口，所谓“不同高度列表”由每页 Adapter 的真实内容长度和独立滚动范围表达，而不是改变 Pager 自身高度；共享 AppBar 只管理头像区折叠和 Tab 吸顶，固定 Header 作为 Coordinator 顶层 Overlay，不参与折叠。

**Tech Stack:** Kotlin、Android ViewBinding、CoordinatorLayout、Material `AppBarLayout` / `CollapsingToolbarLayout`、ViewPager2、RecyclerView、JUnit4。

## Global Constraints

- 保留左右滑动和点击 Tab 两种切换方式。
- 不恢复 `wrap_content ViewPager2`、`UNSPECIFIED` 测量或遍历 Adapter 全量测高。
- “我的”和“歌单”页面继续各自使用页面级 RecyclerView，只绑定可见项目。
- Header 必须覆盖状态栏安全区，不能依赖首次 Insets 恰好在 Fragment 创建后分发。
- Header 基础高度统一读取 `R.dimen.home_header_bar_height`，禁止硬编码 `56dp`。
- `mineHeaderBar` 不得重新放回 `CollapsingToolbarLayout`。
- Tab 吸顶由 AppBar 的非滚动直接子项承担，禁止用负外边距改变 AppBar 折叠区间。
- 两个 Tab 保留各自的 RecyclerView 滚动位置；切换页面时不能全量刷新或重新测量列表。
- 不修改或提交用户已有的 `app/build.gradle.kts` 版本号变更。
- Git 提交信息使用中文，并按本计划每个 Task 独立提交。

---

## 为什么其他 App 能做到

成熟 App 看到的“两个不同高度列表”通常包含三个互相独立的高度概念：

1. `ViewPager2` 的视口高度：固定为屏幕剩余区域，两页相同，这是横向分页稳定工作的前提。
2. RecyclerView 的内容高度：由每页 Adapter 项目数量决定，两页不同；短页到最后一项就不能继续向下滚，长页继续虚拟化滚动。
3. AppBar 的折叠范围：头像区可折叠，Tab 行不设置 `scrollFlags`，因此停在固定 Header 下方。

因此正确实现不是“切 Tab 后重新计算 Pager 高度”，而是“固定分页视口 + 不同内容滚动范围 + 统一折叠容器”。当前回归来自 Header 被放进折叠容器、Insets 监听可能错过首次分发，以及 `56dp` 与实际 `48dp` 不一致，不是 RecyclerView 虚拟化本身的问题。

目标结构：

```text
CoordinatorLayout
├─ AppBarLayout
│  ├─ CollapsingToolbarLayout（仅头像/背景，scroll|exitUntilCollapsed）
│  └─ mineTabsSheet（无 scrollFlags，吸顶）
├─ ViewPager2（appbar_scrolling_view_behavior）
│  ├─ MineMyTabFragment -> RecyclerView
│  └─ MinePlaylistsTabFragment -> RecyclerView
└─ mineHeaderBar（最后一个根子 View，固定 Overlay，覆盖状态栏）
```

## File Map

- Create: `app/src/main/java/cn/partialy/pm/ui/mine/MineHeaderLayoutPolicy.kt` — 将状态栏 inset、Header 高度和 Collapsing 最小高度的计算收口成可测试契约。
- Create: `app/src/test/java/cn/partialy/pm/ui/mine/MineHeaderLayoutPolicyTest.kt` — 验证安全区和折叠最小高度始终一致。
- Modify: `app/src/main/res/layout/fragment_mine.xml` — 固定 Header 移到 Coordinator 顶层，稳定 AppBar/Tab 几何关系。
- Modify: `app/src/main/res/values/dimens.xml` — 增加“我的”页头像区可见高度资源，去除负边距补偿。
- Modify: `app/src/main/java/cn/partialy/pm/ui/mine/MineFragment.kt` — 根层处理 Insets、显式重新申请、维护 Header 视觉状态和 ViewPager 回调生命周期。
- Modify: `app/src/main/java/cn/partialy/pm/ui/mine/MinePlaylistsAdapter.kt` — 列表为空时延迟恢复 RecyclerView 状态，数据到达后再恢复。
- Modify: `app/src/main/java/cn/partialy/pm/ui/mine/MineMyTabFragment.kt` — 明确页面 RecyclerView 的独立滚动职责，不增加高度测量逻辑。
- Modify: `app/src/main/java/cn/partialy/pm/ui/mine/MinePlaylistsTabFragment.kt` — 明确歌单 RecyclerView 的独立滚动职责和数据恢复顺序。
- Modify: `AGENTS.md` — 固化 Mine 页分页、吸顶、Insets 和禁止动态测高的架构约束。
- Modify: `design-html/components.md` — 更新“我的页面入口行”的滚动承载说明。

---

### Task 1: 用单元测试固定 Header/Insets 布局契约

**Files:**
- Create: `app/src/test/java/cn/partialy/pm/ui/mine/MineHeaderLayoutPolicyTest.kt`
- Create: `app/src/main/java/cn/partialy/pm/ui/mine/MineHeaderLayoutPolicy.kt`

**Interfaces:**
- Consumes: `baseHeaderHeightPx: Int`、`statusBarTopPx: Int`。
- Produces: `MineHeaderLayoutPolicy.resolve(baseHeaderHeightPx, statusBarTopPx): MineHeaderLayoutMetrics`。

- [ ] **Step 1: 写失败测试，覆盖普通状态栏、零 inset 和非法参数**

```kotlin
package cn.partialy.pm.ui.mine

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class MineHeaderLayoutPolicyTest {

    @Test
    fun `状态栏高度同时计入固定 Header 和折叠最小高度`() {
        val result = MineHeaderLayoutPolicy.resolve(
            baseHeaderHeightPx = 144,
            statusBarTopPx = 72,
        )

        assertEquals(216, result.overlayHeightPx)
        assertEquals(72, result.contentPaddingTopPx)
        assertEquals(216, result.collapsingMinimumHeightPx)
    }

    @Test
    fun `无状态栏 inset 时仍保留基础 Header 高度`() {
        val result = MineHeaderLayoutPolicy.resolve(
            baseHeaderHeightPx = 144,
            statusBarTopPx = 0,
        )

        assertEquals(144, result.overlayHeightPx)
        assertEquals(0, result.contentPaddingTopPx)
        assertEquals(144, result.collapsingMinimumHeightPx)
    }

    @Test
    fun `拒绝非法高度避免折叠区退化为零`() {
        assertThrows(IllegalArgumentException::class.java) {
            MineHeaderLayoutPolicy.resolve(baseHeaderHeightPx = 0, statusBarTopPx = 72)
        }
        assertThrows(IllegalArgumentException::class.java) {
            MineHeaderLayoutPolicy.resolve(baseHeaderHeightPx = 144, statusBarTopPx = -1)
        }
    }
}
```

- [ ] **Step 2: 运行测试并确认因实现不存在而失败**

Run:

```powershell
.\gradlew.bat testDebugUnitTest --tests "cn.partialy.pm.ui.mine.MineHeaderLayoutPolicyTest"
```

Expected: `Unresolved reference: MineHeaderLayoutPolicy`，测试任务失败。

- [ ] **Step 3: 创建最小实现**

```kotlin
package cn.partialy.pm.ui.mine

internal data class MineHeaderLayoutMetrics(
    val overlayHeightPx: Int,
    val contentPaddingTopPx: Int,
    val collapsingMinimumHeightPx: Int,
)

internal object MineHeaderLayoutPolicy {

    fun resolve(
        baseHeaderHeightPx: Int,
        statusBarTopPx: Int,
    ): MineHeaderLayoutMetrics {
        require(baseHeaderHeightPx > 0) { "baseHeaderHeightPx must be positive" }
        require(statusBarTopPx >= 0) { "statusBarTopPx must not be negative" }

        val totalHeaderHeightPx = baseHeaderHeightPx + statusBarTopPx
        return MineHeaderLayoutMetrics(
            overlayHeightPx = totalHeaderHeightPx,
            contentPaddingTopPx = statusBarTopPx,
            collapsingMinimumHeightPx = totalHeaderHeightPx,
        )
    }
}
```

- [ ] **Step 4: 运行聚焦测试并确认通过**

Run:

```powershell
.\gradlew.bat testDebugUnitTest --tests "cn.partialy.pm.ui.mine.MineHeaderLayoutPolicyTest"
```

Expected: `BUILD SUCCESSFUL`，3 个测试全部通过。

- [ ] **Step 5: 提交布局契约测试**

```powershell
git add app/src/main/java/cn/partialy/pm/ui/mine/MineHeaderLayoutPolicy.kt app/src/test/java/cn/partialy/pm/ui/mine/MineHeaderLayoutPolicyTest.kt
git commit -m "测试：补充我的页顶部布局契约"
```

---

### Task 2: 修复固定 Header、状态栏 Insets 与 AppBar 折叠边界

**Files:**
- Modify: `app/src/main/res/layout/fragment_mine.xml:16-189`
- Modify: `app/src/main/res/values/dimens.xml`
- Modify: `app/src/main/java/cn/partialy/pm/ui/mine/MineFragment.kt:35-160`

**Interfaces:**
- Consumes: `MineHeaderLayoutPolicy.resolve(...)`、`R.dimen.home_header_bar_height`。
- Produces: 固定的 `mineHeaderBar` Overlay；只包含头像区的 `mineCollapsingHeader`；稳定吸顶的 `mineTabsSheet`。

- [ ] **Step 1: 用资源表示当前可见头像区高度，消除 `320dp + (-24dp)` 的折叠计算**

在 `dimens.xml` 增加：

```xml
<dimen name="mine_profile_header_height">296dp</dimen>
```

`296dp` 等于现有头像区 `320dp` 减去 Tab Sheet 的 `24dp` 负外边距，保持展开时的可见分界不变，但不再让负外边距参与 AppBar 总高度和折叠范围计算。

- [ ] **Step 2: 重排 `fragment_mine.xml` 的职责**

将 `fragment_mine.xml` 完整替换为以下内容：

```xml
<?xml version="1.0" encoding="utf-8"?>
<androidx.coordinatorlayout.widget.CoordinatorLayout
    xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    xmlns:tools="http://schemas.android.com/tools"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="@color/home_page_bg">

    <com.google.android.material.appbar.AppBarLayout
        android:id="@+id/mineAppBar"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:background="@android:color/transparent"
        app:elevation="0dp">

        <com.google.android.material.appbar.CollapsingToolbarLayout
            android:id="@+id/mineCollapsingHeader"
            android:layout_width="match_parent"
            android:layout_height="@dimen/mine_profile_header_height"
            app:layout_scrollFlags="scroll|exitUntilCollapsed">

            <FrameLayout
                android:id="@+id/profileHeader"
                android:layout_width="match_parent"
                android:layout_height="match_parent"
                app:layout_collapseMode="parallax">

                <ImageView
                    android:id="@+id/profileBgImageView"
                    android:layout_width="match_parent"
                    android:layout_height="match_parent"
                    android:contentDescription="@null"
                    android:scaleType="centerCrop"
                    android:src="@drawable/bg_mine_header" />

                <View
                    android:layout_width="match_parent"
                    android:layout_height="match_parent"
                    android:background="#33000000" />

                <LinearLayout
                    android:layout_width="match_parent"
                    android:layout_height="match_parent"
                    android:gravity="center_horizontal"
                    android:orientation="vertical"
                    android:paddingHorizontal="24dp"
                    android:paddingTop="56dp"
                    android:paddingBottom="24dp">

                    <com.google.android.material.imageview.ShapeableImageView
                        android:id="@+id/avatarImageView"
                        android:layout_width="86dp"
                        android:layout_height="86dp"
                        android:layout_marginTop="50dp"
                        android:clickable="true"
                        android:contentDescription="@string/mine_avatar_cd_change"
                        android:focusable="true"
                        android:scaleType="centerCrop"
                        android:src="@drawable/ic_pm_icon"
                        app:shapeAppearanceOverlay="@style/ShapeAppearance.Material3.Corner.Full" />

                    <TextView
                        android:id="@+id/nicknameTextView"
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:layout_marginTop="12dp"
                        android:textColor="@android:color/white"
                        android:textSize="18sp"
                        android:textStyle="bold"
                        tools:text="i_忆昔" />

                    <TextView
                        android:id="@+id/subtitleTextView"
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:layout_marginTop="6dp"
                        android:textColor="#CCFFFFFF"
                        android:textSize="13sp"
                        tools:text="9枚徽章 · Lv.7 · 254小时" />
                </LinearLayout>
            </FrameLayout>

        </com.google.android.material.appbar.CollapsingToolbarLayout>

        <LinearLayout
            android:id="@+id/mineTabsSheet"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:background="@drawable/bg_mine_playlist_sheet"
            android:gravity="center"
            android:orientation="horizontal"
            android:paddingTop="16dp"
            android:paddingBottom="10dp">

            <TextView
                android:id="@+id/tabMineText"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:paddingHorizontal="14dp"
                android:paddingVertical="4dp"
                android:text="@string/mine_tab_mine"
                android:textAppearance="@style/TextAppearance.Material3.TitleMedium"
                android:textColor="@color/colorOnBgNormal"
                tools:alpha="1" />

            <TextView
                android:id="@+id/tabPlaylistsText"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:layout_marginStart="4dp"
                android:paddingHorizontal="14dp"
                android:paddingVertical="4dp"
                android:text="@string/mine_tab_playlists"
                android:textAppearance="@style/TextAppearance.Material3.TitleMedium"
                android:textColor="@color/colorOnBgNormal"
                tools:alpha="0.8" />

        </LinearLayout>
    </com.google.android.material.appbar.AppBarLayout>

    <androidx.viewpager2.widget.ViewPager2
        android:id="@+id/mineTabViewPager"
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        android:background="@color/home_page_bg"
        app:layout_behavior="@string/appbar_scrolling_view_behavior" />

    <FrameLayout
        android:id="@+id/mineHeaderBar"
        android:layout_width="match_parent"
        android:layout_height="@dimen/home_header_bar_height"
        android:elevation="8dp">

        <View
            android:id="@+id/mineHeaderBg"
            android:layout_width="match_parent"
            android:layout_height="match_parent"
            android:alpha="0"
            android:background="@color/home_header_bg" />

        <LinearLayout
            android:id="@+id/mineHeaderContent"
            android:layout_width="match_parent"
            android:layout_height="match_parent"
            android:gravity="center_vertical"
            android:orientation="horizontal"
            android:paddingHorizontal="8dp">

            <ImageButton
                android:id="@+id/mineMenuButton"
                android:layout_width="40dp"
                android:layout_height="40dp"
                android:background="@android:color/transparent"
                android:contentDescription="@string/open_menu"
                android:padding="8dp"
                android:src="@drawable/ic_menu_24"
                app:tint="@android:color/white" />

            <Space
                android:layout_width="0dp"
                android:layout_height="wrap_content"
                android:layout_weight="1" />

            <TextView
                android:id="@+id/title_text"
                android:layout_width="wrap_content"
                android:layout_height="match_parent"
                android:gravity="center_vertical"
                android:text="@string/app_name"
                android:textColor="@color/white"
                android:textSize="18sp"
                android:visibility="gone" />

            <Space
                android:layout_width="0dp"
                android:layout_height="wrap_content"
                android:layout_weight="1" />

            <ImageButton
                android:id="@+id/mineSearchButton"
                android:layout_width="40dp"
                android:layout_height="40dp"
                android:background="@android:color/transparent"
                android:contentDescription="@string/search"
                android:padding="8dp"
                android:src="@drawable/ic_search_24"
                app:tint="@android:color/white" />
        </LinearLayout>

    </FrameLayout>
</androidx.coordinatorlayout.widget.CoordinatorLayout>
```

验收结构要求：

- `mineHeaderBar.parent === CoordinatorLayout`。
- `mineHeaderBar` 是根布局最后一个子 View，始终覆盖 AppBar 和 ViewPager。
- `mineCollapsingHeader` 内不再存在 `mineHeaderBar`。
- `mineTabsSheet` 不设置 `layout_scrollFlags`，也没有负 margin。
- `ViewPager2` 仍为 `match_parent`，禁止改成 `wrap_content`。

- [ ] **Step 3: 将 MineFragment 的 Insets 处理改为根层、可重放的实现**

加入 `updateLayoutParams` import，并把局部硬编码逻辑收口为：

```kotlin
private var currentHeaderAlpha = 0f

private fun setupInsets(root: View) {
    val baseHeaderHeightPx = resources.getDimensionPixelSize(R.dimen.home_header_bar_height)
    ViewCompat.setOnApplyWindowInsetsListener(root) { _, insets ->
        val statusBarTopPx = insets.getInsets(WindowInsetsCompat.Type.statusBars()).top
        val metrics = MineHeaderLayoutPolicy.resolve(
            baseHeaderHeightPx = baseHeaderHeightPx,
            statusBarTopPx = statusBarTopPx,
        )

        binding.mineHeaderBar.updateLayoutParams<ViewGroup.LayoutParams> {
            height = metrics.overlayHeightPx
        }
        binding.mineHeaderContent.updatePadding(top = metrics.contentPaddingTopPx)
        binding.mineCollapsingHeader.minimumHeight = metrics.collapsingMinimumHeightPx
        insets
    }
    ViewCompat.requestApplyInsets(root)
}

private fun applyStatusBarIconStyle(headerAlpha: Float) {
    val isDarkMode =
        (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
            Configuration.UI_MODE_NIGHT_YES
    val controller = WindowInsetsControllerCompat(requireActivity().window, requireView())
    controller.isAppearanceLightStatusBars = !isDarkMode && headerAlpha >= 0.5f
}
```

`onViewCreated()` 中先调用：

```kotlin
setupInsets(view)
```

AppBar listener 更新统一状态：

```kotlin
val triggerPx = (200f * resources.displayMetrics.density).toInt().coerceAtLeast(1)
appBarOffsetListener = AppBarLayout.OnOffsetChangedListener { _, verticalOffset ->
    val scrollY = -verticalOffset
    currentHeaderAlpha = (scrollY.toFloat() / triggerPx).coerceIn(0f, 1f)
    binding.mineHeaderBg.alpha = currentHeaderAlpha
    applyStatusBarIconStyle(currentHeaderAlpha)

    val iconTint = if (currentHeaderAlpha < 0.5f) {
        android.R.color.white
    } else {
        R.color.colorOnBgNormal
    }
    binding.titleText.visibility = if (currentHeaderAlpha < 0.9f) View.GONE else View.VISIBLE
    val color = requireContext().getColor(iconTint)
    binding.mineMenuButton.setColorFilter(color)
    binding.mineSearchButton.setColorFilter(color)
    binding.titleText.setTextColor(requireContext().getColor(R.color.colorOnBgNormal))
}
```

`onResume()` 恢复系统栏图标状态，避免从其他页面回来继承错误颜色：

```kotlin
override fun onResume() {
    super.onResume()
    (activity as? MainActivity)?.refreshMineProfileBackgroundFromLogin()
    applyMineProfileTexts()
    applyMineAvatarDisplay()
    if (_binding != null) applyStatusBarIconStyle(currentHeaderAlpha)
}
```

`onDestroyView()` 在清理 binding 前解除根 Insets listener：

```kotlin
ViewCompat.setOnApplyWindowInsetsListener(binding.root, null)
```

- [ ] **Step 4: 运行资源处理、聚焦测试和 Debug 编译**

Run:

```powershell
.\gradlew.bat processDebugResources
.\gradlew.bat testDebugUnitTest --tests "cn.partialy.pm.ui.mine.MineHeaderLayoutPolicyTest"
.\gradlew.bat compileDebugKotlin
```

Expected: 三条命令均 `BUILD SUCCESSFUL`；无 ViewBinding id 缺失、XML margin 或 Kotlin import 错误。

- [ ] **Step 5: 检查本次暂存范围并提交 Header 修复**

```powershell
git diff -- app/src/main/res/layout/fragment_mine.xml app/src/main/res/values/dimens.xml app/src/main/java/cn/partialy/pm/ui/mine/MineFragment.kt
git add app/src/main/res/layout/fragment_mine.xml app/src/main/res/values/dimens.xml app/src/main/java/cn/partialy/pm/ui/mine/MineFragment.kt
git diff --cached --name-only
git commit -m "修复：恢复我的页顶部栏与吸顶结构"
```

Expected: 暂存列表不包含 `app/build.gradle.kts`。

---

### Task 3: 稳定左右分页、独立列表状态与异步数据恢复

**Files:**
- Modify: `app/src/main/java/cn/partialy/pm/ui/mine/MineFragment.kt:35-160`
- Modify: `app/src/main/java/cn/partialy/pm/ui/mine/MinePlaylistsAdapter.kt:17-20`
- Modify: `app/src/main/java/cn/partialy/pm/ui/mine/MineMyTabFragment.kt:97-112`
- Modify: `app/src/main/java/cn/partialy/pm/ui/mine/MinePlaylistsTabFragment.kt:48-60`

**Interfaces:**
- Consumes: `MineTabPagerAdapter` 的固定两页和两个页面级 RecyclerView。
- Produces: 原生左右滑动、点击切换、每页独立滚动位置、异步歌单数据到达后的可靠位置恢复。

- [ ] **Step 1: 把 ViewPager 回调变成有生命周期的字段**

在 `MineFragment` 增加：

```kotlin
private var pageChangeCallback: ViewPager2.OnPageChangeCallback? = null
```

注册时保存实例：

```kotlin
pageChangeCallback = object : ViewPager2.OnPageChangeCallback() {
    override fun onPageSelected(position: Int) {
        applyMineTabStyle(position)
    }
}
pageChangeCallback?.let(binding.mineTabViewPager::registerOnPageChangeCallback)
```

销毁 View 前完整清理：

```kotlin
pageChangeCallback?.let(binding.mineTabViewPager::unregisterOnPageChangeCallback)
pageChangeCallback = null
binding.mineTabViewPager.adapter = null
```

保留：

```kotlin
binding.mineTabViewPager.offscreenPageLimit = 1
```

这使两个页面 Fragment 在当前两页场景下同时保留，各自 RecyclerView 不会因左右切换反复重建或重新绑定整张列表。

- [ ] **Step 2: 让异步歌单 Adapter 在非空后再恢复滚动位置**

在 `MinePlaylistsAdapter` 增加：

```kotlin
init {
    stateRestorationPolicy = RecyclerView.Adapter.StateRestorationPolicy.PREVENT_WHEN_EMPTY
}
```

原因：歌单数据由 Flow 异步到达，RecyclerView 如果在 Adapter 仍为空时恢复状态，保存的位置可能被提前消费；非空后恢复可以保持切换或重建前的位置。

- [ ] **Step 3: 明确每页只保留一个垂直 RecyclerView，不增加父级滚动容器**

`MineMyTabFragment` 保持如下唯一滚动链：

```kotlin
binding.mineMyRecyclerView.apply {
    layoutManager = LinearLayoutManager(requireContext())
    adapter = ConcatAdapter(overviewAdapter, localPlaylistsAdapter)
    itemAnimator = null
    isNestedScrollingEnabled = true
}
```

`MinePlaylistsTabFragment` 保持如下唯一滚动链：

```kotlin
binding.playlistsRecyclerView.apply {
    layoutManager = LinearLayoutManager(requireContext())
    adapter = this@MinePlaylistsTabFragment.adapter
    itemAnimator = null
    isNestedScrollingEnabled = true
}
```

禁止在这两个 Fragment 外再包 `NestedScrollView`，也禁止根据 `adapter.itemCount` 修改 RecyclerView 或 ViewPager 高度。

- [ ] **Step 4: 运行单元测试和 Debug 构建**

Run:

```powershell
.\gradlew.bat testDebugUnitTest
.\gradlew.bat assembleDebug
```

Expected: 两条命令均 `BUILD SUCCESSFUL`。本步骤只构建，不安装、不启动 App。

- [ ] **Step 5: 提交分页状态修复**

```powershell
git add app/src/main/java/cn/partialy/pm/ui/mine/MineFragment.kt app/src/main/java/cn/partialy/pm/ui/mine/MinePlaylistsAdapter.kt app/src/main/java/cn/partialy/pm/ui/mine/MineMyTabFragment.kt app/src/main/java/cn/partialy/pm/ui/mine/MinePlaylistsTabFragment.kt
git diff --cached --name-only
git commit -m "优化：稳定我的页分页滚动状态"
```

Expected: 暂存列表仍不包含 `app/build.gradle.kts`。

---

### Task 4: 真机验收滚动矩阵并固化项目约束

**Files:**
- Modify: `AGENTS.md`
- Modify: `design-html/components.md:69`
- Add: `docs/superpowers/plans/2026-08-24-android-mine-pager-sticky-header-fix.md`

**Interfaces:**
- Consumes: Task 2 的固定 Header Overlay 和 Task 3 的双 RecyclerView 分页结构。
- Produces: 后续开发可复用、不可误改回动态测高的 Mine 页架构说明。

- [ ] **Step 1: 在 `AGENTS.md` 替换 Mine 页架构说明**

使用下面的完整约束文本：

```markdown
- “我的”页使用 `CoordinatorLayout + AppBarLayout + 全高 ViewPager2`：`CollapsingToolbarLayout` 只负责头像背景折叠，Tab 作为无 `scrollFlags` 的 AppBar 直接子项吸顶，固定 Header 必须是 Coordinator 顶层 Overlay 并在根布局显式 `requestApplyInsets()` 后处理状态栏安全区。两个 Tab 各自使用页面级 RecyclerView 表达不同内容长度和独立滚动位置；ViewPager 视口保持等高，不得恢复 `wrap_content`、`UNSPECIFIED` 全量测量、外层 `NestedScrollView` 或按 Adapter 项目数动态修改页面高度。
```

- [ ] **Step 2: 更新 `design-html/components.md` 的 Mine 页索引**

将“我的页面入口行”备注更新为：

```markdown
| 我的页面入口行 | 我的页收藏、本地、设置和自建歌单入口 | `item_mine_favorites_row.xml`、`item_mine_local_music_row.xml`、`item_mine_cover_title_row.xml`、`item_mine_local_playlist_section_header.xml`、`item_mine_playlist_empty.xml` | `MineMyOverviewAdapter`、`MineMyTabFragment` | 固定入口和分组头由 Overview Adapter 承载，自建歌单行通过 ConcatAdapter 接在后面；页面级 RecyclerView 保持回收，Mine 根层固定 Header Overlay，AppBar 只负责头像折叠与 Tab 吸顶。 |
```

- [ ] **Step 3: 完成真机/模拟器验收矩阵**

按以下顺序逐项验证，任一失败不得提交文档或宣布完成：

1. 无歌单：左右滑动 20 次，Header 不跳入状态栏，空状态不产生可继续向下滚动的假高度。
2. 1～3 个歌单：分别在两个 Tab 向上、向下拖动；头像可完整折叠和展开，Tab 始终停在固定 Header 下方。
3. 100 个以上歌单：连续快速滑动并左右切换；不出现整页卡顿，不一次性创建全部 ViewHolder。
4. 在“歌单”页滚到中部，切到“我的”再切回；歌单位置保留，“我的”页位置不被歌单覆盖。
5. AppBar 完全展开、折叠一半、完全折叠三种状态下左右切换；Header、Tab 均不跳位。
6. 浅色和深色主题各验证一次；Header 透明/实色转换时状态栏图标颜色可读。
7. 三键导航和手势导航各验证一次；顶部状态栏与底部迷你播放器均不遮挡内容。
8. 横竖屏或 Activity 重建一次；页面恢复后 Header 高度、选中 Tab 和列表状态正确。

- [ ] **Step 4: 运行最终自动验证并检查提交边界**

Run:

```powershell
.\gradlew.bat testDebugUnitTest
.\gradlew.bat assembleDebug
git status --short
git diff --check
```

Expected:

- Gradle 测试和 Debug 构建均 `BUILD SUCCESSFUL`。
- `git diff --check` 无输出。
- `app/build.gradle.kts` 仍只保留用户自己的版本号变更，没有进入任何本任务提交。

- [ ] **Step 5: 提交项目说明**

```powershell
git add AGENTS.md design-html/components.md docs/superpowers/plans/2026-08-24-android-mine-pager-sticky-header-fix.md
git diff --cached --name-only
git commit -m "文档：记录我的页分页吸顶约束"
```

---

## Final Acceptance

- 左右滑动和点击 Tab 均正常。
- 两页 Pager 视口相同，但 RecyclerView 内容长度、可滚动范围和恢复位置彼此独立。
- 短页不会为了配合长页而测量或创建额外列表项。
- 长歌单继续 RecyclerView 虚拟化，没有切 Tab 全量渲染卡顿。
- Header 永远覆盖状态栏，折叠后不会消失。
- Tab 永远吸顶在 Header 下方，不依赖负 margin。
- 不新增第三方依赖，不修改服务端或 PC 端。
- 形成 4 个中文分步提交，且不夹带用户已有的 `app/build.gradle.kts` 变更。
