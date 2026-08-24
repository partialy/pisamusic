package cn.partialy.pm.activity

/** MainActivity 内互斥显示的顶层内容页，也是窗口系统栏样式归属的唯一依据。 */
internal enum class MainTopLevelDestination(val savedValue: String) {
    HOME("home"),
    DISCOVER("discover"),
    MINE("mine"),
    ;

    companion object {
        fun restore(savedValue: String?): MainTopLevelDestination =
            values().firstOrNull { it.savedValue == savedValue } ?: HOME
    }
}
