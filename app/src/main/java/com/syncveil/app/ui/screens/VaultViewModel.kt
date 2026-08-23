package com.syncveil.app.ui.screens

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.syncveil.app.data.CloudSyncManager
import com.syncveil.app.data.VaultItem
import com.syncveil.app.data.repository.SyncVeilRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class VaultViewModel(application: Application) : AndroidViewModel(application) {
    private val repository = SyncVeilRepository.getInstance(application)
    private val cloudSyncManager = CloudSyncManager.getInstance(application)

    private val _isRefreshing = MutableStateFlow(false)
    val isRefreshing: StateFlow<Boolean> = _isRefreshing.asStateFlow()

    private val _statusMessage = MutableStateFlow<String?>(null)
    val statusMessage: StateFlow<String?> = _statusMessage.asStateFlow()

    val vaultItems = repository.getVaultItems()
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = emptyList()
        )

    init {
        refreshFromCloud()
    }

    fun refreshFromCloud() {
        viewModelScope.launch {
            _isRefreshing.value = true
            repository.refreshVaultFromCloud()
            _isRefreshing.value = false
        }
    }

    fun addItem(title: String, content: String, category: String = "Note") {
        viewModelScope.launch {
            val response = repository.addVaultItem(title.trim(), content.trim(), category)
            if (response.isSuccess) {
                _statusMessage.value = "Record client-side encrypted and saved."
                cloudSyncManager.triggerCloudSync()
            } else {
                _statusMessage.value = response.errorMessage ?: "Failed to save record"
            }
        }
    }

    fun deleteItem(item: VaultItem) {
        viewModelScope.launch {
            repository.deleteVaultItem(item)
            cloudSyncManager.triggerCloudSync()
        }
    }

    fun clearStatusMessage() {
        _statusMessage.value = null
    }
}
