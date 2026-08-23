package com.syncveil.app.data

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.syncveil.app.data.api.AuthResponseData
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.flow.map

val Context.dataStore by preferencesDataStore(name = "syncveil_session")

class SessionManager(private val context: Context) {

    companion object {
        val KEY_IS_LOGGED_IN = booleanPreferencesKey("is_logged_in")
        val KEY_USER_ID = stringPreferencesKey("user_id")
        val KEY_USER_NAME = stringPreferencesKey("user_name")
        val KEY_USER_EMAIL = stringPreferencesKey("user_email")
        val KEY_FULL_NAME = stringPreferencesKey("full_name")
        val KEY_SESSION_TOKEN = stringPreferencesKey("session_token")
        val KEY_2FA_ACTIVE = booleanPreferencesKey("2fa_active")
        val KEY_PASSKEY_ACTIVE = booleanPreferencesKey("passkey_active")
        val KEY_SECURITY_SCORE = intPreferencesKey("security_score")
        val KEY_TENANT_ID = stringPreferencesKey("tenant_id")
        val KEY_LAST_LOGIN = longPreferencesKey("last_login_timestamp")
    }

    val isLoggedIn: Flow<Boolean> = context.dataStore.data.map { prefs ->
        prefs[KEY_IS_LOGGED_IN] == true && !prefs[KEY_SESSION_TOKEN].isNullOrBlank()
    }

    val currentUserId: Flow<String?> = context.dataStore.data.map { prefs ->
        prefs[KEY_USER_ID]
    }

    val currentUserName: Flow<String> = context.dataStore.data.map { prefs ->
        prefs[KEY_USER_NAME] ?: ""
    }

    val currentUserEmail: Flow<String> = context.dataStore.data.map { prefs ->
        prefs[KEY_USER_EMAIL] ?: ""
    }

    val currentFullName: Flow<String> = context.dataStore.data.map { prefs ->
        prefs[KEY_FULL_NAME] ?: "SyncVeil User"
    }

    val sessionToken: Flow<String> = context.dataStore.data.map { prefs ->
        prefs[KEY_SESSION_TOKEN] ?: ""
    }

    val is2faActive: Flow<Boolean> = context.dataStore.data.map { prefs ->
        prefs[KEY_2FA_ACTIVE] ?: false
    }

    val securityScore: Flow<Int> = context.dataStore.data.map { prefs ->
        prefs[KEY_SECURITY_SCORE] ?: 98
    }

    val tenantId: Flow<String> = context.dataStore.data.map { prefs ->
        prefs[KEY_TENANT_ID] ?: "SV-CORP-94812"
    }

    suspend fun getAccessToken(): String? {
        val prefs = context.dataStore.data.firstOrNull()
        return prefs?.get(KEY_SESSION_TOKEN)?.takeIf { it.isNotBlank() }
    }

    suspend fun saveAuthResponse(auth: AuthResponseData) {
        context.dataStore.edit { prefs ->
            prefs[KEY_IS_LOGGED_IN] = true
            prefs[KEY_USER_ID] = auth.userId
            prefs[KEY_USER_NAME] = auth.username
            prefs[KEY_USER_EMAIL] = auth.email
            prefs[KEY_FULL_NAME] = auth.fullName
            if (!auth.token.isNullOrBlank()) {
                prefs[KEY_SESSION_TOKEN] = auth.token
            }
            prefs[KEY_2FA_ACTIVE] = auth.is2faEnabled
            prefs[KEY_PASSKEY_ACTIVE] = auth.isPasskeyEnabled
            prefs[KEY_SECURITY_SCORE] = auth.securityScore
            prefs[KEY_TENANT_ID] = auth.tenantId
            prefs[KEY_LAST_LOGIN] = System.currentTimeMillis()
        }
    }

    suspend fun saveSession(user: UserEntity, token: String? = null) {
        context.dataStore.edit { prefs ->
            prefs[KEY_IS_LOGGED_IN] = true
            prefs[KEY_USER_ID] = user.id
            prefs[KEY_USER_NAME] = user.username
            prefs[KEY_USER_EMAIL] = user.email
            prefs[KEY_FULL_NAME] = user.fullName
            if (!token.isNullOrBlank()) {
                prefs[KEY_SESSION_TOKEN] = token
            }
            prefs[KEY_2FA_ACTIVE] = user.is2faEnabled
            prefs[KEY_PASSKEY_ACTIVE] = user.isPasskeyEnabled
            prefs[KEY_SECURITY_SCORE] = user.securityScore
            prefs[KEY_LAST_LOGIN] = System.currentTimeMillis()
        }
    }

    suspend fun updateProfile(fullName: String, email: String, is2faEnabled: Boolean) {
        context.dataStore.edit { prefs ->
            prefs[KEY_FULL_NAME] = fullName
            prefs[KEY_USER_EMAIL] = email
            prefs[KEY_2FA_ACTIVE] = is2faEnabled
        }
    }

    suspend fun clearSession() {
        context.dataStore.edit { prefs ->
            prefs[KEY_IS_LOGGED_IN] = false
            prefs.remove(KEY_USER_ID)
            prefs.remove(KEY_USER_NAME)
            prefs.remove(KEY_USER_EMAIL)
            prefs.remove(KEY_FULL_NAME)
            prefs.remove(KEY_SESSION_TOKEN)
            prefs.remove(KEY_2FA_ACTIVE)
            prefs.remove(KEY_PASSKEY_ACTIVE)
            prefs.remove(KEY_SECURITY_SCORE)
            prefs.remove(KEY_TENANT_ID)
            prefs.remove(KEY_LAST_LOGIN)
        }
    }
}
