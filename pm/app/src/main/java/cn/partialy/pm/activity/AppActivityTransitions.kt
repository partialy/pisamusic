package cn.partialy.pm.activity

import android.app.Activity
import android.content.Context
import cn.partialy.pm.R

/**
 * 应用内 Activity 统一横向过渡动画。
 */
object AppActivityTransitions {
    fun applyForward(context: Context) {
        (context as? Activity)?.overridePendingTransition(
            R.anim.slide_to_left,
            R.anim.dim_and_scale_out,
        )
    }

    fun applyBack(activity: Activity) {
        activity.overridePendingTransition(
            R.anim.playlist_previous_scale_from_95,
            R.anim.slide_to_right,
        )
    }

    fun applyPlayerForward(context: Context) {
        (context as? Activity)?.overridePendingTransition(
            R.anim.slide_up,
            R.anim.dim_and_scale_out,
        )
    }

    fun applyPlayerBack(activity: Activity) {
        activity.overridePendingTransition(
            R.anim.dim_and_scale_in,
            R.anim.slide_down,
        )
    }
}
