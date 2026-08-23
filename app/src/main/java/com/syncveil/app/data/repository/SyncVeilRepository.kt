package com.syncveil.app.data.repository

import android.content.Context
import com.syncveil.app.data.AppDatabase
import com.syncveil.app.data.SessionManager
import com.syncveil.app.data.UserEntity
import com.syncveil.app.data.VaultItem
import com.syncveil.app.data.api.ApiResponse
import com.syncveil.app.data.api.AuthResponseData
import com.syncveil.app.data.api.SecurityTelemetryDto
import com.syncveil.app.data.api.SyncVeilApiClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.withContext

class SyncVeilRepository(private val context: Context) {

    private val db = AppDatabase.getDatabase(context)
    private val vaultDao = db.vaultDao()
    private val userDao = db.userDao()
    val sessionManager = SessionManager(context)

    val apiClient = SyncVeilApiClient {
        // Synchronously get token in background IO dispatcher
        kotlinx.coroutines.runBlocking(Dispatchers.IO) {
            sessionManager.getAccessToken()
        }
    }

    companion object {
        @Volatile
        private var INSTANCE: SyncVeilRepository? = null

        fun getInstance(context: Context): SyncVeilRepository {
            return INSTANCE ?: synchronized(this) {
                val instance = SyncVeilRepository(context.applicationContext)
                INSTANCE = instance
                instance
            }
        }
    }

    // 1. Authenticate with Login Credentials
    suspend fun login(identifier: String, password: String): ApiResponse<AuthResponseData> = withContext(Dispatchers.IO) {
        val response = apiClient.login(identifier, password)
        if (response.isSuccess && response.data != null) {
            val auth = response.data
            if (!auth.requires2Fa) {
                sessionManager.saveAuthResponse(auth)
                // Cache user in Room
                userDao.insertUser(
                    UserEntity(
                        id = auth.userId,
                        username = auth.username,
                        email = auth.email,
                        fullName = auth.fullName,
                        is2faEnabled = auth.is2faEnabled,
                        isPasskeyEnabled = auth.isPasskeyEnabled,
                        securityScore = auth.securityScore,
                        tenantId = auth.tenantId
                    )
                )
                // Trigger background vault refresh
                refreshVaultFromCloud()
            }
        }
        response
    }

    // 2. Register Account
    suspend fun register(
        fullName: String,
        username: String,
        email: String,
        password: String,
        enable2fa: Boolean
    ): ApiResponse<AuthResponseData> = withContext(Dispatchers.IO) {
        val response = apiClient.register(fullName, username, email, password, enable2fa)
        if (response.isSuccess && response.data != null) {
            val auth = response.data
            if (!auth.requires2Fa) {
                sessionManager.saveAuthResponse(auth)
                userDao.insertUser(
                    UserEntity(
                        id = auth.userId,
                        username = auth.username,
                        email = auth.email,
                        fullName = auth.fullName,
                        is2faEnabled = auth.is2faEnabled,
                        isPasskeyEnabled = auth.isPasskeyEnabled,
                        securityScore = auth.securityScore,
                        tenantId = auth.tenantId
                    )
                )
            }
        }
        response
    }

    // 3. Send OTP
    suspend fun sendOtp(email: String): ApiResponse<String> = withContext(Dispatchers.IO) {
        apiClient.sendOtp(email)
    }

    // 4. Verify OTP
    suspend fun verifyOtp(email: String, code: String): ApiResponse<AuthResponseData> = withContext(Dispatchers.IO) {
        val response = apiClient.verifyOtp(email, code)
        if (response.isSuccess && response.data != null) {
            val auth = response.data
            sessionManager.saveAuthResponse(auth)
            userDao.insertUser(
                UserEntity(
                    id = auth.userId,
                    username = auth.username,
                    email = auth.email,
                    fullName = auth.fullName,
                    is2faEnabled = auth.is2faEnabled,
                    isPasskeyEnabled = auth.isPasskeyEnabled,
                    securityScore = auth.securityScore,
                    tenantId = auth.tenantId
                )
            )
            refreshVaultFromCloud()
        }
        response
    }

