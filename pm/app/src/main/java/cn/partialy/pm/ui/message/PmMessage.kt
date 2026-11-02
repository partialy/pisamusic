package cn.partialy.pm.ui.message

import android.app.Activity
import android.app.Application
import android.app.Dialog
import androidx.annotation.StringRes
import androidx.fragment.app.Fragment
import java.lang.ref.WeakReference
import java.util.concurrent.atomic.AtomicLong

/** 原生 UI 轻提示唯一入口；后台或失效宿主调用安全丢弃。 */
object PmMessage {
    private val sequence = AtomicLong()
    fun init(application: Application) = PmMessageHost.init(application)
    fun register(dialog: Dialog) = PmMessageHost.register(dialog)
    fun unregister(dialog: Dialog) = PmMessageHost.unregister(dialog)

    internal fun show(activity: Activity?, type: MessageType, text: CharSequence, durationMs: Long, dialog: Dialog?, fragmentView: android.view.View? = null): MessageHandle {
        require(durationMs >= 0) { "durationMs must be non-negative" }
        val handle = MessageHandle(sequence.incrementAndGet())
        val owner = WeakReference(activity)
        val window = WeakReference(dialog)
        val view = WeakReference(fragmentView)
        val requiresView = fragmentView != null
        val message = text.toString()
        PmMessageHost.onMain {
            val attachedView = view.get()
            if (requiresView && attachedView?.isAttachedToWindow != true) return@onMain
            owner.get()?.let { PmMessageHost.show(it, type, message, durationMs, window.get(), handle, attachedView) }
        }
        return handle
    }
    fun info(activity: Activity, text: CharSequence, durationMs: Long = 2_000L, dialog: Dialog? = null): MessageHandle =
        show(activity, MessageType.INFO, text, durationMs, dialog)
    fun info(activity: Activity, @StringRes text: Int, durationMs: Long = 2_000L, dialog: Dialog? = null): MessageHandle =
        info(activity, activity.getText(text), durationMs, dialog)
    fun info(fragment: Fragment, text: CharSequence, durationMs: Long = 2_000L, dialog: Dialog? = null): MessageHandle =
        if (fragment.isAdded && fragment.view != null) show(fragment.activity, MessageType.INFO, text, durationMs, dialog, fragment.view) else MessageHandle(-1)
    fun info(fragment: Fragment, @StringRes text: Int, durationMs: Long = 2_000L, dialog: Dialog? = null): MessageHandle =
        fragment.context?.let { info(fragment, it.getText(text), durationMs, dialog) } ?: MessageHandle(-1)
    fun success(activity: Activity, text: CharSequence, durationMs: Long = 2_000L, dialog: Dialog? = null): MessageHandle =
        show(activity, MessageType.SUCCESS, text, durationMs, dialog)
    fun success(activity: Activity, @StringRes text: Int, durationMs: Long = 2_000L, dialog: Dialog? = null): MessageHandle =
        success(activity, activity.getText(text), durationMs, dialog)
    fun success(fragment: Fragment, text: CharSequence, durationMs: Long = 2_000L, dialog: Dialog? = null): MessageHandle =
        if (fragment.isAdded && fragment.view != null) show(fragment.activity, MessageType.SUCCESS, text, durationMs, dialog, fragment.view) else MessageHandle(-1)
    fun success(fragment: Fragment, @StringRes text: Int, durationMs: Long = 2_000L, dialog: Dialog? = null): MessageHandle =
        fragment.context?.let { success(fragment, it.getText(text), durationMs, dialog) } ?: MessageHandle(-1)
    fun warning(activity: Activity, text: CharSequence, durationMs: Long? = null, dialog: Dialog? = null): MessageHandle =
        show(activity, MessageType.WARNING, text, durationMs ?: if (text.length > 40) 3_000L else 2_000L, dialog)
    fun warning(activity: Activity, @StringRes text: Int, durationMs: Long? = null, dialog: Dialog? = null): MessageHandle =
        warning(activity, activity.getText(text), durationMs, dialog)
    fun warning(fragment: Fragment, text: CharSequence, durationMs: Long? = null, dialog: Dialog? = null): MessageHandle =
        if (fragment.isAdded && fragment.view != null) show(fragment.activity, MessageType.WARNING, text, durationMs ?: if (text.length > 40) 3_000L else 2_000L, dialog, fragment.view) else MessageHandle(-1)
    fun warning(fragment: Fragment, @StringRes text: Int, durationMs: Long? = null, dialog: Dialog? = null): MessageHandle =
        fragment.context?.let { warning(fragment, it.getText(text), durationMs, dialog) } ?: MessageHandle(-1)
    fun error(activity: Activity, text: CharSequence, durationMs: Long? = null, dialog: Dialog? = null): MessageHandle =
        show(activity, MessageType.ERROR, text, durationMs ?: if (text.length > 40) 3_000L else 2_000L, dialog)
    fun error(activity: Activity, @StringRes text: Int, durationMs: Long? = null, dialog: Dialog? = null): MessageHandle =
        error(activity, activity.getText(text), durationMs, dialog)
    fun error(fragment: Fragment, text: CharSequence, durationMs: Long? = null, dialog: Dialog? = null): MessageHandle =
        if (fragment.isAdded && fragment.view != null) show(fragment.activity, MessageType.ERROR, text, durationMs ?: if (text.length > 40) 3_000L else 2_000L, dialog, fragment.view) else MessageHandle(-1)
    fun error(fragment: Fragment, @StringRes text: Int, durationMs: Long? = null, dialog: Dialog? = null): MessageHandle =
        fragment.context?.let { error(fragment, it.getText(text), durationMs, dialog) } ?: MessageHandle(-1)
}
