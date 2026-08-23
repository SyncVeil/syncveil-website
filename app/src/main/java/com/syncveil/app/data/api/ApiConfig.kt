package com.syncveil.app.data.api

enum class Environment(val baseUrl: String, val displayName: String, val description: String) {
    PRODUCTION(
        baseUrl = "https://syncveil.software",
        displayName = "SyncVeil Production",
        description = "Official cloud production backend"
    ),
    AI_STUDIO_DEV(
        baseUrl = "https://ais-dev-qrphsf4mdqsdk63pb4xss4-220745881826.asia-southeast1.run.app",
        displayName = "AI Studio Cloud Run",
        description = "Active development cloud container"
    ),
    LOCAL_EMULATOR(
        baseUrl = "http://10.0.2.2:3000",
        displayName = "Localhost (10.0.2.2:3000)",
        description = "Android Emulator loopback to local dev server"
    ),
    STAGING(
        baseUrl = "https://staging.syncveil.software",
        displayName = "Staging Environment",
        description = "Pre-production test deployment"
    ),
    CUSTOM(
        baseUrl = "",
        displayName = "Custom Backend URL",
        description = "Self-hosted or private server endpoint"
    );

    companion object {
        fun fromUrl(url: String): Environment {
            val clean = url.trim().trimEnd('/')
            return entries.find { it.baseUrl.equals(clean, ignoreCase = true) } ?: CUSTOM
        }
    }
}

object ApiConfig {
    const val DEFAULT_BASE_URL = "https://syncveil.software"
    const val DEV_BASE_URL = "https://ais-dev-qrphsf4mdqsdk63pb4xss4-220745881826.asia-southeast1.run.app"
    const val API_TIMEOUT_MS = 15000

    @Volatile
    var currentBaseUrl: String = DEFAULT_BASE_URL
        private set

    fun setBaseUrl(url: String) {
        val clean = url.trim().trimEnd('/')
        currentBaseUrl = if (clean.isNotBlank()) clean else DEFAULT_BASE_URL
    }

    fun getEndpoint(path: String): String {
        val cleanPath = if (path.startsWith("/")) path else "/$path"
        return "$currentBaseUrl$cleanPath"
    }

    fun currentEnvironment(): Environment {
        return Environment.fromUrl(currentBaseUrl)
    }
}
