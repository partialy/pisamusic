package cn.partialy.pm.sync

import android.content.Context
import cn.partialy.pm.network.auth.AccountSessionStore

internal class LibraryAccountScope(private val context: Context) {
    fun current(): String = AccountSessionStore.read(context).let { if (it.loggedIn) it.user.id.trim() else "" }
}
