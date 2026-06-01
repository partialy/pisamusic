package cn.partialy.pm.activity

import android.app.Activity
import android.content.Context

/**
 * 与 [PlayerActivity] 一致的进出动画，用于酷狗 / 网易云导入登录页。
 */
object PlaylistLoginNavTransitions {

    /** 在调用方 `startActivity` 之后立即调用（需 [Context] 为 [Activity]）。 */
    fun applyOpenFromCaller(context: Context) {
        AppActivityTransitions.applyForward(context)
    }

    /** 在 `super.finish()` 之后调用，与 [PlayerActivity.finish] 一致。 */
    fun applyCloseAfterFinish(activity: Activity) {
        AppActivityTransitions.applyBack(activity)
    }
}
