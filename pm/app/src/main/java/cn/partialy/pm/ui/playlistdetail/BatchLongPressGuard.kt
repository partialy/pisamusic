package cn.partialy.pm.ui.playlistdetail

import android.os.SystemClock

/** 防止 RecyclerView 长按与快速重复手势连续打开多个管理 Activity。 */
class BatchLongPressGuard {
    private var lastLaunch = -1L

    fun acquire(): Boolean {
        val now = SystemClock.elapsedRealtime()
        if (lastLaunch >= 0 && now - lastLaunch < 900L) return false
        lastLaunch = now
        return true
    }
}
