# Android UI String Resources Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move native Android user-visible hardcoded copy into `pm/app/src/main/res/values/strings.xml` without changing the displayed wording or interaction behavior.

**Architecture:** Android XML references use `@string/...`; Activities, Fragments, adapters, dialogs, and managers that already own a `Context` resolve copy with `getString(...)` or `context.getString(...)`. Protocol values, logs, exceptions used only for diagnostics, URLs, date patterns, separators, source IDs, and server-provided text remain code constants because they are not app-managed UI copy.

**Tech Stack:** Android XML resources, Kotlin, ViewBinding, Android Gradle Plugin lint/compile tasks.

## Global Constraints

- Work only in `pm/` and the implementation plan under `docs/superpowers/plans/`.
- Preserve the user's existing scanner, theme, icon, `AGENTS.md`, component-index, and `strings.xml` edits.
- Reuse an existing string resource when wording and formatting semantics match.
- Keep validation lightweight: resource/static checks only; compilation and device testing are left to the user per the latest instruction.
- Do not create a Git commit unless the user explicitly asks.

---

### Task 1: Inventory Native UI Hardcoded Copy

**Files:**
- Inspect: `pm/app/src/main/res/**/*.xml`
- Inspect: `pm/app/src/main/java/**/*.kt`
- Inspect: `pm/app/src/main/java/**/*.java`

**Interfaces:**
- Consumes: Android resource XML and native presentation-layer source.
- Produces: A classified list of literal copy that is directly rendered by views, Toasts, dialogs, notifications, settings rows, or UI state events.

- [x] **Step 1: Scan XML literals**

Run:

```powershell
rg -n --pcre2 'android:(text|hint|contentDescription|label|title|summary)="(?!@|\?|\s*$)[^"]+"' pm/app/src/main/res -g '*.xml'
```

Expected: only literal resource attributes are printed; numeric placeholders and non-language symbols are reviewed separately.

- [x] **Step 2: Scan presentation-layer string literals**

Run:

```powershell
rg -n --pcre2 '"[^"\r\n]*\p{Han}[^"\r\n]*"' pm/app/src/main/java/cn/partialy/pm/activity pm/app/src/main/java/cn/partialy/pm/ui pm/app/src/main/java/cn/partialy/pm/listen pm/app/src/main/java/cn/partialy/pm/service -g '*.kt' -g '*.java'
```

Expected: candidate Chinese literals are printed for classification; diagnostic-only and protocol strings are excluded from editing.

### Task 2: Extract XML and Direct Presentation Copy

**Files:**
- Modify: `pm/app/src/main/res/values/strings.xml`
- Modify: matching files under `pm/app/src/main/res/layout/`
- Modify: matching Activities, Fragments, adapters, dialogs, and presentation managers under `pm/app/src/main/java/`

**Interfaces:**
- Consumes: the Task 1 classified inventory.
- Produces: named `R.string` resources and resource-based UI calls with unchanged rendered copy.

- [x] **Step 1: Add resource entries**

Add stable, feature-prefixed keys to `strings.xml`. Dynamic text uses positional formatting, for example:

```xml
<string name="search_start_playing">开始播放：%1$s</string>
<string name="playlist_track_count">%1$d首</string>
```

- [x] **Step 2: Replace XML literals**

Replace visible language copy with resource references, for example:

```xml
android:text="@string/announcement_view"
android:contentDescription="@string/error_copy_details"
```

- [x] **Step 3: Replace Kotlin/Java UI literals**

Use the closest existing `Context`, for example:

```kotlin
showMessage(getString(R.string.common_not_available_yet))
Toast.makeText(this, R.string.common_open_link_failed, Toast.LENGTH_SHORT).show()
binding.trackCountTextView.text = getString(R.string.playlist_track_count, count)
```

Do not replace dynamic data, logs, protocol keys, URL/path values, regular expressions, or diagnostic-only exception messages.

### Task 3: Verify Resource Integrity

**Files:**
- Verify: all modified files from Task 2.

**Interfaces:**
- Consumes: resource references and Kotlin/Java callers from Task 2.
- Produces: statically checked Android resource references and patch formatting.

- [x] **Step 1: Re-run hardcoded-copy scans**

Run the two Task 1 commands again.

Expected: no remaining native language UI literal in XML or direct presentation calls; intentional placeholders/diagnostics are documented as exclusions.

- [x] **Step 2: Check patch whitespace**

Run:

```powershell
git diff --check -- pm docs/superpowers/plans/2026-08-27-android-ui-string-resources.md
```

Expected: exit code `0` with no output.

- [x] **Step 3: Leave runtime verification to the user**

No Gradle test, build, app launch, or device test is performed.
