package com.syncveil.app.data.api

import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import javax.net.ssl.HttpsURLConnection

data class ApiResponse<T>(
    val isSuccess: Boolean,
    val statusCode: Int,
    val data: T? = null,
    val errorMessage: String? = null
)

data class AuthResponseData(
    val token: String?,
    val userId: String,
    val username: String,
    val email: String,
    val fullName: String,
    val is2faEnabled: Boolean,
    val isPasskeyEnabled: Boolean,
    val securityScore: Int,
    val tenantId: String,
    val requires2Fa: Boolean = false
)

data class VaultRecordDto(
    val id: String,
    val title: String,
    val content: String,
    val category: String,
    val createdAt: Long,
    val updatedAt: Long = System.currentTimeMillis()
)

data class SecurityTelemetryDto(
    val pingMs: Int,
    val threatsBlocked: Int,
    val securityScore: Int,
    val isOperational: Boolean,
    val cipherSuite: String,
    val tenantId: String,
    val events: List<TelemetryEventDto>
)

data class TelemetryEventDto(
    val id: String,
    val title: String,
    val type: String,
    val timestamp: String,
    val latencyMs: Int,
    val status: String = "OK"
)

class SyncVeilApiClient(private val tokenProvider: () -> String?) {

    companion object {
        private const val TAG = "SyncVeilApiClient"
    }

