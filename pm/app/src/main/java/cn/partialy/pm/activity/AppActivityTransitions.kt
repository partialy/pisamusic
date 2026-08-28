package cn.partialy.pm.activity

import android.app.Activity
import android.content.Context
import cn.partialy.pm.R

import android.content.ContextWrapper

/**
 * 应用内 Activity 统一横向过渡动画。
 */
object AppActivityTransitions {
    fun applyForward(context: Context) {
        context.findActivity()?.overridePendingTransition(
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
        context.findActivity()?.overridePendingTransition(
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

    private fun Context.findActivity(): Activity? {
        var ctx: Context? = this
        while (ctx is ContextWrapper) {
            if (ctx is Activity) return ctx
            ctx = ctx.baseContext
        }
        return null
    }
}