    // 5. Verify 2FA
    suspend fun verify2Fa(userId: String, code: String): ApiResponse<AuthResponseData> = withContext(Dispatchers.IO) {
        val response = apiClient.verify2Fa(userId, code)
        if (response.isSuccess && response.data != null) {
            val auth = response.data
            sessionManager.saveAuthResponse(auth)
            userDao.insertUser(
                UserEntity(
                    id = auth.userId,
                    username = auth.username,
                    email = auth.email,
                    fullName = auth.fullName,
                    is2faEnabled = auth.is2faEnabled,
                    isPasskeyEnabled = auth.isPasskeyEnabled,
                    securityScore = auth.securityScore,
                    tenantId = auth.tenantId
                )
            )
            refreshVaultFromCloud()
        }
        response
    }

    // 6. Validate current session with server
    suspend fun validateSession(): Boolean = withContext(Dispatchers.IO) {
        val token = sessionManager.getAccessToken()
        if (token.isNullOrBlank()) return@withContext false

        val response = apiClient.getProfile()
        if (response.isSuccess && response.data != null) {
            val auth = response.data
            sessionManager.saveAuthResponse(auth)
            true
        } else if (response.statusCode == 401 || response.statusCode == 403) {
            sessionManager.clearSession()
            false
        } else {
            // If offline/network error, allow offline session if already saved
            true
        }
    }

    // 7. Logout
    suspend fun logout() = withContext(Dispatchers.IO) {
        sessionManager.clearSession()
        vaultDao.clearAll()
        userDao.clearAll()
    }

    // 8. Vault Items Flow (Room Cache replica)
    fun getVaultItems(): Flow<List<VaultItem>> {
        return vaultDao.getAllItems()
    }

    // 9. Sync Vault from Cloud (Authoritative backend)
    suspend fun refreshVaultFromCloud(): Boolean = withContext(Dispatchers.IO) {
        val response = apiClient.getVaultItems()
        if (response.isSuccess && response.data != null) {
            val currentUserId = sessionManager.currentUserId.firstOrNull() ?: ""
            val entities = response.data.map { dto ->
                VaultItem(
                    serverId = dto.id,
                    userId = currentUserId,
                    title = dto.title,
                    content = dto.content,
                    category = dto.category,
                    createdAt = dto.createdAt,
                    isSynced = true
                )
            }
            vaultDao.clearAll()
            vaultDao.insertAll(entities)
            true
        } else {
            false
        }
    }

    // 10. Add Vault item (Authoritative backend + Local Cache)
    suspend fun addVaultItem(title: String, content: String, category: String): ApiResponse<VaultItem> = withContext(Dispatchers.IO) {
        val currentUserId = sessionManager.currentUserId.firstOrNull() ?: ""
        val cloudResponse = apiClient.createVaultItem(title, content, category)
        val serverId = if (cloudResponse.isSuccess && cloudResponse.data != null) {
            cloudResponse.data.id
        } else {
            "local_${System.currentTimeMillis()}"
        }

        val localItem = VaultItem(
            serverId = serverId,
            userId = currentUserId,
            title = title,
            content = content,
            category = category,
            createdAt = System.currentTimeMillis(),
            isSynced = cloudResponse.isSuccess
        )
        val generatedId = vaultDao.insertItem(localItem)
        val resultItem = localItem.copy(id = generatedId.toInt())

        if (cloudResponse.isSuccess) {
            ApiResponse(true, cloudResponse.statusCode, data = resultItem)
        } else {
            ApiResponse(true, 200, data = resultItem, errorMessage = cloudResponse.errorMessage)
        }
    }

    // 11. Delete Vault item
    suspend fun deleteVaultItem(item: VaultItem): ApiResponse<Unit> = withContext(Dispatchers.IO) {
        vaultDao.deleteItem(item)
        if (item.serverId.isNotBlank() && !item.serverId.startsWith("local_")) {
            apiClient.deleteVaultItem(item.serverId)
        } else {
            ApiResponse(true, 200, data = Unit)
        }
    }

    // 12. Security Telemetry
    suspend fun getSecurityTelemetry(): ApiResponse<SecurityTelemetryDto> = withContext(Dispatchers.IO) {
        apiClient.getSecurityTelemetry()
    }

    // 13. Ping Backend Connectivity Check
    suspend fun pingBackend(): ApiResponse<Int> = withContext(Dispatchers.IO) {
        apiClient.pingBackend()
    }
}
