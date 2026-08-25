package cn.partialy.pm.network.discovery

import java.util.concurrent.atomic.AtomicBoolean
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.yield
import okhttp3.Call
import okhttp3.Callback
import okhttp3.Request
import okhttp3.Response
import okio.Timeout
import org.junit.Assert.assertTrue
import org.junit.Test

class DiscoveryCallAwaitTest {
    @Test
    fun `coroutine cancellation cancels pending okhttp call`() = runBlocking {
        val call = PendingCall()
        val job = launch {
            call.awaitResult { response -> response.code }
        }
        yield()

        job.cancelAndJoin()

        assertTrue(call.cancelled.get())
    }

    private class PendingCall : Call {
        val cancelled = AtomicBoolean(false)

        override fun request(): Request = Request.Builder().url("https://discovery.example.com/config.json").build()
        override fun execute(): Response = error("synchronous execute must not be used")
        override fun enqueue(responseCallback: Callback) = Unit
        override fun cancel() {
            cancelled.set(true)
        }
        override fun isExecuted(): Boolean = false
        override fun isCanceled(): Boolean = cancelled.get()
        override fun timeout(): Timeout = Timeout.NONE
        override fun clone(): Call = PendingCall()
    }
}