    private suspend fun performHttpRequest(
        endpointPath: String,
        method: String = "GET",
        jsonBody: JSONObject? = null
    ): ApiResponse<JSONObject> = withContext(Dispatchers.IO) {
        var connection: HttpURLConnection? = null
        try {
            val urlString = ApiConfig.getEndpoint(endpointPath)
            val url = URL(urlString)
            connection = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = method
                connectTimeout = ApiConfig.API_TIMEOUT_MS
                readTimeout = ApiConfig.API_TIMEOUT_MS
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
                setRequestProperty("Accept", "application/json")
                setRequestProperty("User-Agent", "SyncVeil-Android-Client/1.0")

                val token = tokenProvider()
                if (!token.isNullOrBlank()) {
                    setRequestProperty("Authorization", "Bearer $token")
                }

                if (jsonBody != null && (method == "POST" || method == "PUT" || method == "PATCH")) {
                    doOutput = true
                    OutputStreamWriter(outputStream, "UTF-8").use { writer ->
                        writer.write(jsonBody.toString())
                        writer.flush()
                    }
                }
            }

            val statusCode = connection.responseCode
            val isSuccess = statusCode in 200..299

            val inputStream = if (isSuccess) connection.inputStream else (connection.errorStream ?: connection.inputStream)
            val responseText = BufferedReader(InputStreamReader(inputStream, "UTF-8")).use { it.readText() }

            val jsonResponse = try {
                if (responseText.isNotBlank()) JSONObject(responseText) else JSONObject()
            } catch (e: Exception) {
                JSONObject().apply {
                    put("raw", responseText)
                }
            }

            if (isSuccess) {
                ApiResponse(isSuccess = true, statusCode = statusCode, data = jsonResponse)
            } else {
                val errorMsg = when {
                    jsonResponse.has("message") -> jsonResponse.getString("message")
                    jsonResponse.has("error") -> jsonResponse.getString("error")
                    statusCode == 401 -> "Invalid credentials or session expired. Please authenticate."
                    statusCode == 403 -> "Access forbidden. Security policy violated."
                    statusCode == 404 -> "Requested resource was not found on the server."
                    statusCode == 429 -> "Rate limit exceeded. Please wait before retrying."
                    statusCode >= 500 -> "SyncVeil server error ($statusCode). Please try again later."
                    else -> "Network request failed (Code $statusCode)"
                }
                ApiResponse(isSuccess = false, statusCode = statusCode, data = jsonResponse, errorMessage = errorMsg)
            }
        } catch (e: java.net.SocketTimeoutException) {
            ApiResponse(isSuccess = false, statusCode = 408, errorMessage = "Connection timed out. Check network connection.")
        } catch (e: java.net.UnknownHostException) {
            ApiResponse(isSuccess = false, statusCode = 0, errorMessage = "Unable to connect to SyncVeil server. Check network connection.")
        } catch (e: Exception) {
            Log.e(TAG, "Request failed: ${e.message}", e)
            ApiResponse(isSuccess = false, statusCode = 0, errorMessage = e.localizedMessage ?: "Network connection error occurred.")
        } finally {
            connection?.disconnect()
        }
    }

    // 1. Authenticate with Password
    suspend fun login(identifier: String, password: String): ApiResponse<AuthResponseData> {
        val payload = JSONObject().apply {
            put("identifier", identifier.trim())
            put("password", password)
        }
        val response = performHttpRequest("/api/auth/login", "POST", payload)
        if (!response.isSuccess) {
            return ApiResponse(false, response.statusCode, errorMessage = response.errorMessage)
        }

        val dataObj = response.data ?: return ApiResponse(false, response.statusCode, errorMessage = "Empty server response")
        val parsed = parseAuthData(dataObj)
        return ApiResponse(true, response.statusCode, data = parsed)
    }

    // 2. Register new Account
    suspend fun register(
        fullName: String,
        username: String,
        email: String,
        password: String,
        enable2fa: Boolean
    ): ApiResponse<AuthResponseData> {
        val payload = JSONObject().apply {
            put("fullName", fullName.trim())
            put("username", username.trim())
            put("email", email.trim().lowercase())
            put("password", password)
            put("enable2fa", enable2fa)
        }
        val response = performHttpRequest("/api/auth/register", "POST", payload)
        if (!response.isSuccess) {
            return ApiResponse(false, response.statusCode, errorMessage = response.errorMessage)
        }

        val dataObj = response.data ?: return ApiResponse(false, response.statusCode, errorMessage = "Empty server response")
        val parsed = parseAuthData(dataObj)
        return ApiResponse(true, response.statusCode, data = parsed)
    }

    // 3. Send OTP to real user email
    suspend fun sendOtp(email: String): ApiResponse<String> {
        val payload = JSONObject().apply {
            put("email", email.trim().lowercase())
        }
        val response = performHttpRequest("/api/auth/otp/send", "POST", payload)
        if (!response.isSuccess) {
            return ApiResponse(false, response.statusCode, errorMessage = response.errorMessage)
        }
        val message = response.data?.optString("message", "One-Time Password has been dispatched to your email address.") 
            ?: "OTP sent successfully"
        return ApiResponse(true, response.statusCode, data = message)
    }

    // 4. Verify OTP code
    suspend fun verifyOtp(email: String, code: String): ApiResponse<AuthResponseData> {
        val payload = JSONObject().apply {
            put("email", email.trim().lowercase())
            put("code", code.trim())
        }
        val response = performHttpRequest("/api/auth/otp/verify", "POST", payload)
        if (!response.isSuccess) {
            return ApiResponse(false, response.statusCode, errorMessage = response.errorMessage)
        }

        val dataObj = response.data ?: return ApiResponse(false, response.statusCode, errorMessage = "Empty server response")
        val parsed = parseAuthData(dataObj)
        return ApiResponse(true, response.statusCode, data = parsed)
    }

    // 5. Verify 2FA TOTP
    suspend fun verify2Fa(userId: String, code: String): ApiResponse<AuthResponseData> {
        val payload = JSONObject().apply {
            put("userId", userId)
            put("code", code.trim())
        }
        val response = performHttpRequest("/api/auth/2fa/verify", "POST", payload)
        if (!response.isSuccess) {
            return ApiResponse(false, response.statusCode, errorMessage = response.errorMessage)
        }

        val dataObj = response.data ?: return ApiResponse(false, response.statusCode, errorMessage = "Empty server response")
        val parsed = parseAuthData(dataObj)
        return ApiResponse(true, response.statusCode, data = parsed)
    }

    // 6. Fetch User Profile / Validate Session
    suspend fun getProfile(): ApiResponse<AuthResponseData> {
        val response = performHttpRequest("/api/user/profile", "GET")
        if (!response.isSuccess) {
            return ApiResponse(false, response.statusCode, errorMessage = response.errorMessage)
        }
        val dataObj = response.data ?: return ApiResponse(false, response.statusCode, errorMessage = "Empty profile data")
        val parsed = parseAuthData(dataObj)
        return ApiResponse(true, response.statusCode, data = parsed)
    }

    // 7. Get Vault Items
    suspend fun getVaultItems(): ApiResponse<List<VaultRecordDto>> {
        val response = performHttpRequest("/api/vault", "GET")
        if (!response.isSuccess) {
            return ApiResponse(false, response.statusCode, errorMessage = response.errorMessage)
        }

        val items = mutableListOf<VaultRecordDto>()
        val dataObj = response.data
        if (dataObj != null) {
            val arr = dataObj.optJSONArray("items") ?: dataObj.optJSONArray("data")
            if (arr != null) {
                for (i in 0 until arr.length()) {
                    val obj = arr.getJSONObject(i)
                    items.add(
                        VaultRecordDto(
                            id = obj.optString("id", obj.optString("_id", "")),
                            title = obj.optString("title", "Untitled"),
                            content = obj.optString("content", ""),
                            category = obj.optString("category", "Note"),
                            createdAt = obj.optLong("createdAt", System.currentTimeMillis()),
                            updatedAt = obj.optLong("updatedAt", System.currentTimeMillis())
                        )
                    )
                }
            }
        }
        return ApiResponse(true, response.statusCode, data = items)
    }

    // 8. Create Vault Item
    suspend fun createVaultItem(title: String, content: String, category: String): ApiResponse<VaultRecordDto> {
        val payload = JSONObject().apply {
            put("title", title)
            put("content", content)
            put("category", category)
        }
        val response = performHttpRequest("/api/vault", "POST", payload)
        if (!response.isSuccess) {
            return ApiResponse(false, response.statusCode, errorMessage = response.errorMessage)
        }
        val obj = response.data?.optJSONObject("item") ?: response.data ?: JSONObject()
        val dto = VaultRecordDto(
            id = obj.optString("id", System.currentTimeMillis().toString()),
            title = obj.optString("title", title),
            content = obj.optString("content", content),
            category = obj.optString("category", category),
            createdAt = obj.optLong("createdAt", System.currentTimeMillis()),
            updatedAt = obj.optLong("updatedAt", System.currentTimeMillis())
        )
        return ApiResponse(true, response.statusCode, data = dto)
    }

    // 9. Delete Vault Item
    suspend fun deleteVaultItem(id: String): ApiResponse<Unit> {
        val response = performHttpRequest("/api/vault/$id", "DELETE")
        return if (response.isSuccess) {
            ApiResponse(true, response.statusCode, data = Unit)
        } else {
            ApiResponse(false, response.statusCode, errorMessage = response.errorMessage)
        }
    }

    // 10. Fetch Live Security Telemetry & Breach Metrics
    suspend fun getSecurityTelemetry(): ApiResponse<SecurityTelemetryDto> {
        val response = performHttpRequest("/api/security/telemetry", "GET")
        if (!response.isSuccess) {
            return ApiResponse(false, response.statusCode, errorMessage = response.errorMessage)
        }

        val dataObj = response.data ?: JSONObject()
        val eventsList = mutableListOf<TelemetryEventDto>()
        val eventsArr = dataObj.optJSONArray("events")
        if (eventsArr != null) {
            for (i in 0 until eventsArr.length()) {
                val ev = eventsArr.getJSONObject(i)
                eventsList.add(
                    TelemetryEventDto(
                        id = ev.optString("id", "ev_$i"),
                        title = ev.optString("title", "Security Event"),
                        type = ev.optString("type", "SYNC"),
                        timestamp = ev.optString("timestamp", "Just now"),
                        latencyMs = ev.optInt("latencyMs", 24),
                        status = ev.optString("status", "OK")
                    )
                )
            }
        }

        val telemetry = SecurityTelemetryDto(
            pingMs = dataObj.optInt("pingMs", 28),
            threatsBlocked = dataObj.optInt("threatsBlocked", 18),
            securityScore = dataObj.optInt("securityScore", 98),
            isOperational = dataObj.optBoolean("isOperational", true),
            cipherSuite = dataObj.optString("cipherSuite", "SSCE-v3 / XChaCha20-Poly1305"),
            tenantId = dataObj.optString("tenantId", "SV-CORP-94812"),
            events = eventsList
        )
        return ApiResponse(true, response.statusCode, data = telemetry)
    }

    // 11. Ping Backend / Health Check
    suspend fun pingBackend(): ApiResponse<Int> = withContext(Dispatchers.IO) {
        val startTime = System.currentTimeMillis()
        val response = performHttpRequest("/api/health", "GET")
        val latency = (System.currentTimeMillis() - startTime).toInt().coerceAtLeast(1)
        if (response.isSuccess) {
            ApiResponse(true, response.statusCode, data = latency)
        } else {
            // Try fallback root ping
            val rootResponse = performHttpRequest("/", "GET")
            val rootLatency = (System.currentTimeMillis() - startTime).toInt().coerceAtLeast(1)
            if (rootResponse.isSuccess || rootResponse.statusCode in 200..404) {
                ApiResponse(true, rootResponse.statusCode, data = rootLatency)
            } else {
                ApiResponse(false, response.statusCode, data = latency, errorMessage = response.errorMessage)
            }
        }
    }

    private fun parseAuthData(obj: JSONObject): AuthResponseData {
        val userObj = obj.optJSONObject("user") ?: obj
        val token = obj.optString("token").takeIf { it.isNotBlank() }
            ?: obj.optString("accessToken").takeIf { it.isNotBlank() }
            ?: userObj.optString("token").takeIf { it.isNotBlank() }

        val requires2Fa = obj.optBoolean("requires2FA", false) || obj.optBoolean("requires2fa", false)

        return AuthResponseData(
            token = token,
            userId = userObj.optString("id", userObj.optString("_id", "usr_${System.currentTimeMillis()}")),
            username = userObj.optString("username", userObj.optString("email", "").substringBefore("@")),
            email = userObj.optString("email", ""),
            fullName = userObj.optString("fullName", userObj.optString("name", "SyncVeil User")),
            is2faEnabled = userObj.optBoolean("is2faEnabled", userObj.optBoolean("twoFactorEnabled", false)),
            isPasskeyEnabled = userObj.optBoolean("isPasskeyEnabled", true),
            securityScore = userObj.optInt("securityScore", 98),
            tenantId = userObj.optString("tenantId", "SV-CORP-94812"),
            requires2Fa = requires2Fa
        )
    }
}
