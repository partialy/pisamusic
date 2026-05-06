package cn.partialy.pm.activity

import android.app.Activity
import android.content.Context
import cn.partialy.pm.R

/**
 * 与 [PlayerActivity] 一致的进出动画，用于酷狗 / 网易云导入登录页。
 */
object PlaylistLoginNavTransitions {

    /** 在调用方 `startActivity` 之后立即调用（需 [Context] 为 [Activity]）。 */
    fun applyOpenFromCaller(context: Context) {
        (context as? Activity)?.overridePendingTransition(
            R.anim.slide_up,
            R.anim.dim_and_scale_out,
        )
    }

    /** 在 `super.finish()` 之后调用，与 [PlayerActivity.finish] 一致。 */
    fun applyCloseAfterFinish(activity: Activity) {
        activity.overridePendingTransition(
            R.anim.dim_and_scale_in,
            R.anim.slide_down,
        )
    }
}
