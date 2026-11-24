package cn.partialy.pm.ui.thirdparty

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import cn.partialy.pm.network.cookie.ThirdPartyAccountState
import cn.partialy.pm.network.cookie.ThirdPartyAccountsRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

enum class ThirdPartyAccountsEvent { NETWORK_ERROR, CLEAR_FAILED, CLEARED }

@HiltViewModel
class ThirdPartyAccountsViewModel @Inject constructor(
    private val repository: ThirdPartyAccountsRepository,
) : ViewModel() {
    val states = repository.states
    private val mutableClearing = MutableStateFlow(false)
    val clearing = mutableClearing.asStateFlow()
    private val eventChannel = Channel<ThirdPartyAccountsEvent>(Channel.BUFFERED)
    val events = eventChannel.receiveAsFlow()
    private var validationJob: Job? = null
    private var validationRequested = false
    private var validationPending = false

    fun validateOnResume(recreated: Boolean) {
        if ((recreated && validationRequested) || clearing.value) return
        if (validationJob?.isActive == true) {
            // 登录返回可能早于旧会话查询结束，串行补一轮以校验新会话。
            validationPending = true
            return
        }
        validationRequested = true
        validationJob = viewModelScope.launch {
            do {
                validationPending = false
                try {
                    if (!repository.validateAll()) eventChannel.send(ThirdPartyAccountsEvent.NETWORK_ERROR)
                } catch (cancelled: CancellationException) {
                    throw cancelled
                } catch (_: Exception) {
                    eventChannel.send(ThirdPartyAccountsEvent.NETWORK_ERROR)
                }
            } while (validationPending)
        }
    }

    fun clear(account: ThirdPartyAccountState) = clearSession {
        repository.clear(account.source, account.sessionKey)
    }

    fun clearAll(expected: List<ThirdPartyAccountState>) = clearSession {
        repository.clearAll(expected)
    }

    private fun clearSession(action: suspend () -> Boolean) {
        if (clearing.value) return
        mutableClearing.value = true
        viewModelScope.launch {
            try {
                eventChannel.send(if (action()) ThirdPartyAccountsEvent.CLEARED else ThirdPartyAccountsEvent.CLEAR_FAILED)
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: Exception) {
                eventChannel.send(ThirdPartyAccountsEvent.CLEAR_FAILED)
            } finally {
                mutableClearing.value = false
            }
        }
    }
}
