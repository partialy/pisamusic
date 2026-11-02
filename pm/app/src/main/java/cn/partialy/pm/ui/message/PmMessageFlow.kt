package cn.partialy.pm.ui.message

import androidx.activity.ComponentActivity
import androidx.fragment.app.Fragment
import androidx.annotation.StringRes
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.LifecycleOwner
import android.view.View
import cn.partialy.pm.R
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.launch
import kotlin.coroutines.coroutineContext

/** 门禁跟随 decor，而非全局保存 Activity、Job 或导航闭包。 */
object PmMessageFlow {
    private class CompletionState(var job: Job? = null)

    fun showSuccessThenFinish(activity: ComponentActivity, text: CharSequence, delayMs: Long = 800L): Job? =
        showSuccessThenNavigate(activity, text, delayMs) { activity.finish() }

    fun showSuccessThenFinish(activity: ComponentActivity, @StringRes text: Int, delayMs: Long = 800L): Job? =
        showSuccessThenFinish(activity, activity.getText(text), delayMs)

    fun showSuccessThenNavigate(activity: ComponentActivity, @StringRes text: Int, delayMs: Long = 800L, action: suspend () -> Unit): Job? =
        showSuccessThenNavigate(activity, activity.getText(text), delayMs, action)

    fun showSuccessThenNavigate(activity: ComponentActivity, text: CharSequence, delayMs: Long = 800L, action: suspend () -> Unit): Job? =
        schedule(activity, activity, activity.window.decorView, text, delayMs, action)

    fun showSuccessThenFinish(fragment: Fragment, text: CharSequence, delayMs: Long = 800L): Job? =
        showSuccessThenNavigate(fragment, text, delayMs) { fragment.activity?.finish() }

    fun showSuccessThenFinish(fragment: Fragment, @StringRes text: Int, delayMs: Long = 800L): Job? =
        fragment.context?.let { showSuccessThenFinish(fragment, it.getText(text), delayMs) }

    fun showSuccessThenNavigate(fragment: Fragment, @StringRes text: Int, delayMs: Long = 800L, action: suspend () -> Unit): Job? =
        fragment.context?.let { showSuccessThenNavigate(fragment, it.getText(text), delayMs, action) }

    fun showSuccessThenNavigate(fragment: Fragment, text: CharSequence, delayMs: Long = 800L, action: suspend () -> Unit): Job? {
        val activity = fragment.activity as? ComponentActivity ?: return null
        val view = fragment.view ?: return null
        val owner = fragment.viewLifecycleOwnerLiveData.value ?: return null
        return schedule(activity, owner, view, text, delayMs, action)
    }

    private fun schedule(activity: ComponentActivity, owner: LifecycleOwner, gate: View, text: CharSequence, delayMs: Long, action: suspend () -> Unit): Job? {
        require(delayMs >= 0) { "delayMs must be non-negative" }
        // 所有状态访问都在 Main.immediate 协程内，后台调用同样不会发生竞态。
        return owner.lifecycleScope.launch(Dispatchers.Main.immediate) {
            val decor = gate
            if (decor.getTag(R.id.pm_message_flow) != null || !valid(activity) || !owner.lifecycle.currentState.isAtLeast(Lifecycle.State.STARTED)) return@launch
            val state = CompletionState(coroutineContext[Job])
            decor.setTag(R.id.pm_message_flow, state)
            val observer = LifecycleEventObserver { _, event ->
                if (event == Lifecycle.Event.ON_STOP || event == Lifecycle.Event.ON_DESTROY) state.job?.cancel()
            }
            owner.lifecycle.addObserver(observer)
            val message = PmMessage.success(activity, text)
            try {
                delay(delayMs)
                coroutineContext.ensureActive()
                if (valid(activity) && owner.lifecycle.currentState.isAtLeast(Lifecycle.State.STARTED)) action()
            } finally {
                message.dismiss()
                owner.lifecycle.removeObserver(observer)
                // 仅阻止同时在途的结束流程；业务事件消费由调用方负责。
                state.job = null
                if (decor.getTag(R.id.pm_message_flow) === state) decor.setTag(R.id.pm_message_flow, null)
            }
        }
    }

    private fun valid(activity: ComponentActivity) = !activity.isFinishing && !activity.isDestroyed &&
        activity.lifecycle.currentState.isAtLeast(Lifecycle.State.STARTED)
}
