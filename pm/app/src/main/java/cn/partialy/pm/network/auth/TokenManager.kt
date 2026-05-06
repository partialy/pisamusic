package cn.partialy.pm.network.auth

object TokenManager {
    private var token: String? = "partialy"
    
    fun getToken(): String? {
        return token
    }
    
    fun setToken(newToken: String) {
        token = newToken
    }
    
    fun clearToken() {
        token = "partialy"
    }
} 