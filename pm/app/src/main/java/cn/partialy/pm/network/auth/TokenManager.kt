package cn.partialy.pm.network.auth

import android.content.Context

object TokenManager {
    private var token: String? = null

    fun init(context: Context) {
        token = AccountSessionStore.read(context).token.ifBlank { null }
    }
    
    fun getToken(): String? {
        return token
    }
    
    fun setToken(newToken: String) {
        token = newToken
    }
    
    fun clearToken() {
        token = null
    }
} 
